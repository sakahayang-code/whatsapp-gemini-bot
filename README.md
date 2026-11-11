# 🤖 WhatsApp AI Bot - Ditenagai Gemini 3.8 Flash High ⚡

Bot WhatsApp pintar, cepat, dan serba bisa (*Full-Featured*) yang ditenagai oleh **Google Gemini AI** (dengan model default **Gemini 3.8 Flash High** dan fitur *auto-fallback* ke Gemini 2.0 / 1.5 Flash). Dibangun menggunakan arsitektur modern **@whiskeysockets/baileys** tanpa browser headless (sangat hemat RAM dan CPU).

---

## 🌟 Fitur Utama (Full-Featured)

### 🧠 1. Kemampuan Multimodal Gemini AI
* **Chat Interaktif Berkelanjutan (Memori Konteks):** Mengingat riwayat percakapan sebelumnya (*multi-turn conversation*) untuk setiap pengguna atau grup.
* **Analisis Gambar (Vision / OCR):** Kirim foto atau balas gambar dengan pertanyaan, Gemini akan menganalisis objek, teks, diagram, tulisan tangan, atau memecahkan soal matematika di foto.
* **Pemahaman Pesan Suara (Voice Note / PTT):** Kirim pesan suara (VN) langsung dari WhatsApp. Gemini akan mendengarkan, mentranskripsikan, dan memberikan jawaban cerdas.
* **Analisis Dokumen:** Mampu membaca dan merangkum file PDF, teks (`.txt`), kode sumber (`.js`, `.py`, dll), CSV, dan JSON.
* **Persona & Karakter Fleksibel:** Ganti gaya kepribadian AI secara instan (`.persona assistant`, `programmer`, `guru`, `formal`, `santai`, `anime`).
* **Sistem Prompt Kustom:** Atur instruksi khusus untuk obrolan Anda (`.prompt <instruksi>`).
* **Model Switcher & Auto-Fallback:** Mendukung pergantian model secara dinamis (`.setmodel <nama_model>`), serta failover otomatis jika model utama belum tersedia atau limit.
* **Multi-API Key Failover:** Masukkan beberapa API key Gemini sekaligus; bot akan otomatis berganti kunci jika salah satu terkena limit (*Rate Limit 429*).

### 🎨 2. Fitur Media & Utilitas WhatsApp
* **Pembuat Stiker Otomatis (`.s` / `.sticker`):** Ubah foto, video pendek (maks 10 detik), atau animasi GIF menjadi stiker WhatsApp berkualitas tinggi lengkap dengan metadata Pack & Author.
* **Stiker ke Gambar (`.toimg`):** Ubah stiker WhatsApp kembali menjadi gambar biasa.
* **Text-to-Speech Voice Note (`.tts <teks>`):** Mengubah teks menjadi rekaman suara WhatsApp (VN) dalam Bahasa Indonesia.
* **Kalkulator Matematika (`.calc <rumus>`):** Perhitungan matematika cepat dan aman.
* **Ensiklopedia Wikipedia (`.wiki <topik>`):** Pencarian ringkasan materi langsung dari Wikipedia.

### 👥 3. Manajemen Grup & Interaksi Cerdas
* **Anti-Spam di Grup:** Di grup WhatsApp, bot hanya merespons saat di-mention (`@bot`), di-reply, atau menggunakan prefix (`.ai`), sehingga obrolan grup tetap kondusif.
* **Saklar AI Grup (`.ai on` / `.ai off`):** Nyalakan atau matikan respon AI di grup tertentu.
* **Auto-Reply Chat Pribadi (DM):** Di obrolan pribadi, bot otomatis merespons langsung tanpa perlu mengetik awalan prefix.
* **Indikator Sedang Mengetik (Typing Presence):** Bot menampilkan status "sedang mengetik..." atau "merekam audio..." secara nyata saat memproses jawaban.

### 🔐 4. Penautan Mudah (Dual Pairing Mode)
* **Mode QR Code:** Tampilkan QR Code di terminal dan pindai menggunakan WhatsApp ponsel.
* **Mode Pairing Code (8-Digit):** Cukup masukkan nomor HP di `.env`, bot akan menampilkan kode 8-digit (misal: `ABCD-1234`) untuk ditautkan di WhatsApp > Perangkat Tertaut > Tautkan dengan nomor telepon (sangat cocok untuk VPS/Cloud headless).

---

## 📋 Struktur Folder

```
whatsapp-gemini-bot/
├── .env.example             # Contoh template konfigurasi
├── .env                     # File konfigurasi utama (API key, mode pairing, dll)
├── package.json             # Dependensi dan script npm
├── README.md                # Dokumentasi lengkap
├── src/
│   ├── index.js             # Entry point utama, koneksi Baileys & pairing
│   ├── config.js            # Pusat konfigurasi bot
│   ├── services/
│   │   ├── gemini.js        # Engine integrasi Google Gemini AI & multimodal
│   │   ├── sticker.js       # Pembuat stiker WebP & konversi EXIF (FFmpeg)
│   │   ├── session.js       # Manajemen memori riwayat chat & sesi aktif
│   │   └── tts.js           # Layanan Google Text-to-Speech
│   ├── handlers/
│   │   ├── message.js       # Dispatcher pesan masuk WhatsApp
│   │   ├── command.js       # Router perintah bot (.menu, .s, .status, dll)
│   │   └── aiHandler.js     # Logika penanganan input multimodal AI
│   └── utils/
│       ├── logger.js        # Logger terminal berwarna (Chalk)
│       ├── media.js         # Pengunduh & ekstraktor media Baileys
│       └── helpers.js       # Fungsi pembantu (uptime, math, wiki)
└── test/
    └── bot.test.js          # Unit testing pengujian modul
```

