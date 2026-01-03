/* ============================================================================
 * Expense Tracker API (Google Apps Script)
 * - CRUD Google Sheets
 * - Transcribe audio via OpenAI Audio Transcriptions
 * - Parse transcript into structured JSON via OpenAI Structured Outputs
 * ============================================================================
 */
const SPREADSHEET_ID = '15_LceWcAtkBeBU-GHvIflifjLEn3myDLnm5EkRQMuEw';
const SHEET_NAME = 'expenses';
const PROP_OPENAI_KEY = 'OPENAI_API_KEY';

// ----------------------------- ROUTER ---------------------------------------
function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || '';

    if (action === 'ping') {
      return jsonSuccess({ message: 'pong', time: new Date().toISOString() });
    }

    if (action === 'getExpenses') return jsonSuccess({ data: getExpenses_() });

    return jsonError('Unknown action (GET): ' + action);
  } catch (err) {
    return jsonError(err.message || String(err));
  }
}

function doPost(e) {
  try {
    const body = (e && e.postData && e.postData.contents) ? e.postData.contents : '';
    const req = body ? JSON.parse(body) : {};
    const action = req.action || '';

    if (action === 'addExpense') {
      const saved = addExpense_(req.data || {});
      return jsonSuccess({ data: saved });
    }

    if (action === 'updateExpense') {
      const updated = updateExpense_(req.id, req.data || {});
      return jsonSuccess({ data: updated });
    }

    if (action === 'deleteExpense') {
      deleteExpense_(req.id);
      return jsonSuccess({ ok: true });
    }

    if (action === 'transcribeAndParse') {
      const result = transcribeAndParse_(req);
      return jsonSuccess(result);
    }

    if (action === 'pingUrlFetch') {
      const out = pingUrlFetch_();
      return jsonSuccess(out);
    }

    return jsonError('Unknown action (POST): ' + action);

  } catch (err) {
    return jsonError(err.message || String(err));
  }
}

// --------------------------- SHEET HELPERS ----------------------------------
function getSheet_() {
  const ss = SPREADSHEET_ID
    ? SpreadsheetApp.openById(SPREADSHEET_ID)
    : SpreadsheetApp.getActive();

  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow([
      'id','no','created_at','tanggal','nama_barang','jumlah','satuan','merk',
      'harga_satuan','harga_total','kategori','toko','transkripsi','source'
    ]);
  }
  return sh;
}

function getExpenses_() {
  const sh = getSheet_();
  const values = sh.getDataRange().getValues();
  if (values.length <= 1) return [];

  const header = values[0];
  const rows = values.slice(1);

  return rows
    .filter(r => r.join('') !== '')
    .map(r => {
      const obj = {};
      header.forEach((h, i) => obj[h] = r[i]);

      // cast numeric
      obj.no = Number(obj.no || 0);
      obj.jumlah = Number(obj.jumlah || 0);
      obj.harga_satuan = Number(obj.harga_satuan || 0);
      obj.harga_total = Number(obj.harga_total || 0);

      return obj;
    });
}

function addExpense_(data) {
  const sh = getSheet_();
  const id = Utilities.getUuid();
  const createdAt = new Date();

  // ✅ Aman untuk sheet baru (hanya header)
  const lastRow = sh.getLastRow(); // 1 jika hanya header
  let lastNo = 0;

  if (lastRow >= 2) {
    const nums = sh.getRange(2, 2, lastRow - 1, 1).getValues().flat()
      .map(n => Number(n) || 0);
    lastNo = Math.max(0, ...nums);
  }

  const no = lastNo + 1;

  const row = [
    id,
    no,
    createdAt.toISOString(),
    data.tanggal || Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd'),
    String(data.nama_barang || ''),
    Number(data.jumlah || 0),
    String(data.satuan || 'unit'),
    String(data.merk || ''),
    Number(data.harga_satuan || 0),
    Number(data.harga_total || 0),
    String(data.kategori || 'Lainnya'),
    String(data.toko || ''),
    String(data.transkripsi || ''),
    String(data.source || 'manual')
  ];

  sh.appendRow(row);

  return {
    id, no,
    created_at: row[2],
    tanggal: row[3],
    nama_barang: row[4],
    jumlah: row[5],
    satuan: row[6],
    merk: row[7],
    harga_satuan: row[8],
    harga_total: row[9],
    kategori: row[10],
    toko: row[11],
    transkripsi: row[12],
    source: row[13]
  };
}

function findRowById_(id) {
  if (!id) throw new Error('Missing id');
  const sh = getSheet_();
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return -1;

  const ids = sh.getRange(2, 1, lastRow - 1, 1).getValues().flat();
  const idx = ids.findIndex(x => String(x) === String(id));
  return (idx === -1) ? -1 : (idx + 2); // row number in sheet
}

