# Saechii Whatsapp Bot 🤖

Saechii Whatsapp Bot adalah bot WhatsApp multifungsi yang dibangun menggunakan library `@whiskeysockets/baileys`. Bot ini memiliki berbagai fitur utilitas, downloader, hiburan, dan integrasi AI (Shirokane Rinko Persona).

## 🌟 Fitur Utama

### 🤖 AI Utilities
- **AI Chat (`!ai [pertanyaan]`)**: Tanya jawab dengan AI (One-shot).
- **Auto AI (`!autoai on/off`)**: Mode percakapan berkelanjutan dengan memori konteks (hingga 10 chat terakhir). Menggunakan persona "Shirokane Rinko".

### 📥 Downloaders
- **Instagram (`.dl [link]`)**: Download Postingan/Reels Instagram.
- **YouTube (`.yt [link]`)**: Download video YouTube dengan kualitas terbaik.

### 🛠️ Group & Utilities
- **Tag All (`.tagall`)**: Mention semua member grup (Text terlihat).
- **Hidetag (`.h [teks]`)**: Mention semua member grup (Text transparan/invisible).
- **Sticker (`.s`)**: Convert gambar/video (maks 6 detik) menjadi stiker.
- **Ping (`.ping`)**: Cek status bot.
- **Delete (`.del`)**: Hapus pesan bot.

### 🕵️ Privacy & Security
- **Anti View Once (`.rvo`)**: Mengambil kembali (recover) gambar/video View Once yang sudah dibuka/kadaluarsa.
- **Auto-Save View Once**: Bot otomatis menyimpan media View Once yang masuk ke folder lokal.

## 📂 Struktur Project

```
├── auth_info/          # Sesi login WhatsApp (Baileys)
├── lib/
│   ├── utils.js        # Helper functions (download media, cleanup, etc)
│   └── sticker.js      # Logic konversi sticker
├── rvo_media/          # Folder penyimpanan file View Once
├── handler.js          # Logic utama command bot
├── index.js            # Entry point & connection logic
├── config.js           # Konfigurasi variable
└── ecosystem.config.cjs # Konfigurasi PM2
```

## 🚀 Cara Install & Menjalankan

### Prasyarat
- [Node.js](https://nodejs.org/) (v16 atau lebih baru)
- [FFmpeg](https://ffmpeg.org/) (Wajib untuk fitur stiker)

### Langkah Installasi

1. **Clone/Download Project**
   ```bash
   git clone https://github.com/username/repo-name.git
   cd "Saechii Whatsapp Bot"
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Konfigurasi Environment**
   Buat file `.env` di root folder dan isi konfigurasi berikut:
   ```env
   API_KEY=apikey_kamu_disini
   ```
   > API Key diperlukan untuk fitur AI dan Downloader (menggunakan API Botcahx).

4. **Jalankan Bot**
   
   **Mode Development:**
   ```bash
   npm run dev
   ```
   
   **Mode Production (PM2):**
   ```bash
   npm start
   ```

   **Scan QR Code** yang muncul di terminal menggunakan WhatsApp kamu.

## 📝 Catatan Tambahan
- Folder `rvo_media` dan files sementara di `tmp` akan dibersihkan otomatis setiap 1 jam untuk menghemat penyimpanan.
- Session login tersimpan di folder `auth_info`. Jangan hapus folder ini jika tidak ingin scan ulang.
