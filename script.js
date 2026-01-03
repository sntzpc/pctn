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
    itemsPerPage: 10,
    audioRecorder: null,
    audioChunks: [],
    isRecording: false,
    audioBlob: null
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
        
        // Voice Input
        recordBtn: document.getElementById('record-btn'),
        stopBtn: document.getElementById('stop-btn'),
        processBtn: document.getElementById('process-btn'),
        recorderStatus: document.getElementById('recorder-status'),
        audioPreview: document.getElementById('audio-preview'),
        transcriptionResult: document.getElementById('transcription-result'),
        saveBtn: document.getElementById('save-btn'),
        clearBtn: document.getElementById('clear-btn'),
        
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
    const today = new Date().toISOString().split('T')[0];
    domElements.manualDate.value = today;
    
    // Set rentang tanggal untuk export (bulan ini)
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    domElements.exportStart.value = firstDay;
    domElements.exportEnd.value = lastDay;
}

// Setup Event Listeners
function setupEventListeners() {
    // Navigation
    domElements.navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            navigateTo(targetId);
        });
    });
    
    // Voice Input Events
    domElements.recordBtn.addEventListener('click', startRecording);
    domElements.stopBtn.addEventListener('click', stopRecording);
    domElements.processBtn.addEventListener('click', processAudio);
    domElements.saveBtn.addEventListener('click', saveVoiceInputData);
    domElements.clearBtn.addEventListener('click', clearVoiceInput);
    
    // Auto-calculate total price
    domElements.itemQuantity.addEventListener('input', calculateTotal);
    domElements.itemPrice.addEventListener('input', calculateTotal);
    
    // Manual Input Events
    domElements.manualForm.addEventListener('submit', saveManualInputData);
    domElements.manualItemQuantity.addEventListener('input', calculateManualTotal);
    domElements.manualItemPrice.addEventListener('input', calculateManualTotal);
    
    // Data Table Events
    domElements.applyFilter.addEventListener('click', applyFilters);
    domElements.resetFilter.addEventListener('click', resetFilters);
    domElements.prevPage.addEventListener('click', goToPrevPage);
    domElements.nextPage.addEventListener('click', goToNextPage);
    
    // Export Events
    domElements.exportPeriod.addEventListener('click', exportByPeriod);
    domElements.exportFiltered.addEventListener('click', exportFilteredData);
    domElements.exportAll.addEventListener('click', exportAllData);
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
        date: new Date().toISOString().split('T')[0],
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
        date: domElements.manualDate.value || new Date().toISOString().split('T')[0],
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
    domElements.manualDate.value = new Date().toISOString().split('T')[0];

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
  appState.currentPageIndex = 1;

  // render UI langsung
  updateDashboard();
  updateMonthSummary();
  if (appState.currentPage === 'data') renderExpenseTable();
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

    updateDashboard();
    updateMonthSummary();

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
    if (appState.expenses.length === 0) {
        domElements.totalExpense.textContent = 'Rp 0';
        domElements.totalTransactions.textContent = '0';
        domElements.topStore.textContent = '-';
        domElements.topCategory.textContent = '-';
        domElements.recentTableBody.innerHTML = '<tr><td colspan="5" class="empty-data">Tidak ada data</td></tr>';
        return;
    }
    
    // Hitung total pengeluaran
    const totalExpense = appState.expenses.reduce((sum, expense) => sum + expense.harga_total, 0);
    domElements.totalExpense.textContent = formatCurrency(totalExpense);
    
    // Hitung total transaksi
    domElements.totalTransactions.textContent = appState.expenses.length;
    
    // Cari toko favorit
    const storeCount = {};
    appState.expenses.forEach(expense => {
        const store = expense.toko || 'Tidak diketahui';
        storeCount[store] = (storeCount[store] || 0) + 1;
    });
    
    const topStore = Object.keys(storeCount).reduce((a, b) => storeCount[a] > storeCount[b] ? a : b, '');
    domElements.topStore.textContent = topStore;
    
    // Cari kategori terbesar (berdasarkan total pengeluaran)
    const categoryTotals = {};
    appState.expenses.forEach(expense => {
        const category = expense.kategori || 'Lainnya';
        categoryTotals[category] = (categoryTotals[category] || 0) + expense.harga_total;
    });
    
    const topCategory = Object.keys(categoryTotals).reduce((a, b) => categoryTotals[a] > categoryTotals[b] ? a : b, '');
    domElements.topCategory.textContent = topCategory;
    
    // Tampilkan transaksi terbaru (5 terbaru)
    const recentExpenses = [...appState.expenses]
        .sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal))
        .slice(0, 5);
    
    if (recentExpenses.length === 0) {
        domElements.recentTableBody.innerHTML = '<tr><td colspan="5" class="empty-data">Tidak ada data</td></tr>';
    } else {
        let html = '';
        recentExpenses.forEach(expense => {
            html += `
                <tr>
                    <td>${formatDate(expense.tanggal)}</td>
                    <td>${expense.nama_barang}</td>
                    <td>${expense.jumlah} ${expense.satuan}</td>
                    <td>${formatCurrency(expense.harga_total)}</td>
                    <td>${expense.toko || '-'}</td>
                </tr>
            `;
        });
        domElements.recentTableBody.innerHTML = html;
    }
    
    // Update chart
    updateCharts();
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
                            if (value >= 1000000) {
                                return 'Rp' + (value / 1000000).toFixed(1) + 'Jt';
                            } else if (value >= 1000) {
                                return 'Rp' + (value / 1000).toFixed(0) + 'Rb';
                            }
                            return 'Rp' + value;
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

