// Konfigurasi Aplikasi
const CONFIG = {
  // WAJIB: isi URL web app GAS (disarankan pakai domain script.googleusercontent.com untuk menghindari CORS)
  API_URL: 'https://script.google.com/macros/s/AKfycbxcEFPhYOXPVWnLqmURR74hCj0AGOJpPZvESMqFI_zbgvXXZTMUVZDU2Ww_kRRqZbzkvA/exec',

  // Cache lokal (tetap berguna untuk fallback offline)
  STORAGE_KEY: 'expense_tracker_cache_v1',

  // Format mata uang
  CURRENCY_FORMAT: {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  },

  // Audio settings
  AUDIO: {
    maxSeconds: 25, // batasi durasi rekaman supaya payload base64 tidak besar
    preferredMimeTypes: ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']
  }
};

// State Aplikasi
let appState = {
    currentPage: 'dashboard',
    expenses: [],
    filteredExpenses: [],
    currentPageIndex: 1,
    itemsPerPage: 20,
    recentPageIndex: 1,
    recentItemsPerPage: 20,
    audioRecorder: null,
    audioChunks: [],
    receiptImageBlob: null,
    receiptLastParsed: null,   // { merchant, date, items[], total, ... }
    receiptSelected: [],       // items terpilih yang akan disimpan
    isRecording: false,
    audioBlob: null,
    // Chart controls (default)
    dailyRange: '7d',     // today | 7d | 30d | 1y | all
    dailyScale: 'auto'   // auto | rp | rb | jt | log
};

// DOM Elements
let domElements = {};

// Inisialisasi Aplikasi
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    loadData();
    setupEventListeners();
    setupCharts();
});