function updateExpense_(id, data) {
  const sh = getSheet_();
  const rowNum = findRowById_(id);
  if (rowNum === -1) throw new Error('ID tidak ditemukan: ' + id);

  // Header positions
  const header = sh.getRange(1,1,1, sh.getLastColumn()).getValues()[0];
  const map = {};
  header.forEach((h,i)=> map[h]= i+1);

  const setCell = (colName, value) => {
    if (!map[colName]) return;
    sh.getRange(rowNum, map[colName]).setValue(value);
  };

  if (data.tanggal) setCell('tanggal', data.tanggal);
  if (data.nama_barang != null) setCell('nama_barang', data.nama_barang);
  if (data.jumlah != null) setCell('jumlah', Number(data.jumlah||0));
  if (data.satuan != null) setCell('satuan', data.satuan);
  if (data.merk != null) setCell('merk', data.merk);
  if (data.harga_satuan != null) setCell('harga_satuan', Number(data.harga_satuan||0));
  if (data.harga_total != null) setCell('harga_total', Number(data.harga_total||0));
  if (data.kategori != null) setCell('kategori', data.kategori);
  if (data.toko != null) setCell('toko', data.toko);
  if (data.transkripsi != null) setCell('transkripsi', data.transkripsi);
  if (data.source != null) setCell('source', data.source);

  // return updated row as object
  const row = sh.getRange(rowNum, 1, 1, sh.getLastColumn()).getValues()[0];
  const obj = {};
  header.forEach((h,i)=> obj[h]= row[i]);
  obj.no = Number(obj.no||0);
  obj.jumlah = Number(obj.jumlah||0);
  obj.harga_satuan = Number(obj.harga_satuan||0);
  obj.harga_total = Number(obj.harga_total||0);
  return obj;
}

function deleteExpense_(id) {
  const sh = getSheet_();
  const rowNum = findRowById_(id);
  if (rowNum === -1) throw new Error('ID tidak ditemukan: ' + id);
  sh.deleteRow(rowNum);
}

// ---------------------------- OPENAI ----------------------------------------
// Audio transcription endpoint (speech-to-text) :contentReference[oaicite:2]{index=2}
function transcribeAndParse_(req) {
  const key = PropertiesService.getScriptProperties().getProperty(PROP_OPENAI_KEY);
  if (!key) throw new Error('OPENAI_API_KEY belum diset di Script Properties');

  const audioB64 = req.audio_base64 || '';
  const mimeType = req.mime_type || 'audio/webm';
  const locale = req.locale || 'id-ID';
  if (!audioB64) throw new Error('audio_base64 kosong');

  const transcript = openaiTranscribe_(key, audioB64, mimeType, locale);
  const parsed = openaiParseStructured_(key, transcript);

  return { transcript, parsed };
}

function openaiTranscribe_(apiKey, audioB64, mimeType, locale) {
  const bytes = Utilities.base64Decode(audioB64);
  const ext =
    mimeType.indexOf('ogg') >= 0 ? 'ogg' :
    mimeType.indexOf('mp3') >= 0 ? 'mp3' :
    mimeType.indexOf('wav') >= 0 ? 'wav' :
    'webm';

  const blob = Utilities.newBlob(bytes, mimeType, 'audio.' + ext);

  // language harus format 2 huruf (mis: "id"), jangan "id-ID"
  let lang = '';
  const lc = String(locale || '').toLowerCase();
  if (lc.startsWith('id')) lang = 'id';
  else if (lc.startsWith('en')) lang = 'en';

  const boundary = '----GASFormBoundary' + Utilities.getUuid().replace(/-/g,'');
  const parts = [
    { name: 'model', value: 'gpt-4o-mini-transcribe' },
    { name: 'file', file: blob }
  ];
  if (lang) parts.splice(1, 0, { name: 'language', value: lang }); // sisipkan setelah model

  const payload = buildMultipart_(parts, boundary);

  const res = UrlFetchApp.fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'post',
    contentType: 'multipart/form-data; boundary=' + boundary,
    payload: payload,
    headers: { Authorization: 'Bearer ' + apiKey },
    muteHttpExceptions: true
  });

  const code = res.getResponseCode();
  const text = res.getContentText();
  if (code < 200 || code >= 300) {
    throw new Error('Transcribe error: HTTP ' + code + ' ' + text.slice(0, 300));
  }

  const json = JSON.parse(text);
  return (json && json.text) ? String(json.text) : '';
}

