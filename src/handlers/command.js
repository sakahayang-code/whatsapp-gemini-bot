const os = require('os');
const config = require('../config');
const geminiService = require('../services/gemini');
const sessionManager = require('../services/session');
const { createSticker, stickerToImage } = require('../services/sticker');
const { textToSpeech } = require('../services/tts');
const { extractMediaInfo, downloadMedia } = require('../utils/media');
const { formatUptime, isOwner, safeEvaluate, searchWikipedia, getSenderId } = require('../utils/helpers');
const logger = require('../utils/logger');

const startTime = Date.now();

/**
 * Memproses perintah yang diawali dengan awalan (prefix)
 */
async function handleCommand(sock, msg, command, args, rawText) {
  const chatId = msg.key.remoteJid;
  const isGroup = chatId.endsWith('@g.us');
  const senderId = getSenderId(msg);

  // Fungsi pembantu untuk membalas pesan secara instan
  const reply = async (text, options = {}) => {
    return await sock.sendMessage(chatId, { text, ...options }, { quoted: msg });
  };

  logger.cmd(senderId, `${config.bot.prefix}${command} ${args.join(' ')}`);

  switch (command.toLowerCase()) {
    // ----------------------------------------------------
    // MENU / HELP
    // ----------------------------------------------------
    case 'menu':
    case 'help': {
      const activeModel = geminiService.getActiveModel();
      const uptimeStr = formatUptime(Math.floor((Date.now() - startTime) / 1000));
      const p = config.bot.prefix;

      const menuText = `╭━━━〔 *${config.bot.name}* 〕━━━
┃ ⚡ *Status Bot:* Online
┃ 🤖 *Model AI:* \`${activeModel}\`
┃ ⏱ *Uptime:* ${uptimeStr}
┃ 🔑 *Prefix:* [ \`${p}\` ]
╰━━━━━━━━━━━━━━━━━━━

*🤖 FITUR GEMINI AI:*
├ • \`${p}ai <pertanyaan>\` : Tanya ke Gemini AI
├ • \`${p}reset\` / \`${p}clear\` : Hapus memori percakapan
├ • \`${p}persona <nama>\` : Ganti karakter AI
│   _Pilihan: assistant, programmer, guru,_
│   _formal, santai, anime_
└ • \`${p}prompt <teks>\` : Set instruksi persona kustom

*📸 MULTIMODAL & MEDIA:*
├ • *Kirim Gambar + Teks* : Analisis foto otomatis
├ • *Kirim Voice Note (PTT)* : Didengarkan & dijawab AI
├ • *Kirim Dokumen (PDF/Code)* : Analisis isi dokumen
├ • \`${p}s\` / \`${p}sticker\` : Buat stiker dari foto/video
├ • \`${p}toimg\` : Ubah stiker kembali jadi foto (reply stiker)
└ • \`${p}tts <teks>\` : Ubah teks jadi audio voice note

*👥 GRUP & UTILITAS:*
├ • \`${p}ai on\` / \`${p}ai off\` : Toggle AI aktif di grup
├ • \`${p}calc <rumus>\` : Kalkulator hitung cepat
├ • \`${p}wiki <kata kunci>\` : Cari info ensiklopedia
├ • \`${p}ping\` : Cek latency respon bot
└ • \`${p}status\` : Informasi server dan statistik bot

*👑 OWNER & KONTROL:*
├ • \`${p}setmodel <nama>\` : Ganti model Gemini secara instan
└ • \`${p}broadcast <pesan>\` : Kirim pesan siaran

_💡 Tip: Anda bisa langsung mengobrol di chat pribadi tanpa awalan prefix!_`;

      return await reply(menuText);
    }

    // ----------------------------------------------------
    // PING & STATUS
    // ----------------------------------------------------
    case 'ping': {
      const start = Date.now();
      const sent = await reply('🏓 *Pong!* Mengukur kecepatan...');
      const latency = Date.now() - start;
      const uptimeStr = formatUptime(Math.floor((Date.now() - startTime) / 1000));
      return await sock.sendMessage(chatId, {
        text: `🏓 *Pong!*\n⚡ Latency: *${latency} ms*\n⏱ Aktif sejak: *${uptimeStr}*`,
        edit: sent.key
      });
    }

    case 'status': {
      const uptimeStr = formatUptime(Math.floor((Date.now() - startTime) / 1000));
      const stats = sessionManager.getStats();
      const memUsage = process.memoryUsage();
      const ramUsedMb = Math.round(memUsage.rss / 1024 / 1024);
      const totalMemMb = Math.round(os.totalmem() / 1024 / 1024);
      const freeMemMb = Math.round(os.freemem() / 1024 / 1024);

      const statusText = `📊 *STATISTIK BOT WHATSAPP*
━━━━━━━━━━━━━━━━━━
🤖 *Model Gemini:* \`${geminiService.getActiveModel()}\`
⏱ *Uptime:* ${uptimeStr}
💬 *Sesi Obrolan Aktif:* ${stats.activeSessions}
🎭 *Persona Kustom:* ${stats.customPrompts}
👥 *Grup Dimonitor:* ${stats.groupsMonitored}
💾 *RAM Digunakan:* ${ramUsedMb} MB / ${totalMemMb} MB (Sisa: ${freeMemMb} MB)
🖥 *Platform:* ${os.type()} ${os.release()} (${os.arch()})
Node.js: ${process.version}`;

      return await reply(statusText);
    }

    // ----------------------------------------------------
    // GEMINI MEMORY & PERSONA
    // ----------------------------------------------------
    case 'reset':
    case 'clear': {
      geminiService.resetChat(chatId);
      return await reply('🧹 *Memori percakapan telah dibersihkan!* Gemini siap memulai topik baru.');
    }

    case 'persona': {
      const chosen = args[0]?.toLowerCase();
      if (!chosen) {
        return await reply(`Pilihan persona yang tersedia:\n• \`assistant\` (default ramah)\n• \`programmer\` (ahli coding)\n• \`guru\` (sabar & edukatif)\n• \`formal\` (baku & profesional)\n• \`santai\` (gaul & asik)\n• \`anime\` (waifu ceria)\n\nContoh: *${config.bot.prefix}persona programmer*`);
      }

      const success = geminiService.setPersona(chatId, chosen);
      if (success) {
        return await reply(`🎭 *Persona berhasil diubah ke: ${chosen}!*\nRiwayat obrolan telah disesuaikan.`);
      } else {
        return await reply(`❌ Persona *${chosen}* tidak dikenal. Ketik *${config.bot.prefix}persona* untuk melihat daftar.`);
      }
    }

    case 'prompt':
    case 'customprompt': {
      const customPrompt = args.join(' ').trim();
      if (!customPrompt) {
        const current = sessionManager.getCustomPrompt(chatId);
        return await reply(current
          ? `📝 *Prompt kustom saat ini:*\n_"${current}"_\n\nKetik \`${config.bot.prefix}prompt reset\` untuk kembali ke default.`
          : `Gunakan perintah ini untuk mengatur instruksi sistem khusus untuk obrolan ini.\nContoh: *${config.bot.prefix}prompt Jawablah seperti detektif Sherlock Holmes.*`
        );
      }

      if (customPrompt.toLowerCase() === 'reset') {
        sessionManager.setCustomPrompt(chatId, null);
        return await reply('🔄 *Prompt kustom telah direset ke default Gemini Assistant.*');
      }

      sessionManager.setCustomPrompt(chatId, customPrompt);
      sessionManager.clearHistory(chatId);
      return await reply(`✅ *Prompt kustom berhasil disimpan!*\nGemini akan mengikuti panduan ini.`);
    }

    // ----------------------------------------------------
    // STICKER MAKER (.s / .sticker) & TOIMG
    // ----------------------------------------------------
    case 's':
    case 'sticker':
    case 'stiker': {
      const mediaInfo = extractMediaInfo(msg);
      if (!mediaInfo || (mediaInfo.type !== 'image' && mediaInfo.type !== 'video')) {
        return await reply(`📸 *Kirim atau balas (reply) foto/video/GIF* dengan caption *${config.bot.prefix}s* untuk membuat stiker WhatsApp!`);
      }

      if (mediaInfo.type === 'video' && mediaInfo.seconds > 10) {
        return await reply('⚠ Durasi video maksimal untuk stiker bergerak adalah 10 detik!');
      }

      try {
        await sock.sendPresenceUpdate('composing', chatId);
        const buffer = await downloadMedia(mediaInfo.message, mediaInfo.type);

        const customPack = args[0] ? args.slice(0, 2).join(' ') : config.sticker.packName;
        const customAuthor = args[2] ? args.slice(2).join(' ') : config.sticker.authorName;

        const stickerBuffer = await createSticker(
          buffer,
          mediaInfo.type === 'video',
          customPack,
          customAuthor
        );

        return await sock.sendMessage(chatId, { sticker: stickerBuffer }, { quoted: msg });
      } catch (err) {
        logger.error('Error membuat stiker:', err);
        return await reply(`❌ Gagal membuat stiker: ${err.message}`);
      }
    }

    case 'toimg': {
      const mediaInfo = extractMediaInfo(msg);
      if (!mediaInfo || mediaInfo.type !== 'sticker') {
        return await reply(`🖼 Balas (reply) sebuah stiker dengan perintah *${config.bot.prefix}toimg* untuk mengubahnya menjadi gambar.`);
      }

      try {
        await sock.sendPresenceUpdate('composing', chatId);
        const stickerBuf = await downloadMedia(mediaInfo.message, 'sticker');
        const imgBuf = await stickerToImage(stickerBuf);
        return await sock.sendMessage(chatId, { image: imgBuf, caption: '✨ Berhasil diubah ke gambar.' }, { quoted: msg });
      } catch (err) {
        logger.error('Error toimg:', err);
        return await reply(`❌ Gagal mengubah stiker: ${err.message}`);
      }
    }

    // ----------------------------------------------------
    // TTS (TEXT TO SPEECH)
    // ----------------------------------------------------
    case 'tts': {
      const text = args.join(' ').trim();
      if (!text) {
        return await reply(`Gunakan: *${config.bot.prefix}tts <teks>*\nContoh: *${config.bot.prefix}tts Halo selamat pagi semuanya*`);
      }

      try {
        await sock.sendPresenceUpdate('recording', chatId);
        const audioBuffer = await textToSpeech(text, 'id');
        return await sock.sendMessage(chatId, {
          audio: audioBuffer,
          mimetype: 'audio/mp4',
          ptt: true
        }, { quoted: msg });
      } catch (err) {
        logger.error('Error TTS:', err);
        return await reply(`❌ Gagal membuat suara: ${err.message}`);
      }
    }

    // ----------------------------------------------------
    // GROUP AI CONTROL
    // ----------------------------------------------------
    case 'ai': {
      const sub = args[0]?.toLowerCase();
      if (sub === 'on') {
        sessionManager.setGroupAi(chatId, true);
        return await reply('🤖 *AI di grup ini sekarang AKTIF!*');
      } else if (sub === 'off') {
        sessionManager.setGroupAi(chatId, false);
        return await reply('💤 *AI di grup ini dinonaktifkan.* (Gunakan perintah prefix jika ingin berinteraksi)');
      }

      // Jika user menulis '.ai <pertanyaan>', teruskan ke AI
      const query = args.join(' ').trim();
      if (query) {
        return 'DELEGATE_TO_AI';
      }

      return await reply(`Gunakan:\n• \`${config.bot.prefix}ai on\` : Aktifkan AI di grup\n• \`${config.bot.prefix}ai off\` : Matikan AI di grup\n• \`${config.bot.prefix}ai <pertanyaan>\` : Tanya AI`);
    }

    // ----------------------------------------------------
    // CALCULATOR & WIKIPEDIA
    // ----------------------------------------------------
    case 'calc':
    case 'hitung': {
      const expr = args.join(' ');
      if (!expr) {
        return await reply(`Gunakan: *${config.bot.prefix}calc <rumus>*\nContoh: *${config.bot.prefix}calc (25 * 4) + 150 / 3*`);
      }

      try {
        const result = safeEvaluate(expr);
        return await reply(`🧮 *Hasil Perhitungan:*\n\`${expr}\` = *${result}*`);
      } catch (err) {
        return await reply(`❌ Perhitungan gagal: ${err.message}`);
      }
    }

    case 'wiki': {
      const query = args.join(' ').trim();
      if (!query) {
        return await reply(`Gunakan: *${config.bot.prefix}wiki <kata kunci>*\nContoh: *${config.bot.prefix}wiki Kecerdasan buatan*`);
      }

      await reply(`🔍 Mencari informasi tentang *"${query}"* di Wikipedia...`);
      const wiki = await searchWikipedia(query);
      if (wiki) {
        return await reply(`📚 *${wiki.title}*\n\n${wiki.extract}\n\n🔗 _Baca selengkapnya: ${wiki.url}_`);
      } else {
        return await reply(`❌ Maaf, artikel tentang *"${query}"* tidak ditemukan di Wikipedia.`);
      }
    }

    // ----------------------------------------------------
    // OWNER COMMANDS
    // ----------------------------------------------------
    case 'setmodel': {
      if (!isOwner(msg)) {
        return await reply('🚫 Perintah ini hanya dapat digunakan oleh Owner bot!');
      }

      const newModel = args[0]?.trim();
      if (!newModel) {
        return await reply(`Model saat ini: *${geminiService.getActiveModel()}*\nContoh: *${config.bot.prefix}setmodel gemini-3.8-flash-high* atau *gemini-2.0-flash*`);
      }

      geminiService.setModel(newModel);
      return await reply(`✅ *Model Gemini berhasil diubah ke: ${newModel}*`);
    }

    case 'broadcast':
    case 'bc': {
      if (!isOwner(msg)) {
        return await reply('🚫 Perintah ini hanya dapat digunakan oleh Owner bot!');
      }

      const bcText = args.join(' ').trim();
      if (!bcText) {
        return await reply(`Gunakan: *${config.bot.prefix}broadcast <pesan>*`);
      }

      const sessions = Array.from(sessionManager.histories.keys());
      let successCount = 0;
      for (const targetId of sessions) {
        try {
          await sock.sendMessage(targetId, {
            text: `📢 *SIARAN DARI OWNER BOT:*\n\n${bcText}`
          });
          successCount++;
        } catch {}
      }

      return await reply(`✅ Berhasil mengirim siaran ke *${successCount}* obrolan.`);
    }

    default:
      // Perintah tidak dikenal, biarkan atau respons jika perlu
      return null;
  }
}

module.exports = { handleCommand };