// Update charts dengan data terkini
function updateCharts() {
    if (appState.expenses.length === 0) return;
    
    // Data untuk chart harian (7 hari terakhir)
    const last7Days = [];
    const dailyTotals = {};
    
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        last7Days.push(dateStr);
        dailyTotals[dateStr] = 0;
    }
    
    // Hitung total per hari
    appState.expenses.forEach(expense => {
        const expenseDate = expense.tanggal;
        if (dailyTotals.hasOwnProperty(expenseDate)) {
            dailyTotals[expenseDate] += expense.harga_total;
        }
    });
    
    // Format label tanggal
    const labels = last7Days.map(date => {
        const d = new Date(date);
        return d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' });
    });
    
    const dailyData = last7Days.map(date => dailyTotals[date]);
    
    // Update daily chart
    appState.dailyChart.data.labels = labels;
    appState.dailyChart.data.datasets[0].data = dailyData;
    appState.dailyChart.update();
    
    // Data untuk chart kategori
    const categoryTotals = {};
    appState.expenses.forEach(expense => {
        const category = expense.kategori || 'Lainnya';
        categoryTotals[category] = (categoryTotals[category] || 0) + expense.harga_total;
    });
    
    const categoryLabels = Object.keys(categoryTotals);
    const categoryData = Object.values(categoryTotals);
    
    // Update category chart
    appState.categoryChart.data.labels = categoryLabels;
    appState.categoryChart.data.datasets[0].data = categoryData;
    appState.categoryChart.update();
}

// Fungsi untuk memuat data pengeluaran ke tabel
function loadExpenseData() {
    renderExpenseTable();
}

// Fungsi untuk merender tabel pengeluaran
function renderExpenseTable() {
    const startIndex = (appState.currentPageIndex - 1) * appState.itemsPerPage;
    const endIndex = startIndex + appState.itemsPerPage;
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
                    <td>${expense.nama_barang}</td>
                    <td>${expense.jumlah}</td>
                    <td>${expense.satuan}</td>
                    <td>${expense.merk || '-'}</td>
                    <td>${formatCurrency(expense.harga_satuan)}</td>
                    <td>${formatCurrency(expense.harga_total)}</td>
                    <td>${expense.kategori}</td>
                    <td>${expense.toko || '-'}</td>
                    <td class="action-buttons">
                        <button class="edit-btn" onclick="editExpense(${JSON.stringify(String(expense.id))})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="delete-btn" onclick="deleteExpense(${JSON.stringify(String(expense.id))})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
        domElements.expenseTableBody.innerHTML = html;
    }
    
    // Update pagination
    const totalPages = Math.ceil(appState.filteredExpenses.length / appState.itemsPerPage);
    domElements.pageInfo.textContent = `Halaman ${appState.currentPageIndex} dari ${totalPages}`;
    
    domElements.prevPage.disabled = appState.currentPageIndex <= 1;
    domElements.nextPage.disabled = appState.currentPageIndex >= totalPages;
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
    
    appState.currentPageIndex = 1;
    renderExpenseTable();
}

// Fungsi untuk mereset filter
function resetFilters() {
    domElements.filterMonth.value = 'all';
    domElements.filterYear.value = new Date().getFullYear().toString();
    domElements.filterCategory.value = 'all';
    
    appState.filteredExpenses = [...appState.expenses];
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
    const expense = appState.expenses.find(e => e.id === id);
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
    const index = appState.expenses.findIndex(e => e.id === id);
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
        if (CONFIG.API_URL && CONFIG.API_URL.includes('google.com')) {
            try {
                await apiPost('updateExpense', { id: id, data: appState.expenses[index] });
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
    appState.expenses = appState.expenses.filter(e => e.id !== id);
    appState.filteredExpenses = appState.filteredExpenses.filter(e => e.id !== id);
    
    // Simpan ke localStorage
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(appState.expenses));
    
    // Hapus dari Google Sheets jika ada
    if (CONFIG.API_URL && CONFIG.API_URL.includes('google.com')) {
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