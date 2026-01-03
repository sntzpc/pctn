==================================================
APLIKASI PENCATATAN PENGELUARAN KELUARGA
==================================================

DESKRIPSI:
Aplikasi web untuk mencatat pengeluaran keluarga dengan fitur:
1. Input data melalui rekaman suara (AI transcription)
2. Input data manual
3. Dashboard laporan visual
4. Export data ke Excel
5. Backend menggunakan Google Apps Script dan Google Sheets

STRUKTUR FILE:
1. index.html      -> Halaman utama aplikasi
2. style.css       -> Styling tampilan
3. script.js       -> Logika aplikasi frontend
4. appsscript.js   -> Backend Google Apps Script
5. README.txt      -> Instruksi ini

CARA MENGGUNAKAN:

A. DEPLOY FRONTEND (3 pilihan):
   1. Hosting Lokal: Buka index.html langsung di browser
   2. Hosting Gratis: Upload ke GitHub Pages, Netlify, atau Vercel
   3. Hosting Sendiri: Upload ke server web Anda

B. SETUP BACKEND (Google Apps Script):
   1. Buka https://script.google.com/
   2. Buat project baru
   3. Ganti kode default dengan isi file appsscript.js
   4. Ganti SPREADSHEET_ID dengan ID spreadsheet Anda
   5. Deploy sebagai Web App:
      - Publish > Deploy as web app
      - Set "Execute as" to "Me"
      - Set "Who has access" to "Anyone"
      - Klik Deploy
   6. Salin URL Web App yang dihasilkan

C. KONFIGURASI APLIKASI:
   1. Buka file script.js
   2. Cari baris: const API_URL = 'https://script.google.com/macros/s/AKfycby.../exec'
   3. Ganti dengan URL Web App Anda dari langkah B5

D. SETUP SPREADSHEET:
   1. Buat Google Sheet baru
   2. Dapatkan ID dari URL: https://docs.google.com/spreadsheets/d/ID_HERE/edit
   3. Tambahkan sheet bernama "Pengeluaran"
   4. Atau biarkan aplikasi membuatnya otomatis

FITUR APLIKASI:

1. DASHBOARD:
   - Ringkasan pengeluaran bulan ini
   - Chart pengeluaran 7 hari terakhir
   - Chart pengeluaran per kategori
   - Transaksi terbaru

2. INPUT SUARA:
   - Rekam pembelian dengan mikrofon
   - AI akan mentranskripsi dan parsing otomatis
   - Preview audio sebelum diproses
   - Form otomatis terisi

3. INPUT MANUAL:
   - Form input lengkap
   - Validasi data
   - Kalkulasi otomatis total harga

4. DATA PENGELUARAN:
   - Tabel semua transaksi
   - Filter berdasarkan bulan, tahun, kategori
   - Pagination
   - Edit dan hapus data

5. EXPORT DATA:
   - Export berdasarkan periode
   - Export dengan filter
   - Export semua data
   - Format file: Excel (.xlsx)

CATATAN PENTING:

1. Rekaman suara menggunakan Web Audio API, hanya bekerja di browser modern
2. AI transcription saat ini menggunakan simulasi, untuk produksi perlu integrasi dengan API seperti Google Speech-to-Text atau OpenAI Whisper
3. Aplikasi menyimpan data sementara di localStorage sebagai fallback
4. Untuk transkripsi suara yang lebih akurat, modifikasi fungsi processAudio() untuk mengirim audio ke API sebenarnya

PENGEMBANGAN LANJUTAN:

1. Integrasi API Speech-to-Text sebenarnya
2. Autentikasi pengguna
3. Multi-user dengan data terpisah
4. Notifikasi budget
5. Import data dari bank/ewallet
6. Mobile app versi

TROUBLESHOOTING:

1. Mikrofon tidak berfungsi: Periksa izin browser
2. Data tidak tersimpan: Periksa koneksi internet dan API_URL
3. Export tidak bekerja: Periksa library XLSX terload
4. Chart tidak muncul: Periksa library Chart.js terload

VERSI: 1.0.0
UPDATE: Mei 2024
PENGEMBANG: Expense Tracker Team
==================================================