// Structured Outputs untuk memastikan JSON sesuai schema :contentReference[oaicite:3]{index=3}
function openaiParseStructured_(apiKey, transcript) {

  // ✅ JSON Schema MURNI (tanpa "name" di sini)
  const jsonSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      nama_barang:   { type: "string" },
      jumlah:        { type: "number" },
      satuan:        { type: "string" },
      merk:          { type: "string" },
      harga_satuan:  { type: "number" },
      toko:          { type: "string" },
      kategori:      { type: "string" }
    },
    required: [
      "nama_barang",
      "jumlah",
      "satuan",
      "harga_satuan",
      "toko",
      "kategori",
      "merk"
    ]
  };

  const prompt =
    "Kamu adalah parser transaksi belanja bahasa Indonesia.\n" +
    "Keluarkan SATU JSON saja, tanpa teks lain.\n" +
    "Pastikan semua field required terisi.\n\n" +   
    "Keluarkan SATU JSON sesuai schema.\n\n" +
    "Aturan:\n" +
    "- harga_satuan angka rupiah (contoh: 23500000)\n" +
    "- jumlah angka\n" +
    "- satuan huruf kecil\n" +
    "- merk boleh string kosong \"\"\n" +
    "- kategori salah satu: Makanan & Minuman, Elektronik, Pakaian & Aksesoris, Rumah Tangga, Kesehatan, Transportasi, Hiburan, Lainnya\n" +
    "- toko WAJIB diisi, jika tidak jelas: \"Tidak diketahui\"\n\n" +
    "Teks:\n" + transcript;

  // ✅ STRUKTUR BENAR SESUAI RESPONSES API
  const payload = {
    model: "gpt-5-mini",
    input: prompt,
    text: {
      format: {
        type: "json_schema",
        name: "expense_record",  
        schema: jsonSchema
      }
    },
  };

  const res = UrlFetchApp.fetch("https://api.openai.com/v1/responses", {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    headers: {
      Authorization: "Bearer " + apiKey
    },
    muteHttpExceptions: true
  });

  const code = res.getResponseCode();
  const text = res.getContentText();

  if (code < 200 || code >= 300) {
    throw new Error("Parse error: HTTP " + code + " " + text.slice(0, 300));
  }

  const json = JSON.parse(text);

  // ✅ Ambil output text secara defensif
  let out = "";
  if (json.output_text) {
    out = json.output_text;
  } else if (json.output && json.output.length) {
    const msg = json.output.find(x => x.type === "message") || json.output[0];
    if (msg?.content?.length) {
      const c = msg.content.find(x => x.type === "output_text") || msg.content[0];
      out = c?.text || "";
    }
  }

  const parsed = out ? JSON.parse(out) : {};

  // normalisasi aman
  parsed.merk = parsed.merk || "";
  parsed.toko = parsed.toko || "Tidak diketahui";
  parsed.kategori = parsed.kategori || "Lainnya";

  return parsed;
}

// multipart builder (tanpa library)
function buildMultipart_(parts, boundary) {
  const crlf = '\r\n';
  let chunks = [];

  parts.forEach(p => {
    chunks.push('--' + boundary + crlf);
    if (p.file) {
      const blob = p.file;
      chunks.push(
        'Content-Disposition: form-data; name="' + p.name + '"; filename="' + blob.getName() + '"' + crlf +
        'Content-Type: ' + blob.getContentType() + crlf + crlf
      );
      chunks.push(blob.getBytes());
      chunks.push(crlf);
    } else {
      chunks.push(
        'Content-Disposition: form-data; name="' + p.name + '"' + crlf + crlf +
        String(p.value) + crlf
      );
    }
  });

  chunks.push('--' + boundary + '--' + crlf);

  // Gabungkan jadi blob bytes
  const out = [];
  chunks.forEach(ch => {
    if (typeof ch === 'string') {
      out.push(Utilities.newBlob(ch).getBytes());
    } else {
      out.push(ch);
    }
  });

  return flatten_(out);
}

function flatten_(arrOfArr) {
  const out = [];
  arrOfArr.forEach(a => a.forEach(b => out.push(b)));
  return out;
}

// --------------------------- RESPONSE HELPERS -------------------------------
function jsonSuccess(obj) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'success', ...obj }))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonError(message) {
  console.error('[API ERROR]', message); // <-- tambah ini
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'error', message: String(message || 'error') }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ------------------------- AUTH HELPER (WAJIB RUN SEKALI) --------------------
function authorizeExternalRequest() {
  // Memicu prompt izin untuk UrlFetchApp (external_request)
  const r = UrlFetchApp.fetch('https://www.google.com', { muteHttpExceptions: true });
  Logger.log('Authorize OK. HTTP=' + r.getResponseCode());
}

function pingUrlFetch_() {
  const r = UrlFetchApp.fetch('https://www.google.com', { muteHttpExceptions: true });
  return { ok: true, code: r.getResponseCode(), time: new Date().toISOString() };
}