---

## 🚀 Panduan Instalasi & Menjalankan Bot

### 1. Prasyarat Sistem
* **Node.js**: Versi 18 atau lebih baru (`node -v`)
* **FFmpeg**: Terpasang di sistem untuk konversi media & stiker (`ffmpeg -version`)

*(Di Ubuntu/Debian, pasang ffmpeg dengan: `sudo apt update && sudo apt install -y ffmpeg`)*

### 2. Kloning / Masuk ke Direktori
```bash
cd /home/antigravity/whatsapp-gemini-bot
```

### 3. Pasang Dependensi
```bash
npm install
```

### 4. Dapatkan Gemini API Key
1. Buka [Google AI Studio](https://aistudio.google.com/).
2. Masuk menggunakan akun Google Anda.
3. Klik tombol **Get API key** lalu klik **Create API key**.
4. Salin kunci API yang didapatkan.

### 5. Atur Konfigurasi `.env`
Buka file `.env` dan masukkan API Key serta preferensi Anda:
```env
# Masukkan API Key Gemini Anda di sini
GEMINI_API_KEY=AIzaSyAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Model default yang diinginkan
GEMINI_MODEL=gemini-3.8-flash-high

# Atur nomor WhatsApp Owner (tanpa +, misal: 6281234567890)
OWNER_NUMBER=6281234567890

# METODE TAUTAN (PILIH SALAH SATU):
# Opsi 1: Scan QR Code di Terminal
USE_PAIRING_CODE=false

# Opsi 2: Menggunakan Kode Tautan 8 Digit (Tanpa Scan QR)
# USE_PAIRING_CODE=true
# PAIRING_NUMBER=6281234567890
```

### 6. Jalankan Bot
```bash
npm start
```

* **Jika menggunakan QR Code:** Arahkan kamera WhatsApp Anda ke terminal.
* **Jika menggunakan Pairing Code:** Masukkan 8 karakter kode yang muncul di terminal ke aplikasi WhatsApp di ponsel Anda (*Perangkat Tertaut > Tautkan Perangkat > Tautkan dengan nomor telepon saja*).

---

## 📖 Daftar Perintah (Commands)

| Perintah | Deskripsi | Contoh |
| :--- | :--- | :--- |
| `.menu` / `.help` | Menampilkan daftar semua fitur & panduan bot | `.menu` |
| `.ai <pertanyaan>` | Bertanya langsung ke Gemini AI | `.ai Jelaskan apa itu quantum computing` |
| `.reset` / `.clear` | Menghapus riwayat ingatan obrolan agar mulai baru | `.reset` |
| `.persona <nama>` | Ganti karakter/gaya bicara AI (`assistant`, `programmer`, `guru`, `formal`, `santai`, `anime`) | `.persona programmer` |
| `.prompt <teks>` | Mengatur instruksi sistem kustom untuk chat Anda | `.prompt Jawab dengan gaya humoris` |
| `.s` / `.sticker` | Buat stiker dari foto/video yang dikirim atau di-reply | Kirim foto dengan caption `.s` |
| `.toimg` | Mengubah stiker kembali menjadi foto | Reply stiker dengan `.toimg` |
| `.tts <teks>` | Mengubah teks menjadi pesan suara WhatsApp (VN) | `.tts Halo selamat pagi semuanya` |
| `.calc <rumus>` | Menghitung persamaan matematika | `.calc (45 * 2) + 150 / 3` |
| `.wiki <query>` | Mencari ensiklopedia Wikipedia | `.wiki Albert Einstein` |
| `.ai on` / `.ai off`| Mengaktifkan atau mematikan AI di grup | `.ai on` |
| `.ping` | Memeriksa latency dan kecepatan respon bot | `.ping` |
| `.status` | Melihat model aktif, konsumsi RAM, dan uptime | `.status` |
| `.setmodel <model>` | *(Owner)* Mengubah model Gemini secara instan | `.setmodel gemini-2.0-flash` |
| `.broadcast <pesan>`| *(Owner)* Mengirim pesan siaran ke semua obrolan | `.broadcast Pengumuman pemeliharaan server` |

---

## 🛠 Menjalankan di Latar Belakang (24/7 Server / VPS)

Gunakan **PM2** agar bot tetap berjalan secara otomatis meskipun terminal ditutup atau server melakukan restart:

```bash
# Pasang PM2 secara global
npm install -g pm2

# Jalankan bot dengan nama 'wa-gemini'
pm2 start src/index.js --name "wa-gemini"

# Cek log bot
pm2 logs wa-gemini

# Simpan agar otomatis hidup saat reboot
pm2 save
pm2 startup
```

---

## 🛡 Tips & Pemecahan Masalah (Troubleshooting)

1. **Model 'gemini-3.8-flash-high' Not Found:**
   * Bot memiliki mekanisme *smart auto-fallback*. Jika model yang diminta belum dibuka secara publik pada endpoint v1beta akun Anda, bot akan otomatis beralih ke `gemini-2.0-flash` atau `gemini-1.5-flash` tanpa menghentikan layanan.
2. **Rate Limit / Kuota Gemini Habis:**
   * Anda dapat memasukkan beberapa API key di `.env` dipisahkan tanda koma:
     `GEMINI_API_KEY=key_pertama,key_kedua,key_ketiga`
   * Bot akan otomatis merotasi kunci jika mendeteksi error *429 ResourceExhausted*.
3. **Sesi WhatsApp Terputus (Logged Out):**
   * Hapus folder `auth_info_baileys` dan jalankan kembali `npm start` untuk menautkan ulang.

---

## 📜 Lisensi
Proyek ini dibuat untuk tujuan edukasi dan pengembangan asisten AI interaktif. Bebas digunakan dan dikembangkan kembali.