// Fungsi Inisialisasi
function initializeApp() {
    // Kumpulkan semua elemen DOM yang diperlukan
    domElements = {
        // Navigation
        navLinks: document.querySelectorAll('.nav-menu a'),
        contentSections: document.querySelectorAll('.content-section'),
        
        // Dashboard
        monthTotal: document.getElementById('month-total'),
        monthCount: document.getElementById('month-count'),
        monthAvg: document.getElementById('month-avg'),
        totalExpense: document.getElementById('total-expense'),
        totalTransactions: document.getElementById('total-transactions'),
        topStore: document.getElementById('top-store'),
        topCategory: document.getElementById('top-category'),
        recentTableBody: document.getElementById('recent-table-body'),

        // Dashboard recent paging
        recentPageSize: document.getElementById('recent-page-size'),
        recentPagination: document.getElementById('recent-pagination'),

        // Data paging
        dataPageSize: document.getElementById('data-page-size'),
        dataPagination: document.getElementById('data-pagination'),

        // Chart controls
        dailyRange: document.getElementById('daily-range'),
        dailyScale: document.getElementById('daily-scale'),
        dailyChartTitle: document.getElementById('daily-chart-title'),
        
        // Voice Input
        recordBtn: document.getElementById('record-btn'),
        stopBtn: document.getElementById('stop-btn'),
        processBtn: document.getElementById('process-btn'),
        recorderStatus: document.getElementById('recorder-status'),
        audioPreview: document.getElementById('audio-preview'),
        transcriptionResult: document.getElementById('transcription-result'),
        saveBtn: document.getElementById('save-btn'),
        clearBtn: document.getElementById('clear-btn'),

        // Receipt (Foto Struk)
        receiptFile: document.getElementById('receipt-file'),
        receiptProcessBtn: document.getElementById('receipt-process-btn'),
        receiptClearBtn: document.getElementById('receipt-clear-btn'),
        receiptPreview: document.getElementById('receipt-preview'),
        receiptResult: document.getElementById('receipt-result'),
        
        // Form Fields
        itemName: document.getElementById('item-name'),
        itemQuantity: document.getElementById('item-quantity'),
        itemUnit: document.getElementById('item-unit'),
        itemBrand: document.getElementById('item-brand'),
        itemPrice: document.getElementById('item-price'),
        itemStore: document.getElementById('item-store'),
        itemCategory: document.getElementById('item-category'),
        totalPrice: document.getElementById('total-price'),
        
        // Manual Input
        manualForm: document.getElementById('manual-form'),
        manualItemName: document.getElementById('manual-item-name'),
        manualItemQuantity: document.getElementById('manual-item-quantity'),
        manualItemUnit: document.getElementById('manual-item-unit'),
        manualItemBrand: document.getElementById('manual-item-brand'),
        manualItemPrice: document.getElementById('manual-item-price'),
        manualTotalPrice: document.getElementById('manual-total-price'),
        manualItemStore: document.getElementById('manual-item-store'),
        manualItemCategory: document.getElementById('manual-item-category'),
        manualDate: document.getElementById('manual-date'),
        
        // Data Table
        expenseTableBody: document.getElementById('expense-table-body'),
        filterMonth: document.getElementById('filter-month'),
        filterYear: document.getElementById('filter-year'),
        filterCategory: document.getElementById('filter-category'),
        applyFilter: document.getElementById('apply-filter'),
        resetFilter: document.getElementById('reset-filter'),
        prevPage: document.getElementById('prev-page'),
        nextPage: document.getElementById('next-page'),
        pageInfo: document.getElementById('page-info'),
        
        // Export
        exportStart: document.getElementById('export-start'),
        exportEnd: document.getElementById('export-end'),
        exportCategory: document.getElementById('export-category'),
        exportStore: document.getElementById('export-store'),
        exportPeriod: document.getElementById('export-period'),
        exportFiltered: document.getElementById('export-filtered'),
        exportAll: document.getElementById('export-all'),
        exportResult: document.getElementById('export-result'),
        
        // Toast dan Loading
        toast: document.getElementById('toast'),
        loading: document.getElementById('loading')
    };
    
    // Set tanggal default untuk form manual
    const today = toISODateLocal(new Date());
    domElements.manualDate.value = today;

    // Sync default chart controls (if exist)
    if (domElements.dailyRange) domElements.dailyRange.value = appState.dailyRange || '7d';
    if (domElements.dailyScale) domElements.dailyScale.value = appState.dailyScale || 'auto';
    
    // Set rentang tanggal untuk export (bulan ini)
    const now = new Date();
    const firstDay = toISODateLocal(new Date(now.getFullYear(), now.getMonth(), 1));
    const lastDay  = toISODateLocal(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    domElements.exportStart.value = firstDay;
    domElements.exportEnd.value = lastDay;
}

// Helper: pasang event hanya jika elemen ada
function on(el, evt, handler, opts){
  if (!el) return;
  el.addEventListener(evt, handler, opts);
}

// Setup Event Listeners (SAFE)
function setupEventListeners() {
  // Navigation
  if (domElements.navLinks && domElements.navLinks.forEach) {
    domElements.navLinks.forEach(link => {
      on(link, 'click', function(e){
        e.preventDefault();
        const targetId = this.getAttribute('href').substring(1);
        navigateTo(targetId);
      });
    });
  }

  // Page size: Data Pengeluaran
  on(domElements.dataPageSize, 'change', () => {
    appState.itemsPerPage = Number(domElements.dataPageSize.value || 20);
    appState.currentPageIndex = 1;
    renderExpenseTable();
  });

  // Page size: Recent (Dashboard)
  on(domElements.recentPageSize, 'change', () => {
    appState.recentItemsPerPage = Number(domElements.recentPageSize.value || 20);
    appState.recentPageIndex = 1;
    renderRecentTable();
  });

  // Voice Input Events (SAFE)
  on(domElements.recordBtn, 'click', startRecording);
  on(domElements.stopBtn, 'click', stopRecording);
  on(domElements.processBtn, 'click', processAudio);
  on(domElements.saveBtn, 'click', saveVoiceInputData);
  on(domElements.clearBtn, 'click', clearVoiceInput);

  // Receipt Events (SAFE)
  on(domElements.receiptFile, 'change', onReceiptFileSelected);
  on(domElements.receiptProcessBtn, 'click', processReceiptImage);
  on(domElements.receiptClearBtn, 'click', clearReceiptInput);

  // Auto-calculate total price (SAFE)
  on(domElements.itemQuantity, 'input', calculateTotal);
  on(domElements.itemPrice, 'input', calculateTotal);

  // Manual Input Events (SAFE)
  on(domElements.manualForm, 'submit', saveManualInputData);
  on(domElements.manualItemQuantity, 'input', calculateManualTotal);
  on(domElements.manualItemPrice, 'input', calculateManualTotal);

  // Data Table Events (SAFE)
  on(domElements.applyFilter, 'click', applyFilters);
  on(domElements.resetFilter, 'click', resetFilters);
  on(domElements.prevPage, 'click', goToPrevPage);
  on(domElements.nextPage, 'click', goToNextPage);

  // ✅ Event delegation Edit/Delete (SAFE)
  on(domElements.expenseTableBody, 'click', function(e){
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;
    if (!id) return;

    if (action === 'edit') editExpense(id);
    if (action === 'delete') deleteExpense(id);
  });

  // Export Events (SAFE)
  on(domElements.exportPeriod, 'click', exportByPeriod);
  on(domElements.exportFiltered, 'click', exportFilteredData);
  on(domElements.exportAll, 'click', exportAllData);

  // Chart controls events (SAFE)
  on(domElements.dailyRange, 'change', () => {
    appState.dailyRange = domElements.dailyRange.value || '7d';
    updateCharts();
  });

  on(domElements.dailyScale, 'change', () => {
    appState.dailyScale = domElements.dailyScale.value || 'auto';
    updateCharts();
  });
}

// Fungsi Navigasi
function navigateTo(pageId) {
    // Update active nav link
    domElements.navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${pageId}`) {
            link.classList.add('active');
        }
    });
    
    // Show target section
    domElements.contentSections.forEach(section => {
        section.classList.remove('active');
        if (section.id === pageId) {
            section.classList.add('active');
        }
    });
    
    appState.currentPage = pageId;
    
    // Load data khusus untuk halaman tertentu
    if (pageId === 'dashboard') {
        updateDashboard();
    } else if (pageId === 'data') {
        loadExpenseData();
    }
}

// Fungsi untuk memformat angka ke format Rupiah
function formatCurrency(amount) {
    return new Intl.NumberFormat('id-ID', CONFIG.CURRENCY_FORMAT).format(amount);
}

function normalizeToISODate(value){
  // hasil: 'YYYY-MM-DD' atau null (mengikuti waktu lokal/WIB dari browser)
  if (value == null) return null;

  // kalau sudah Date
  if (value instanceof Date && !isNaN(value)) {
    return toISODateLocal(value); // lokal (WIB di device user)
  }

  const s = String(value).trim();
  if (!s) return null;

  // 1) Jika sudah "YYYY-MM-DD" -> anggap tanggal lokal (jangan diubah)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // 2) Jika "DD/MM/YYYY" -> jadikan "YYYY-MM-DD" (lokal)
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const dd = pad2(Number(m[1]));
    const mm = pad2(Number(m[2]));
    const yy = m[3];
    return `${yy}-${mm}-${dd}`;
  }

  // 3) Jika ISO timestamp dengan timezone (Z atau +07:00, dll)
  //    -> parse sebagai Date, lalu ambil tanggal lokal (WIB)
  //    contoh: 2026-01-02T17:00:00.000Z  -> di WIB jadi 2026-01-03
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d)) return toISODateLocal(d);
    return null;
  }

  // 4) fallback: coba parse Date (bisa format lain dari GAS)
  const d = new Date(s);
  if (!isNaN(d)) return toISODateLocal(d);

  return null;
}

function compareExpenseDesc(a, b){
  const da = normalizeToISODate(a?.tanggal) || '';
  const db = normalizeToISODate(b?.tanggal) || '';

  // sort tanggal desc
  if (da !== db) return db.localeCompare(da);

  // tie-breaker: no desc (kalau ada)
  const na = Number(a?.no || 0);
  const nb = Number(b?.no || 0);
  if (na !== nb) return nb - na;

  // tie-breaker: id desc (string)
  return String(b?.id || '').localeCompare(String(a?.id || ''));
}

function sortStateExpensesDesc(){
  if (Array.isArray(appState.expenses)) {
    appState.expenses.sort(compareExpenseDesc);
  }
  if (Array.isArray(appState.filteredExpenses)) {
    appState.filteredExpenses.sort(compareExpenseDesc);
  }
}

// -----------------------------------------------------------------------------
// API helper (hindari preflight: kirim body string tanpa header custom)
// -----------------------------------------------------------------------------
async function apiPost(action, payload = {}) {
  if (!CONFIG.API_URL || !CONFIG.API_URL.includes('google')) {
    throw new Error('API_URL belum dikonfigurasi');
  }

  const body = JSON.stringify({ action, ...payload });

  const res = await fetch(CONFIG.API_URL, {
    method: 'POST',
    body
  });

  const text = await res.text();

  // bantu debug jika GAS mengembalikan HTML (misalnya authorization required)
  if (text.trim().startsWith('<')) {
    throw new Error('GAS membalas HTML (kemungkinan belum authorize / salah deployment). Cek izin & deploy ulang.');
  }

  let json;
  try { json = JSON.parse(text); }
  catch { throw new Error('Response bukan JSON: ' + text.slice(0, 200)); }

  if (!json || json.status !== 'success') {
    throw new Error(json?.message || 'API error');
  }
  return json;
}

async function apiGet(action, params = {}) {
  const url = new URL(CONFIG.API_URL);
  url.searchParams.set('action', action);

  // ✅ anti-cache
  url.searchParams.set('_ts', String(Date.now()));

  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));

  const res = await fetch(url.toString(), { method: 'GET', cache: 'no-store' });
  const json = await res.json();
  if (!json || json.status !== 'success') throw new Error(json?.message || 'API error');
  return json;
}

// Fungsi untuk mengurai angka dari teks (misal: "23 juta 500 ribu" -> 23500000)
function parsePriceFromText(text) {
    if (!text) return 0;
    
    // Cek apakah teks sudah berupa angka
    const numericMatch = text.match(/(\d+(?:\.\d+)?)/g);
    if (numericMatch) {
        // Gabungkan semua angka yang ditemukan
        const numericString = numericMatch.join('');
        return parseInt(numericString.replace(/\./g, ''));
    }
    
    // Untuk teks seperti "23 juta 500 ribu"
    let total = 0;
    const textLower = text.toLowerCase();
    
    // Jutaan
    const jutaMatch = textLower.match(/(\d+(?:\.\d+)?)\s*juta/);
    if (jutaMatch) {
        total += parseFloat(jutaMatch[1].replace(/\./g, '')) * 1000000;
    }
    
    // Ribuan
    const ribuMatch = textLower.match(/(\d+(?:\.\d+)?)\s*ribu/);
    if (ribuMatch) {
        total += parseFloat(ribuMatch[1].replace(/\./g, '')) * 1000;
    }
    
    // Ratusan
    const ratusMatch = textLower.match(/(\d+(?:\.\d+)?)\s*ratus/);
    if (ratusMatch) {
        total += parseFloat(ratusMatch[1].replace(/\./g, '')) * 100;
    }
    
    // Satuan
    const satuanMatch = textLower.match(/(\d+(?:\.\d+)?)\s*rupiah/);
    if (satuanMatch) {
        total += parseFloat(satuanMatch[1].replace(/\./g, ''));
    }
    
    return total;
}

// Fungsi untuk memproses transkripsi teks dan mengisi form
function processTranscription(text) {
    // Contoh pola untuk mendeteksi informasi dari teks
    const patterns = {
        itemName: /beli\s+([^0-9]+?)(?=\s+sebanyak|\s+merk|\s+seharga|\s+di|$)/i,
        quantity: /sebanyak\s+([0-9.,]+)\s+([^0-9]+?)(?=\s+merk|\s+seharga|\s+di|$)/i,
        brand: /merk\s+([^0-9]+?)(?=\s+seharga|\s+di|$)/i,
        price: /seharga\s+([^0-9]*?[0-9.,]+[^0-9]*?)(?=\s+rupiah|\s+di|$)/i,
        store: /di\s+(toko\s+)?([^.]+?)(?=\.|$)/i
    };
    
    let itemName = '';
    let quantity = 1;
    let unit = 'unit';
    let brand = '';
    let price = 0;
    let store = '';
    
    // Ekstrak nama barang
    const itemNameMatch = text.match(patterns.itemName);
    if (itemNameMatch) {
        itemName = itemNameMatch[1].trim();
    }
    
    // Ekstrak jumlah dan satuan
    const quantityMatch = text.match(patterns.quantity);
    if (quantityMatch) {
        quantity = parseFloat(quantityMatch[1].replace(/\./g, '').replace(',', '.'));
        unit = quantityMatch[2].trim().toLowerCase();
    }
    
    // Ekstrak merk
    const brandMatch = text.match(patterns.brand);
    if (brandMatch) {
        brand = brandMatch[1].trim();
    }
    
    // Ekstrak harga
    const priceMatch = text.match(patterns.price);
    if (priceMatch) {
        price = parsePriceFromText(priceMatch[1]);
    }
    
    // Ekstrak toko
    const storeMatch = text.match(patterns.store);
    if (storeMatch) {
        store = storeMatch[2].trim();
    }
    
    // Isi form dengan data yang diekstrak
    domElements.itemName.value = itemName;
    domElements.itemQuantity.value = quantity;
    domElements.itemUnit.value = unit;
    domElements.itemBrand.value = brand;
    domElements.itemPrice.value = price;
    domElements.itemStore.value = store;
    
    // Hitung total harga
    calculateTotal();
    
    // Update transkripsi result box
    domElements.transcriptionResult.innerHTML = `
        <p><strong>Transkripsi:</strong> ${text}</p>
        <p><strong>Hasil Parsing:</strong></p>
        <ul>
            <li>Nama Barang: ${itemName}</li>
            <li>Jumlah: ${quantity} ${unit}</li>
            <li>Merk: ${brand}</li>
            <li>Harga: ${formatCurrency(price)}</li>
            <li>Toko: ${store}</li>
        </ul>
    `;
}

// Fungsi untuk memulai rekaman suara
async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // pilih mime yang didukung browser
    let mimeType = '';
    for (const mt of CONFIG.AUDIO.preferredMimeTypes) {
      if (MediaRecorder.isTypeSupported(mt)) { mimeType = mt; break; }
    }

    appState.audioRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    appState.audioChunks = [];
    appState.audioBlob = null;

    let stopTimer = null;

    appState.audioRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) appState.audioChunks.push(event.data);
    };

    appState.audioRecorder.onstop = () => {
      try {
        const finalMime = appState.audioRecorder.mimeType || mimeType || 'audio/webm';
        appState.audioBlob = new Blob(appState.audioChunks, { type: finalMime });

        const audioUrl = URL.createObjectURL(appState.audioBlob);
        domElements.audioPreview.innerHTML = `
          <audio controls src="${audioUrl}"></audio>
          <p>Rekaman siap diproses</p>
        `;

        domElements.processBtn.disabled = false;
        updateRecorderStatus('success', 'Rekaman selesai');
      } finally {
        if (stopTimer) clearTimeout(stopTimer);
      }
    };

    appState.audioRecorder.start();
    appState.isRecording = true;

    domElements.recordBtn.disabled = true;
    domElements.stopBtn.disabled = false;
    domElements.processBtn.disabled = true;
    updateRecorderStatus('recording', 'Sedang merekam...');

    // auto stop agar tidak terlalu panjang
    stopTimer = setTimeout(() => {
      if (appState.isRecording) stopRecording();
    }, CONFIG.AUDIO.maxSeconds * 1000);

  } catch (error) {
    showToast('Error: Tidak dapat mengakses mikrofon', 'error');
    console.error('Error accessing microphone:', error);
  }
}

// Fungsi untuk menghentikan rekaman
function stopRecording() {
    if (appState.audioRecorder && appState.isRecording) {
        appState.audioRecorder.stop();
        appState.isRecording = false;
        
        // Matikan semua track microphone
        appState.audioRecorder.stream.getTracks().forEach(track => track.stop());
        
        domElements.recordBtn.disabled = false;
        domElements.stopBtn.disabled = true;
    }
}

// Fungsi untuk memperbarui status rekaman
function updateRecorderStatus(status, message) {
  const statusIcon = domElements.recorderStatus.querySelector('i');
  const statusText = domElements.recorderStatus.querySelector('p');

  domElements.recorderStatus.className = 'recorder-status';

  if (status === 'recording') {
    domElements.recorderStatus.classList.add('recording');
    statusIcon.className = 'fas fa-microphone';
  } else if (status === 'processing') {
    domElements.recorderStatus.classList.add('processing');
    statusIcon.className = 'fas fa-cog fa-spin';
  } else if (status === 'success') {
    domElements.recorderStatus.classList.add('success');
    statusIcon.className = 'fas fa-check-circle';
  } else {
    // idle/default
    statusIcon.className = 'fas fa-microphone';
  }

  statusText.textContent = message || 'Siap merekam';
}

function blobToBase64(blob){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      // result: data:<mime>;base64,xxxx
      const s = String(reader.result || '');
      const base64 = s.split(',')[1] || '';
      resolve(base64);
    };
    reader.readAsDataURL(blob);
  });
}

// ==============================
// RECEIPT (FOTO STRUK) FEATURE
// ==============================

function isImageFile(file){
  return file && file.type && file.type.startsWith('image/');
}

function imageFileToBlob(file){
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('File kosong'));
    if (!isImageFile(file)) return reject(new Error('File bukan gambar'));
    resolve(file); // file sudah Blob
  });
}

// (opsional) kompres gambar agar base64 tidak terlalu besar
async function compressImageBlob(blob, maxW = 1400, quality = 0.85){
  // jika browser tidak support canvas, fallback blob asli
  try {
    const bmp = await createImageBitmap(blob);
    const scale = Math.min(1, maxW / bmp.width);
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bmp, 0, 0, w, h);

    const outBlob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality));
    return outBlob || blob;
  } catch {
    return blob;
  }
}

async function onReceiptFileSelected(){
  const file = domElements.receiptFile?.files?.[0];
  if (!file) return;

  try {
    let blob = await imageFileToBlob(file);
    blob = await compressImageBlob(blob, 1400, 0.85);

    appState.receiptImageBlob = blob;
    appState.receiptLastParsed = null;
    appState.receiptSelected = [];

    // preview image
    const url = URL.createObjectURL(blob);
    if (domElements.receiptPreview) {
      domElements.receiptPreview.innerHTML = `
        <div style="display:flex;gap:12px;align-items:flex-start;">
          <img src="${url}" alt="Preview Struk" style="max-width:240px;border-radius:10px;border:1px solid #e3e6f0;" />
          <div class="small" style="line-height:1.4;">
            <div><b>File:</b> ${escapeHtml(file.name || 'kamera')}</div>
            <div><b>Ukuran:</b> ${(blob.size/1024).toFixed(1)} KB</div>
            <div><b>Format:</b> ${escapeHtml(blob.type || 'image')}</div>
          </div>
        </div>
      `;
    }

    if (domElements.receiptResult) {
      domElements.receiptResult.innerHTML = `<div class="small">Siap diproses. Klik <b>Baca Struk (AI)</b>.</div>`;
    }

    if (domElements.receiptProcessBtn) domElements.receiptProcessBtn.disabled = false;
    if (domElements.receiptClearBtn) domElements.receiptClearBtn.disabled = false;

  } catch (err) {
    console.error(err);
    showToast('Gagal memuat gambar: ' + err.message, 'error');
  }
}

function clearReceiptInput(){
  appState.receiptImageBlob = null;
  appState.receiptLastParsed = null;
  appState.receiptSelected = [];

  if (domElements.receiptFile) domElements.receiptFile.value = '';
  if (domElements.receiptPreview) domElements.receiptPreview.innerHTML = '';
  if (domElements.receiptResult) domElements.receiptResult.innerHTML = '';

  if (domElements.receiptProcessBtn) domElements.receiptProcessBtn.disabled = true;
  if (domElements.receiptClearBtn) domElements.receiptClearBtn.disabled = true;
}

// Format angka aman
function asNumber(v, def = 0){
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function guessCategoryFromText(name){
  const s = String(name || '').toLowerCase();
  if (/(kopi|teh|susu|air|minum|makan|snack|roti|mie|beras|gula|telur|ayam|daging)/.test(s)) return 'Makanan & Minuman';
  if (/(bensin|pertalite|solar|bbm|parkir|tol|ojek|grab|gojek)/.test(s)) return 'Transportasi';
  if (/(sabun|sampo|deterjen|pasta gigi|tisu|pewangi|pembersih)/.test(s)) return 'Rumah Tangga';
  if (/(obat|vitamin|masker|plester)/.test(s)) return 'Kesehatan';
  return 'Lainnya';
}

// Render hasil parsing (multi-item)
function renderReceiptResult(parsed){
  const p = parsed || {};
  const merchant = p.toko || '';
  const dateISO = normalizeToISODate(p.tanggal) || toISODateLocal(new Date());
  const items = Array.isArray(p.items) ? p.items : [];
  const total = asNumber(p.total, 0);

  if (!domElements.receiptResult) return;

  if (items.length === 0) {
    domElements.receiptResult.innerHTML = `
      <div style="padding:10px;border:1px solid #f6c23e;border-radius:10px;background:#fff8e1;">
        <b>AI belum menemukan item.</b>
        <div class="small">Coba foto lebih terang, struk tidak terpotong, dan fokus jelas.</div>
      </div>
    `;
    return;
  }

  // ✅ default selected = semua
  appState.receiptSelected = items.map((it, idx) => ({ ...it, _idx: idx, _selected: true }));

  const rowsHtml = appState.receiptSelected.map(it => {
    const nm = escapeHtml(it.nama_barang || '');
    const qty = asNumber(it.qty ?? 1, 1);
    const unit = escapeHtml(it.satuan || '');
    const price = asNumber(it.harga_satuan ?? 0, 0);
    const lineTotal = asNumber(it.harga_total ?? (qty * price), qty * price);

    return `
      <tr>
        <td style="width:36px;text-align:center;">
          <input type="checkbox" class="rcpt-item-check" data-idx="${it._idx}" checked />
        </td>
        <td>${nm}</td>
        <td style="text-align:right;">${qty}</td>
        <td>${unit}</td>
        <td style="text-align:right;">${formatCurrency(price)}</td>
        <td style="text-align:right;"><b>${formatCurrency(lineTotal)}</b></td>
      </tr>
    `;
  }).join('');

  domElements.receiptResult.innerHTML = `
    <div style="border:1px solid #e3e6f0;border-radius:12px;padding:12px;background:#fff;">
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;justify-content:space-between;">
        <div>
          <div><b>Toko:</b> <span>${escapeHtml(merchant || '-')}</span></div>
          <div class="small"><b>Tanggal:</b> <span>${escapeHtml(dateISO)}</span></div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <button id="rcpt-save-selected" type="button" class="btn btn-success">
            <i class="fas fa-save"></i> Simpan Item Terpilih
          </button>
          <button id="rcpt-select-all" type="button" class="btn btn-light">Pilih Semua</button>
          <button id="rcpt-unselect-all" type="button" class="btn btn-light">Kosongkan</button>
        </div>
      </div>

      <div style="margin-top:10px;overflow:auto;">
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#f8f9fc;">
              <th style="padding:8px;border-bottom:1px solid #e3e6f0;">✔</th>
              <th style="padding:8px;border-bottom:1px solid #e3e6f0;text-align:left;">Item</th>
              <th style="padding:8px;border-bottom:1px solid #e3e6f0;text-align:right;">Qty</th>
              <th style="padding:8px;border-bottom:1px solid #e3e6f0;text-align:left;">Sat</th>
              <th style="padding:8px;border-bottom:1px solid #e3e6f0;text-align:right;">Harga</th>
              <th style="padding:8px;border-bottom:1px solid #e3e6f0;text-align:right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>

      <div class="small" style="margin-top:10px;">
        <b>Total Struk (AI):</b> ${formatCurrency(total)}
      </div>
    </div>
  `;

  // ✅ event handler (tanpa double attach)
  const box = domElements.receiptResult;

  const syncChecks = () => {
    box.querySelectorAll('.rcpt-item-check').forEach(ch => {
      const idx = Number(ch.dataset.idx);
      const target = appState.receiptSelected.find(x => x._idx === idx);
      if (target) target._selected = !!ch.checked;
    });
  };

  // gunakan onchange langsung agar tidak menumpuk listener
  box.onchange = (e) => {
    const el = e.target;
    if (el && el.classList && el.classList.contains('rcpt-item-check')) syncChecks();
  };

  const btnSave = box.querySelector('#rcpt-save-selected');
  const btnAll = box.querySelector('#rcpt-select-all');
  const btnNone = box.querySelector('#rcpt-unselect-all');

  if (btnAll) btnAll.onclick = () => {
    appState.receiptSelected.forEach(it => it._selected = true);
    box.querySelectorAll('.rcpt-item-check').forEach(ch => ch.checked = true);
  };
  if (btnNone) btnNone.onclick = () => {
    appState.receiptSelected.forEach(it => it._selected = false);
    box.querySelectorAll('.rcpt-item-check').forEach(ch => ch.checked = false);
  };
  if (btnSave) btnSave.onclick = async () => {
    syncChecks();
    await saveSelectedReceiptItems(merchant, dateISO);
  };
}

// Kirim foto ke GAS untuk OCR + parsing AI
async function processReceiptImage(){
  if (!appState.receiptImageBlob) {
    showToast('Silakan pilih foto struk dulu', 'error');
    return;
  }

  if (domElements.receiptProcessBtn) domElements.receiptProcessBtn.disabled = true;
  showLoading(true);

  try {
    const base64 = await blobToBase64(appState.receiptImageBlob);
    const mimeType = appState.receiptImageBlob.type || 'image/jpeg';

    // ✅ Action GAS yang benar
    const json = await apiPost('parseReceiptImage', {
      image_base64: base64,
      mime_type: mimeType
    });

    const parsed = json.data || {};
    appState.receiptLastParsed = parsed;

    renderReceiptResult(parsed);
    showToast('Struk berhasil dibaca (silakan review item)', 'success');
  } catch (err) {
    console.error(err);
    showToast('Gagal membaca struk: ' + err.message, 'error');
  } finally {
    showLoading(false);
    if (domElements.receiptProcessBtn) domElements.receiptProcessBtn.disabled = false;
  }
}

// Simpan item terpilih menjadi banyak baris di Sheet
async function saveSelectedReceiptItems(merchant, dateISO){
  const selected = (appState.receiptSelected || []).filter(it => it._selected);
  if (selected.length === 0) {
    showToast('Tidak ada item yang dipilih', 'error');
    return;
  }

  showLoading(true);

  try {
    // Susun payload per item (mapping ke schema Sheet Anda)
    const receiptId = 'RCPT_' + Date.now(); // id pengikat untuk semua item struk
    const rp = appState.receiptLastParsed || {};

    const rows = selected.map(it => {
    const name = it.nama_barang || '';
    const qty = asNumber(it.qty ?? 1, 1);
    const unit = it.satuan || '';
    const price = asNumber(it.harga_satuan ?? 0, 0);
    const lineTotal = asNumber(it.harga_total ?? (qty * price), qty * price);

    return {
        tanggal: dateISO || toISODateLocal(new Date()),
        nama_barang: String(name).trim(),
        jumlah: qty,
        satuan: String(unit).trim(),
        merk: String(it.merk || '').trim(),
        harga_satuan: price,
        harga_total: lineTotal,
        kategori: String(it.kategori || guessCategoryFromText(name) || 'Lainnya'),
        toko: String(merchant || '').trim(),
        transkripsi: '',
        source: 'receipt',

        // ✅ tambahan kolom baru (opsional tapi bagus untuk laporan)
        receipt_id: receiptId,
        receipt_subtotal: rp.subtotal ?? null,
        receipt_pajak: rp.pajak ?? null,
        receipt_diskon: rp.diskon ?? null,
        receipt_total: rp.total ?? null
    };
    });

    // Opsi A (paling mudah): panggil addExpense berulang di client
    // Tapi lebih cepat Opsi B: bulk insert via GAS (disarankan).
    // Di sini saya pakai bulk jika tersedia, fallback ke loop jika gagal.

    let savedRows = [];
    try {
      const bulk = await apiPost('addExpensesBulk', { rows });
      savedRows = Array.isArray(bulk.data) ? bulk.data : [];
    } catch (e) {
      console.warn('Bulk gagal, fallback loop addExpense:', e.message);
      for (const r of rows) {
        const one = await apiPost('addExpense', { data: r });
        if (one && one.data) savedRows.push(one.data);
      }
    }

    // Update state instan untuk semua item tersimpan
    savedRows.forEach(rec => applySavedExpenseToState(rec));

    showToast(`Berhasil menyimpan ${savedRows.length || rows.length} item dari struk`, 'success');
    clearReceiptInput();
    setTimeout(() => loadData(), 300);

  } catch (err) {
    console.error(err);
    showToast('Gagal menyimpan item struk: ' + err.message, 'error');
  } finally {
    showLoading(false);
  }
}

// Fungsi untuk memproses audio (simulasi AI)
async function processAudio() {
  if (!appState.audioBlob) {
    showToast('Tidak ada rekaman untuk diproses', 'error');
    return;
  }

  // anti double click
  domElements.processBtn.disabled = true;
  updateRecorderStatus('processing', 'Memproses dengan AI...');

  try {
    const base64 = await blobToBase64(appState.audioBlob);
    const mimeType = appState.audioBlob.type || 'audio/webm';

    const json = await apiPost('transcribeAndParse', {
      audio_base64: base64,
      mime_type: mimeType,
      locale: 'id-ID'
    });

    const transcript = json.transcript || '';
    const parsed = json.parsed || {};

    // tampilkan transkripsi
    domElements.transcriptionResult.innerHTML = `
      <p><strong>Transkripsi:</strong> ${escapeHtml(transcript)}</p>
      <p><strong>Parsing AI:</strong></p>
      <pre style="white-space:pre-wrap;background:#fff;border:1px solid #e3e6f0;padding:10px;border-radius:8px;">${escapeHtml(JSON.stringify(parsed, null, 2))}</pre>
    `;

    // isi form dari AI (fallback ke regex lama kalau ada yang kosong)
    if (parsed && typeof parsed === 'object') {
      if (parsed.nama_barang) domElements.itemName.value = parsed.nama_barang;
      if (parsed.jumlah != null) domElements.itemQuantity.value = parsed.jumlah;
      if (parsed.satuan) domElements.itemUnit.value = parsed.satuan;
      if (parsed.merk) domElements.itemBrand.value = parsed.merk;
      if (parsed.harga_satuan != null) domElements.itemPrice.value = parsed.harga_satuan;
      if (parsed.toko) domElements.itemStore.value = parsed.toko;
      if (parsed.kategori) domElements.itemCategory.value = parsed.kategori;
    }

    // fallback regex lama untuk mengisi yang masih kosong
    if (!domElements.itemName.value || !domElements.itemPrice.value) {
      processTranscription(transcript);
    } else {
      calculateTotal();
    }

    // simpan transcript ke state agar ikut disimpan ke sheet
    appState.lastTranscript = transcript;

    updateRecorderStatus('success', 'Berhasil diproses');
    showToast('Transkripsi & parsing AI berhasil', 'success');
  } catch (err) {
    console.error(err);
    showToast('Gagal memproses AI: ' + err.message, 'error');
    updateRecorderStatus('idle', 'Siap merekam');
  } finally {
    domElements.processBtn.disabled = false;
  }
}

// helper kecil untuk mencegah XSS saat render
function escapeHtml(s){
  return String(s || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}

// Fungsi untuk menghitung total harga (voice input)
function calculateTotal() {
    const quantity = parseFloat(domElements.itemQuantity.value) || 0;
    const price = parseFloat(domElements.itemPrice.value) || 0;
    const total = quantity * price;
    
    domElements.totalPrice.value = formatCurrency(total);
}

// Fungsi untuk menghitung total harga (manual input)
function calculateManualTotal() {
    const quantity = parseFloat(domElements.manualItemQuantity.value) || 0;
    const price = parseFloat(domElements.manualItemPrice.value) || 0;
    const total = quantity * price;
    
    domElements.manualTotalPrice.value = formatCurrency(total);
}

// Fungsi untuk menyimpan data dari voice input
async function saveVoiceInputData() {
    // Validasi input
    if (!domElements.itemName.value || !domElements.itemQuantity.value || !domElements.itemPrice.value) {
        showToast('Harap isi semua field yang wajib', 'error');
        return;
    }
    
    const expenseData = {
        itemName: domElements.itemName.value,
        quantity: parseFloat(domElements.itemQuantity.value),
        unit: domElements.itemUnit.value || 'unit',
        brand: domElements.itemBrand.value,
        price: parseFloat(domElements.itemPrice.value),
        store: domElements.itemStore.value,
        category: domElements.itemCategory.value,
        date: toISODateLocal(new Date()),
        source: 'voice'
    };
    
    expenseData.total = expenseData.quantity * expenseData.price;
    
    // Simpan ke Google Sheets melalui API
    const saved = await saveToBackend(expenseData);

    if (saved) {
    showToast(saved._offline ? 'Tersimpan offline (akan sync saat online)' : 'Data berhasil disimpan', 'success');

    // ✅ update dashboard instan
    applySavedExpenseToState(saved);

    clearVoiceInput();

    // opsional: refresh dari server (biar nomor/no rapih & sinkron)
    // tapi jangan blocking UI
    setTimeout(() => loadData(), 300);
    } else {
    showToast('Gagal menyimpan data', 'error');
    }
}

// Fungsi untuk menyimpan data dari manual input
async function saveManualInputData(e) {
    e.preventDefault();
    
    const expenseData = {
        itemName: domElements.manualItemName.value,
        quantity: parseFloat(domElements.manualItemQuantity.value),
        unit: domElements.manualItemUnit.value,
        brand: domElements.manualItemBrand.value,
        price: parseFloat(domElements.manualItemPrice.value),
        store: domElements.manualItemStore.value,
        category: domElements.manualItemCategory.value,
        date: domElements.manualDate.value || toISODateLocal(new Date()),
        source: 'manual'
    };
    
    expenseData.total = expenseData.quantity * expenseData.price;
    
    // Simpan ke Google Sheets melalui API
    const saved = await saveToBackend(expenseData);

    if (saved) {
    showToast(saved._offline ? 'Tersimpan offline (akan sync saat online)' : 'Data berhasil disimpan', 'success');

    // reset form
    domElements.manualForm.reset();
    domElements.manualTotalPrice.value = '';
    domElements.manualDate.value = toISODateLocal(new Date());

    // ✅ update dashboard instan
    applySavedExpenseToState(saved);

    // opsional refresh dari server
    setTimeout(() => loadData(), 300);
    } else {
    showToast('Gagal menyimpan data', 'error');
    }
}

// Fungsi untuk menyimpan data ke backend
async function saveToBackend(data) {
  showLoading(true);

  try {
    const payload = {
      tanggal: data.date,
      nama_barang: data.itemName,
      jumlah: data.quantity,
      satuan: data.unit,
      merk: data.brand || '',
      harga_satuan: data.price,
      harga_total: data.total,
      kategori: data.category || 'Lainnya',
      toko: data.store || '',
      transkripsi: appState.lastTranscript || '',
      source: data.source || 'manual'
    };

    const json = await apiPost('addExpense', { data: payload });
    const saved = json.data;

    // update cache lokal
    const existing = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || '[]');
    existing.push(saved);
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(existing));

    // ✅ penting: return object saved agar UI bisa update instan
    return saved;
  } catch (error) {
    console.error('Error saving data:', error);

    // fallback: simpan sementara di cache lokal (offline)
    try {
      const existing = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || '[]');
      const tmpId = 'OFF_' + Date.now();
      const offlineRec = {
        id: tmpId,
        no: existing.length + 1,
        tanggal: data.date,
        nama_barang: data.itemName,
        jumlah: data.quantity,
        satuan: data.unit,
        merk: data.brand || '',
        harga_satuan: data.price,
        harga_total: data.total,
        kategori: data.category || 'Lainnya',
        toko: data.store || '',
        transkripsi: appState.lastTranscript || '',
        source: data.source || 'manual',
        _offline: true
      };
      existing.push(offlineRec);
      localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(existing));

      // ✅ return offline record supaya dashboard tetap update tanpa refresh
      return offlineRec;
    } catch {}

    return null;
  } finally {
    showLoading(false);
  }
}

function applySavedExpenseToState(saved) {
  if (!saved) return;

  // pastikan tipe angka aman
  saved.no = Number(saved.no || 0);
  saved.jumlah = Number(saved.jumlah || 0);
  saved.harga_satuan = Number(saved.harga_satuan || 0);
  saved.harga_total = Number(saved.harga_total || 0);

  // masukkan ke state (paling depan supaya terlihat "terbaru")
  appState.expenses = [saved, ...(appState.expenses || [])];

  // reset filter supaya data baru ikut tampil
  appState.filteredExpenses = [...appState.expenses];

  // kalau sedang di halaman data, balik ke page 1 biar terlihat
  sortStateExpensesDesc();
  appState.currentPageIndex = 1;

  // render UI langsung
  updateDashboard();
  updateMonthSummary();
  if (appState.currentPage === 'data') renderExpenseTable();
  renderRecentTable();
}

// Fungsi untuk membersihkan form voice input
function clearVoiceInput() {
    domElements.itemName.value = '';
    domElements.itemQuantity.value = '';
    domElements.itemUnit.value = '';
    domElements.itemBrand.value = '';
    domElements.itemPrice.value = '';
    domElements.itemStore.value = '';
    domElements.totalPrice.value = '';
    domElements.itemCategory.value = 'Makanan & Minuman';
    
    domElements.audioPreview.innerHTML = '<p>Belum ada rekaman</p>';
    domElements.transcriptionResult.innerHTML = '<p>Hasil transkripsi akan muncul di sini...</p>';
    
    domElements.processBtn.disabled = true;
    appState.audioBlob = null;
    
    updateRecorderStatus('idle', 'Siap merekam');
}

// Fungsi untuk memuat data dari backend/offline storage
async function loadData() {
  showLoading(true);

  try {
    let data = [];

    try {
      const res = await apiGet('getExpenses');
      data = Array.isArray(res.data) ? res.data : [];
      localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      console.warn('Fetch API gagal, pakai cache lokal:', err.message);
      data = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY) || '[]');
    }

    appState.expenses = data;
    appState.filteredExpenses = [...data];

    sortStateExpensesDesc();
    appState.currentPageIndex = 1;
    appState.recentPageIndex = 1;

    updateDashboard();
    updateMonthSummary();
    renderRecentTable();

    if (appState.currentPage === 'data') renderExpenseTable();

  } catch (error) {
    console.error('Error loading data:', error);
    showToast('Gagal memuat data', 'error');
  } finally {
    showLoading(false);
  }
}

// Fungsi untuk memperbarui dashboard
function updateDashboard() {
  // guard jika elemen dashboard belum ada (misalnya halaman belum siap)
  if (!domElements.totalExpense || !domElements.totalTransactions || !domElements.topStore || !domElements.topCategory || !domElements.recentTableBody) {
    return;
  }

  const arr = Array.isArray(appState.expenses) ? appState.expenses : [];

  if (arr.length === 0) {
    domElements.totalExpense.textContent = 'Rp 0';
    domElements.totalTransactions.textContent = '0';
    domElements.topStore.textContent = '-';
    domElements.topCategory.textContent = '-';
    domElements.recentTableBody.innerHTML = '<tr><td colspan="5" class="empty-data">Tidak ada data</td></tr>';
    // chart juga boleh update kosong
    updateCharts();
    return;
  }

  // Hitung total pengeluaran (pastikan angka)
  const totalExpense = arr.reduce((sum, e) => sum + (Number(e?.harga_total) || 0), 0);
  domElements.totalExpense.textContent = formatCurrency(totalExpense);

  // Hitung total transaksi
  domElements.totalTransactions.textContent = String(arr.length);

  // Cari toko favorit (berdasarkan jumlah transaksi)
  const storeCount = {};
  for (const e of arr) {
    const store = (e?.toko && String(e.toko).trim()) ? String(e.toko).trim() : 'Tidak diketahui';
    storeCount[store] = (storeCount[store] || 0) + 1;
  }
  const topStore = Object.keys(storeCount).reduce((a, b) => (storeCount[a] > storeCount[b] ? a : b), '-');
  domElements.topStore.textContent = topStore || '-';

  // Cari kategori terbesar (berdasarkan total pengeluaran)
  const categoryTotals = {};
  for (const e of arr) {
    const category = (e?.kategori && String(e.kategori).trim()) ? String(e.kategori).trim() : 'Lainnya';
    categoryTotals[category] = (categoryTotals[category] || 0) + (Number(e?.harga_total) || 0);
  }
  const topCategory = Object.keys(categoryTotals).reduce((a, b) => (categoryTotals[a] > categoryTotals[b] ? a : b), '-');
  domElements.topCategory.textContent = topCategory || '-';

  // ✅ tabel recent jangan pakai variabel recentExpenses
  // Serahkan sepenuhnya pada renderRecentTable()
  renderRecentTable();

  // update chart
  updateCharts();
}

function renderRecentTable(){
  // kalau belum ada data
  if (!Array.isArray(appState.expenses) || appState.expenses.length === 0) {
    domElements.recentTableBody.innerHTML =
      '<tr><td colspan="5" class="empty-data">Tidak ada data</td></tr>';
    if (domElements.recentPagination) domElements.recentPagination.innerHTML = '';
    return;
  }

  // pastikan urut terbaru -> lama
  sortStateExpensesDesc();

  const perPage = Number(appState.recentItemsPerPage || 20);
  const total = appState.expenses.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  // clamp page
  appState.recentPageIndex = Math.min(Math.max(1, appState.recentPageIndex || 1), totalPages);

  const startIndex = (appState.recentPageIndex - 1) * perPage;
  const endIndex = startIndex + perPage;
  const rows = appState.expenses.slice(startIndex, endIndex);

  let html = '';
  rows.forEach(expense => {
    html += `
      <tr>
        <td>${formatDate(expense.tanggal)}</td>
        <td>${escapeHtml(expense.nama_barang || '')}</td>
        <td>${Number(expense.jumlah || 0)} ${escapeHtml(expense.satuan || '')}</td>
        <td>${formatCurrency(Number(expense.harga_total || 0))}</td>
        <td>${escapeHtml(expense.toko || '-')}</td>
      </tr>
    `;
  });

  domElements.recentTableBody.innerHTML = html || '<tr><td colspan="5" class="empty-data">Tidak ada data</td></tr>';

  // pagination elipsis
  renderPagination(domElements.recentPagination, appState.recentPageIndex, totalPages, (p) => {
    appState.recentPageIndex = p;
    renderRecentTable();
  });
}

// Fungsi untuk memperbarui ringkasan bulan
function updateMonthSummary() {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    
    // Filter pengeluaran bulan ini
    const monthlyExpenses = appState.expenses.filter(expense => {
        const expenseDate = new Date(expense.tanggal);
        return expenseDate.getMonth() + 1 === currentMonth && expenseDate.getFullYear() === currentYear;
    });
    
    // Hitung total pengeluaran bulan ini
    const monthTotal = monthlyExpenses.reduce((sum, expense) => sum + expense.harga_total, 0);
    
    // Hitung rata-rata per hari
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const monthAvg = monthTotal / daysInMonth;
    
    domElements.monthTotal.textContent = formatCurrency(monthTotal);
    domElements.monthCount.textContent = monthlyExpenses.length;
    domElements.monthAvg.textContent = formatCurrency(monthAvg);
}

// Fungsi untuk memformat tanggal
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

function pad2(n){ return String(n).padStart(2,'0'); }

function toISODateLocal(d){
  // aman untuk zona lokal user (Asia/Jakarta dari browser)
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth()+1);
  const dd = pad2(d.getDate());
  return `${yyyy}-${mm}-${dd}`;
}

function startOfDay(d){
  const x = new Date(d);
  x.setHours(0,0,0,0);
  return x;
}

function monthKey(d){
  const iso = normalizeToISODate(d);
  if (!iso) return null;
  // iso: YYYY-MM-DD
  return iso.slice(0, 7); // YYYY-MM
}

function monthLabelFromKey(key){
  const [y,m] = key.split('-').map(Number);
  const d = new Date(y, m-1, 1);
  return d.toLocaleDateString('id-ID', { month:'short', year:'numeric' });
}

function rangeTitle(rangeKey){
  if (rangeKey === 'today') return 'Pengeluaran (Hari Ini)';
  if (rangeKey === '7d') return 'Pengeluaran Harian (7 Hari Terkini)';
  if (rangeKey === '30d') return 'Pengeluaran Harian (30 Hari Terkini)';
  if (rangeKey === '1y') return 'Pengeluaran Bulanan (1 Tahun Terkini)';
  return 'Pengeluaran Bulanan (Semua Data)';
}

function scaleTickFormatter(scaleKey){
  // return function(value){...}
  if (scaleKey === 'rb') {
    return (v) => 'Rp' + (Number(v)/1000).toFixed(0) + 'Rb';
  }
  if (scaleKey === 'jt') {
    return (v) => 'Rp' + (Number(v)/1000000).toFixed(1) + 'Jt';
  }
  if (scaleKey === 'rp') {
    return (v) => formatCurrency(Number(v));
  }
  // auto
  return (value) => {
    const v = Number(value) || 0;
    if (v >= 1000000000) return 'Rp' + (v/1000000000).toFixed(1) + 'M';
    if (v >= 1000000) return 'Rp' + (v/1000000).toFixed(1) + 'Jt';
    if (v >= 1000) return 'Rp' + (v/1000).toFixed(0) + 'Rb';
    return 'Rp' + v;
  };
}

function buildDailySeries(expenses, rangeKey){
  const data = Array.isArray(expenses) ? expenses : [];
  const today = startOfDay(new Date());
  const todayISO = toISODateLocal(today);

  if (rangeKey === 'today') {
    let total = 0;
    for (const e of data) {
      const iso = normalizeToISODate(e.tanggal);
      if (!iso) continue;
      if (iso === todayISO) total += (Number(e.harga_total) || 0);
    }
    return { mode:'day', labels:['Hari ini'], values:[total] };
  }

  if (rangeKey === '7d' || rangeKey === '30d') {
    const days = (rangeKey === '7d') ? 7 : 30;
    const start = new Date(today);
    start.setDate(start.getDate() - (days - 1));

    const buckets = {};
    const dates = [];

    for (let i = 0; i < days; i++){
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = toISODateLocal(d);
      dates.push(iso);
      buckets[iso] = 0;
    }

    for (const e of data){
      const iso = normalizeToISODate(e.tanggal);
      if (!iso) continue;
      if (Object.prototype.hasOwnProperty.call(buckets, iso)) {
        buckets[iso] += (Number(e.harga_total) || 0);
      }
    }

    const labels = dates.map(iso => {
      // buat Date lokal aman (YYYY-MM-DD -> Date)
      const d = new Date(iso + 'T00:00:00');
      return d.toLocaleDateString('id-ID', { weekday:'short', day:'numeric' });
    });

    const values = dates.map(iso => buckets[iso] || 0);
    return { mode:'day', labels, values };
  }

  // 1y / all => monthly aggregation
  let startMonth = null;
  if (rangeKey === '1y') {
    const s = new Date(today);
    s.setMonth(s.getMonth() - 11);
    startMonth = toISODateLocal(new Date(s.getFullYear(), s.getMonth(), 1)); // YYYY-MM-01
  }

  const monthlyTotals = {};
  for (const e of data){
    const iso = normalizeToISODate(e.tanggal);
    if (!iso) continue;

    if (startMonth && iso < startMonth) continue;

    const key = iso.slice(0, 7); // YYYY-MM
    monthlyTotals[key] = (monthlyTotals[key] || 0) + (Number(e.harga_total) || 0);
  }

  const keys = Object.keys(monthlyTotals).sort(); // yyyy-mm
  const labels = keys.map(k => monthLabelFromKey(k));
  const values = keys.map(k => monthlyTotals[k] || 0);

  return { mode:'month', labels, values };
}

// Setup charts awal
function setupCharts() {
    // Chart pengeluaran harian
    const dailyCtx = document.getElementById('daily-chart').getContext('2d');
    appState.dailyChart = new Chart(dailyCtx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Pengeluaran (Rp)',
                data: [],
                backgroundColor: 'rgba(78, 115, 223, 0.8)',
                borderColor: 'rgba(78, 115, 223, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return scaleTickFormatter(appState.dailyScale || 'auto')(value);
                        }
                    }
                }
            }
        }
    });
    
    // Chart kategori
    const categoryCtx = document.getElementById('category-chart').getContext('2d');
    appState.categoryChart = new Chart(categoryCtx, {
        type: 'doughnut',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: [
                    '#4e73df', '#1cc88a', '#f6c23e', '#e74a3b',
                    '#36b9cc', '#858796', '#6f42c1', '#fd7e14'
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

// Update charts dengan data terkini (FIX: hindari recursive set di Chart.js options proxy)
function updateCharts() {
  if (!appState.dailyChart || !appState.categoryChart) return;

  const rangeKey = appState.dailyRange || '7d';
  const scaleKey = appState.dailyScale || 'auto';

  // title
  if (domElements.dailyChartTitle) {
    domElements.dailyChartTitle.textContent = rangeTitle(rangeKey);
  }

  // build series
  const series = buildDailySeries(appState.expenses, rangeKey);

  // =======================
  // DAILY CHART (dynamic)
  // =======================
  appState.dailyChart.data.labels = series.labels;

  // Log scale tidak boleh 0 → ubah 0 jadi null agar tidak error
  const dailyValues =
    (scaleKey === 'log')
      ? series.values.map(v => (Number(v) > 0 ? Number(v) : null))
      : series.values.map(v => Number(v) || 0);

  appState.dailyChart.data.datasets[0].data = dailyValues;

  // --- IMPORTANT FIX ---
  // Jangan reassign object options (jangan y.ticks = y.ticks || {})
  const opts = appState.dailyChart.options || (appState.dailyChart.options = {});
  const scales = opts.scales || (opts.scales = {});
  const y = scales.y || (scales.y = {});

  // Pastikan ticks ada sekali saja (ini aman karena hanya dibuat jika benar-benar undefined)
  // dan TIDAK meng-copy/menimpa object lain
  if (!y.ticks) y.ticks = {};

  if (scaleKey === 'log') {
    y.type = 'logarithmic';
    y.beginAtZero = false;

    // log scale butuh min > 0
    y.min = 1;

    // label tick pakai auto formatter (biar rapi)
    y.ticks.callback = (value) => scaleTickFormatter('auto')(value);
  } else {
    y.type = 'linear';
    y.beginAtZero = true;

    // bersihkan min khusus log supaya normal lagi
    if (typeof y.min !== 'undefined') delete y.min;

    y.ticks.callback = (value) => scaleTickFormatter(scaleKey)(value);
  }

  appState.dailyChart.update();

  // =======================
  // CATEGORY CHART (same)
  // =======================
  if (!appState.expenses || appState.expenses.length === 0) {
    appState.categoryChart.data.labels = [];
    appState.categoryChart.data.datasets[0].data = [];
    appState.categoryChart.update();
    return;
  }

  const categoryTotals = {};
  appState.expenses.forEach(expense => {
    const category = expense.kategori || 'Lainnya';
    categoryTotals[category] =
      (categoryTotals[category] || 0) + (Number(expense.harga_total) || 0);
  });

  appState.categoryChart.data.labels = Object.keys(categoryTotals);
  appState.categoryChart.data.datasets[0].data = Object.values(categoryTotals);
  appState.categoryChart.update();
}

// Fungsi untuk memuat data pengeluaran ke tabel
function loadExpenseData() {
    renderExpenseTable();
}

function buildEllipsisPages(current, total, delta = 2){
  // delta=2 => tampil: 1 ... (c-2 c-1 c c+1 c+2) ... total
  const range = [];
  const pages = [];
  const left = Math.max(2, current - delta);
  const right = Math.min(total - 1, current + delta);

  range.push(1);
  for (let i = left; i <= right; i++) range.push(i);
  if (total > 1) range.push(total);

  // remove duplicates & sort
  const uniq = [...new Set(range)].sort((a,b)=>a-b);

  let prev = null;
  for (const p of uniq){
    if (prev != null && p - prev > 1) pages.push('...');
    pages.push(p);
    prev = p;
  }
  return pages;
}

function renderPagination(containerEl, current, total, onGo){
  if (!containerEl) return;
  containerEl.innerHTML = '';

  const makeBtn = (label, disabled, aria, goTo) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'page-btn';
    b.textContent = label;
    if (aria) b.setAttribute('aria-label', aria);
    if (disabled) b.disabled = true;
    if (!disabled && goTo != null) b.addEventListener('click', () => onGo(goTo));
    return b;
  };

  containerEl.appendChild(makeBtn('‹', current <= 1, 'Sebelumnya', current - 1));

  const pages = buildEllipsisPages(current, total, 2);
  pages.forEach(p => {
    if (p === '...'){
      const span = document.createElement('span');
      span.className = 'page-ellipsis';
      span.textContent = '…';
      containerEl.appendChild(span);
      return;
    }
    const btn = makeBtn(String(p), false, `Halaman ${p}`, p);
    if (p === current) btn.classList.add('active');
    containerEl.appendChild(btn);
  });

  containerEl.appendChild(makeBtn('›', current >= total, 'Berikutnya', current + 1));
}

// Fungsi untuk merender tabel pengeluaran
function renderExpenseTable() {
  // pastikan urut terbaru -> lama (khusus view ini)
  if (Array.isArray(appState.filteredExpenses)) {
    appState.filteredExpenses.sort(compareExpenseDesc);
  }

  const perPage = Number(appState.itemsPerPage || 20);
  const total = appState.filteredExpenses.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  // clamp page
  appState.currentPageIndex = Math.min(Math.max(1, appState.currentPageIndex || 1), totalPages);

  const startIndex = (appState.currentPageIndex - 1) * perPage;
  const endIndex = startIndex + perPage;
  const currentExpenses = appState.filteredExpenses.slice(startIndex, endIndex);

  if (currentExpenses.length === 0) {
    domElements.expenseTableBody.innerHTML = '<tr><td colspan="11" class="empty-data">Tidak ada data</td></tr>';
  } else {
    let html = '';
    currentExpenses.forEach((expense, index) => {
      const actualIndex = startIndex + index + 1;
      html += `
        <tr>
          <td>${actualIndex}</td>
          <td>${formatDate(expense.tanggal)}</td>
          <td>${escapeHtml(expense.nama_barang || '')}</td>
          <td>${Number(expense.jumlah || 0)}</td>
          <td>${escapeHtml(expense.satuan || '')}</td>
          <td>${escapeHtml(expense.merk || '-')}</td>
          <td>${formatCurrency(Number(expense.harga_satuan || 0))}</td>
          <td>${formatCurrency(Number(expense.harga_total || 0))}</td>
          <td>${escapeHtml(expense.kategori || '')}</td>
          <td>${escapeHtml(expense.toko || '-')}</td>
          <td class="action-buttons">
            <button class="edit-btn" type="button" data-action="edit" data-id="${escapeHtml(String(expense.id))}">
              <i class="fas fa-edit"></i>
            </button>
            <button class="delete-btn" type="button" data-action="delete" data-id="${escapeHtml(String(expense.id))}">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        </tr>
      `;
    });
    domElements.expenseTableBody.innerHTML = html;
  }

  // info halaman
  domElements.pageInfo.textContent = `Halaman ${appState.currentPageIndex} dari ${totalPages} (${total} data)`;

  // pagination elipsis
  renderPagination(domElements.dataPagination, appState.currentPageIndex, totalPages, (p) => {
    appState.currentPageIndex = p;
    renderExpenseTable();
  });
}

// Fungsi untuk menerapkan filter
function applyFilters() {
    const month = domElements.filterMonth.value;
    const year = domElements.filterYear.value;
    const category = domElements.filterCategory.value;
    
    appState.filteredExpenses = appState.expenses.filter(expense => {
        const expenseDate = new Date(expense.tanggal);
        const expenseMonth = expenseDate.getMonth() + 1;
        const expenseYear = expenseDate.getFullYear();
        
        // Filter bulan
        if (month !== 'all' && parseInt(month) !== expenseMonth) {
            return false;
        }
        
        // Filter tahun
        if (parseInt(year) !== expenseYear) {
            return false;
        }
        
        // Filter kategori
        if (category !== 'all' && expense.kategori !== category) {
            return false;
        }
        
        return true;
    });
    
    appState.filteredExpenses.sort(compareExpenseDesc);
    appState.currentPageIndex = 1;
    renderExpenseTable();
}

// Fungsi untuk mereset filter
function resetFilters() {
    domElements.filterMonth.value = 'all';
    domElements.filterYear.value = new Date().getFullYear().toString();
    domElements.filterCategory.value = 'all';
    
    appState.filteredExpenses.sort(compareExpenseDesc);
    appState.currentPageIndex = 1;
    renderExpenseTable();
}

// Fungsi untuk navigasi halaman
function goToPrevPage() {
    if (appState.currentPageIndex > 1) {
        appState.currentPageIndex--;
        renderExpenseTable();
    }
}

function goToNextPage() {
    const totalPages = Math.ceil(appState.filteredExpenses.length / appState.itemsPerPage);
    if (appState.currentPageIndex < totalPages) {
        appState.currentPageIndex++;
        renderExpenseTable();
    }
}

// Fungsi untuk mengedit pengeluaran
function editExpense(id) {
    // Cari pengeluaran berdasarkan ID
    const expense = appState.expenses.find(e => String(e.id) === String(id));
    if (!expense) return;
    
    // Navigasi ke halaman manual input dan isi form
    navigateTo('manual');
    
    // Isi form dengan data yang akan diedit
    setTimeout(() => {
        domElements.manualItemName.value = expense.nama_barang;
        domElements.manualItemQuantity.value = expense.jumlah;
        domElements.manualItemUnit.value = expense.satuan;
        domElements.manualItemBrand.value = expense.merk || '';
        domElements.manualItemPrice.value = expense.harga_satuan;
        domElements.manualItemStore.value = expense.toko || '';
        domElements.manualItemCategory.value = expense.kategori;
        domElements.manualDate.value = expense.tanggal;
        
        calculateManualTotal();
        
        // Ubah tombol submit untuk update
        const submitBtn = domElements.manualForm.querySelector('button[type="submit"]');
        submitBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Update Data';
        submitBtn.onclick = function(e) {
            e.preventDefault();
            updateExpense(id);
        };
        
        showToast('Edit mode: Silahkan perbarui data', 'info');
    }, 100);
}

// Fungsi untuk mengupdate pengeluaran
async function updateExpense(id) {
    const expenseData = {
        itemName: domElements.manualItemName.value,
        quantity: parseFloat(domElements.manualItemQuantity.value),
        unit: domElements.manualItemUnit.value,
        brand: domElements.manualItemBrand.value,
        price: parseFloat(domElements.manualItemPrice.value),
        store: domElements.manualItemStore.value,
        category: domElements.manualItemCategory.value,
        date: domElements.manualDate.value
    };
    
    expenseData.total = expenseData.quantity * expenseData.price;
    
    // Update di state lokal
    const index = appState.expenses.findIndex(e => String(e.id) === String(id));
    if (index !== -1) {
        appState.expenses[index] = {
            ...appState.expenses[index],
            tanggal: expenseData.date,
            nama_barang: expenseData.itemName,
            jumlah: expenseData.quantity,
            satuan: expenseData.unit,
            merk: expenseData.brand,
            harga_satuan: expenseData.price,
            harga_total: expenseData.total,
            kategori: expenseData.category,
            toko: expenseData.store
        };
        
        // Simpan ke localStorage
        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(appState.expenses));
        
        // Update ke Google Sheets jika ada
        if (CONFIG.API_URL && CONFIG.API_URL.includes('google')) {
            try {
                const payload = {
                    tanggal: expenseData.date,
                    nama_barang: expenseData.itemName,
                    jumlah: expenseData.quantity,
                    satuan: expenseData.unit,
                    merk: expenseData.brand || '',
                    harga_satuan: expenseData.price,
                    harga_total: expenseData.total,
                    kategori: expenseData.category || 'Lainnya',
                    toko: expenseData.store || ''
                };
                await apiPost('updateExpense', { id, data: payload });
                } catch (error) {
                console.error('Error updating expense:', error);
                }
        }
        
        // Reset form dan state
        domElements.manualForm.reset();
        domElements.manualTotalPrice.value = '';
        domElements.manualDate.value = new Date().toISOString().split('T')[0];
        
        // Kembalikan tombol submit ke mode normal
        const submitBtn = domElements.manualForm.querySelector('button[type="submit"]');
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Simpan Data';
        submitBtn.onclick = saveManualInputData;
        
        showToast('Data berhasil diupdate', 'success');
        
        // Refresh data
        if (appState.currentPage === 'dashboard' || appState.currentPage === 'data') {
            loadData();
        }
    }
}

// Fungsi untuk menghapus pengeluaran
async function deleteExpense(id) {
    if (!confirm('Apakah Anda yakin ingin menghapus data ini?')) {
        return;
    }
    
    // Hapus dari state lokal
    appState.expenses = appState.expenses.filter(e => String(e.id) !== String(id));
    appState.filteredExpenses = appState.filteredExpenses.filter(e => String(e.id) !== String(id));
    
    // Simpan ke localStorage
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(appState.expenses));
    
    // Hapus dari Google Sheets jika ada
    if (CONFIG.API_URL && CONFIG.API_URL.includes('google')) {
        try {
            await apiPost('deleteExpense', { id: id });
        } catch (error) {
            console.error('Error deleting expense:', error);
        }
    }
    
    showToast('Data berhasil dihapus', 'success');
    renderExpenseTable();
    updateDashboard();
    updateMonthSummary();
}

// Fungsi untuk export data berdasarkan periode
function exportByPeriod() {
    const startDate = domElements.exportStart.value;
    const endDate = domElements.exportEnd.value;
    
    if (!startDate || !endDate) {
        showToast('Harap pilih rentang tanggal', 'error');
        return;
    }
    
    // Filter data berdasarkan periode
    const filteredData = appState.expenses.filter(expense => {
        const expenseDate = expense.tanggal;
        return expenseDate >= startDate && expenseDate <= endDate;
    });
    
    if (filteredData.length === 0) {
        showToast('Tidak ada data dalam periode yang dipilih', 'error');
        return;
    }
    
    exportToExcel(filteredData, `Pengeluaran_${startDate}_sd_${endDate}`);
}

// Fungsi untuk export data dengan filter
function exportFilteredData() {
    const category = domElements.exportCategory.value;
    const store = domElements.exportStore.value.trim().toLowerCase();
    
    // Filter data
    let filteredData = appState.expenses;
    
    if (category !== 'all') {
        filteredData = filteredData.filter(expense => expense.kategori === category);
    }
    
    if (store) {
        filteredData = filteredData.filter(expense => 
            expense.toko && expense.toko.toLowerCase().includes(store)
        );
    }
    
    if (filteredData.length === 0) {
        showToast('Tidak ada data dengan filter yang dipilih', 'error');
        return;
    }
    
    const filename = `Pengeluaran_${category !== 'all' ? category + '_' : ''}${store ? store + '_' : ''}${new Date().toISOString().split('T')[0]}`;
    exportToExcel(filteredData, filename);
}

// Fungsi untuk export semua data
function exportAllData() {
    if (appState.expenses.length === 0) {
        showToast('Tidak ada data untuk diexport', 'error');
        return;
    }
    
    exportToExcel(appState.expenses, `Semua_Pengeluaran_${new Date().toISOString().split('T')[0]}`);
}

// Fungsi untuk export ke Excel
function exportToExcel(data, filename) {
    // Format data untuk Excel
    const excelData = data.map((expense, index) => ({
        'No': index + 1,
        'Tanggal': formatDate(expense.tanggal),
        'Nama Barang': expense.nama_barang,
        'Jumlah': expense.jumlah,
        'Satuan': expense.satuan,
        'Merk': expense.merk || '',
        'Harga Satuan': expense.harga_satuan,
        'Total Harga': expense.harga_total,
        'Kategori': expense.kategori,
        'Toko': expense.toko || ''
    }));
    
    // Buat worksheet
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    
    // Buat workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Pengeluaran');
    
    // Export ke file
    XLSX.writeFile(workbook, `${filename}.xlsx`);
    
    // Tampilkan status
    domElements.exportResult.innerHTML = `
        <p><i class="fas fa-check-circle" style="color: #1cc88a;"></i> Berhasil mengeksport ${data.length} data ke file ${filename}.xlsx</p>
        <p>File telah diunduh ke perangkat Anda.</p>
    `;
    
    showToast(`Berhasil mengexport ${data.length} data`, 'success');
}

// Fungsi untuk menampilkan toast notification
function showToast(message, type = 'success') {
    const toast = domElements.toast;
    const toastIcon = toast.querySelector('.toast-icon');
    const toastMessage = toast.querySelector('.toast-message');
    
    // Set warna berdasarkan type
    if (type === 'error') {
        toast.style.backgroundColor = '#e74a3b';
        toastIcon.className = 'fas fa-exclamation-circle toast-icon';
    } else if (type === 'info') {
        toast.style.backgroundColor = '#36b9cc';
        toastIcon.className = 'fas fa-info-circle toast-icon';
    } else {
        toast.style.backgroundColor = '#1cc88a';
        toastIcon.className = 'fas fa-check-circle toast-icon';
    }
    
    toastMessage.textContent = message;
    
    // Tampilkan toast
    toast.style.display = 'block';
    
    // Sembunyikan setelah 3 detik
    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
}

// Fungsi untuk menampilkan/menyembunyikan loading overlay
function showLoading(show) {
    if (show) {
        domElements.loading.style.display = 'flex';
    } else {
        domElements.loading.style.display = 'none';
    }
}