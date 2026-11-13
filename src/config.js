const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Muat .env utama
dotenv.config();

// Fallback otomatis: jika GEMINI_API_KEY tidak ada di .env, muat dari .env.example
if (!process.env.GEMINI_API_KEY) {
  const examplePath = path.resolve(process.cwd(), '.env.example');
  if (fs.existsSync(examplePath)) {
    dotenv.config({ path: examplePath });
  }
}

const config = {
  // Gemini Configuration
  gemini: {
    // Mendukung satu atau beberapa API key dipisahkan koma untuk failover otomatis
    apiKeys: (process.env.GEMINI_API_KEY || '')
      .split(',')
      .map(k => k.trim())
      .filter(Boolean),
    // Model yang diminta: Hanya gunakan gemini-3.8-flash secara eksklusif
    model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
    // Tidak ada fallback ke model usang (1.5/2.0) yang sudah 404 Not Found
    fallbackModels: [],
    maxHistory: parseInt(process.env.MAX_HISTORY_LENGTH || '20', 10),
    temperature: parseFloat(process.env.GEMINI_TEMPERATURE || '0.7'),
    topP: parseFloat(process.env.GEMINI_TOP_P || '0.95'),
    topK: parseInt(process.env.GEMINI_TOP_K || '40', 10),
    maxOutputTokens: parseInt(process.env.GEMINI_MAX_TOKENS || '2048', 10),
    systemInstruction: process.env.SYSTEM_PROMPT || `Kamu adalah Asisten AI WhatsApp pintar, ramah, dan serba bisa yang ditenagai oleh Google Gemini AI.
Karakteristik & Panduan Respons:
1. Jawablah selalu dalam Bahasa Indonesia yang ramah, santai tapi sopan, mudah dipahami, dan relevan (sesuaikan bahasa jika pengguna berbahasa lain).
2. Format teks untuk WhatsApp:
   - Gunakan *tebal* (bintang) untuk poin penting/judul.
   - Gunakan _miring_ (garis bawah) untuk istilah asing atau penekanan halus.
   - Gunakan \`\`\`kode blok\`\`\` untuk kode pemrograman.
   - Gunakan emoji secukupnya agar chat hidup dan menyenangkan ✨.
3. Bantu pengguna menjawab pertanyaan, menganalisis gambar, memahami pesan suara, membaca dokumen, coding, kalkulasi matematika, hingga saran sehari-hari.
4. Jawab secara ringkas, padat, dan akurat agar nyaman dibaca di layar ponsel.`
  },

  // Bot Information
  bot: {
    name: process.env.BOT_NAME || 'Gemini 3.8 Flash AI',
    prefix: process.env.BOT_PREFIX || '.',
    ownerNumbers: (process.env.OWNER_NUMBER || '')
      .split(',')
      .map(n => n.replace(/[^0-9]/g, ''))
      .filter(Boolean),
    // Mode auto-reply di chat pribadi (DM)
    dmAutoReply: process.env.DM_AUTO_REPLY !== 'false',
    // Mode reply di grup: 'mention' (hanya jika di-tag), 'prefix' (hanya perintah), 'all' (semua chat jika AI ON)
    groupReplyMode: process.env.GROUP_REPLY_MODE || 'mention',
    // Session path
    sessionDir: process.env.SESSION_DIR || './auth_info_baileys',
  },

  // Connection Options
  connection: {
    usePairingCode: process.env.USE_PAIRING_CODE === 'true',
    pairingNumber: (process.env.PAIRING_NUMBER || '').replace(/[^0-9]/g, ''),
    browserName: ['Gemini 3.8 Flash', 'Chrome', '120.0.0']
  },

  // Sticker metadata default
  sticker: {
    packName: process.env.STICKER_PACK || 'Gemini AI Bot',
    authorName: process.env.STICKER_AUTHOR || 'Powered by Gemini'
  }
};

module.exports = config;
