const geminiService = require('../services/gemini');
const { extractMediaInfo, downloadMedia } = require('../utils/media');
const sessionManager = require('../services/session');
const logger = require('../utils/logger');
const { getSenderId } = require('../utils/helpers');

/**
 * Menangani interaksi AI Multimodal (Teks, Gambar, Audio PTT, Dokumen)
 */
async function handleAiInteraction(sock, msg, textQuery = '') {
  const chatId = msg.key.remoteJid;
  const senderId = getSenderId(msg);

  // Periksa cooldown anti-spam per user (2 detik jeda)
  if (!sessionManager.checkCooldown(senderId, 1500)) {
    return; // Cegah spam jika user mengirim banyak chat dalam 1.5 detik
  }

  // Tampilkan status "sedang mengetik..." di WhatsApp
  await sock.sendPresenceUpdate('composing', chatId);

  const reply = async (text) => {
    return await sock.sendMessage(chatId, { text }, { quoted: msg });
  };

  try {
    const mediaInfo = extractMediaInfo(msg);

    // ----------------------------------------------------
    // KASUS 1: MEDIA GAMBAR (VISION)
    // ----------------------------------------------------
    if (mediaInfo && mediaInfo.type === 'image') {
      logger.ai(`Memproses gambar dari ${senderId}...`);
      const buffer = await downloadMedia(mediaInfo.message, 'image');
      const prompt = textQuery || mediaInfo.caption || 'Jelaskan gambar ini secara detail dan informatif dalam Bahasa Indonesia.';
      const answer = await geminiService.analyzeImage(chatId, buffer, mediaInfo.mimetype, prompt);
      return await reply(answer);
    }

    // ----------------------------------------------------
    // KASUS 2: MEDIA AUDIO / PESAN SUARA (VOICE NOTE PTT)
    // ----------------------------------------------------
    if (mediaInfo && mediaInfo.type === 'audio') {
      logger.ai(`Memproses pesan suara (audio) dari ${senderId}...`);
      const buffer = await downloadMedia(mediaInfo.message, 'audio');
      const answer = await geminiService.analyzeAudio(chatId, buffer, mediaInfo.mimetype, textQuery);
      return await reply(answer);
    }

    // ----------------------------------------------------
    // KASUS 3: DOKUMEN (PDF, TXT, CODE, CSV, JSON, DLL)
    // ----------------------------------------------------
    if (mediaInfo && mediaInfo.type === 'document') {
      const allowedDocTypes = [
        'application/pdf',
        'text/plain',
        'text/csv',
        'text/html',
        'application/json',
        'application/javascript',
        'text/x-python',
        'text/markdown'
      ];

      // Cek apakah dokumen teks atau pdf
      const isSupportedDoc = allowedDocTypes.some(t => mediaInfo.mimetype.includes(t)) ||
        /\.(pdf|txt|csv|json|js|py|html|md|css)$/i.test(mediaInfo.fileName || '');

      if (isSupportedDoc) {
        logger.ai(`Memproses dokumen (${mediaInfo.fileName}) dari ${senderId}...`);
        const buffer = await downloadMedia(mediaInfo.message, 'document');
        const answer = await geminiService.analyzeDocument(
          chatId,
          buffer,
          mediaInfo.mimetype,
          mediaInfo.fileName,
          textQuery || mediaInfo.caption
        );
        return await reply(answer);
      }
    }

    // ----------------------------------------------------
    // KASUS 4: CHAT TEKS BIASA
    // ----------------------------------------------------
    if (!textQuery) {
      return; // Tidak ada teks atau media yang diproses
    }

    logger.ai(`Menjawab teks dari ${senderId}: "${textQuery.slice(0, 50)}..."`);
    const answer = await geminiService.chat(chatId, textQuery);
    return await reply(answer);

  } catch (err) {
    logger.error('Kesalahan AI:', err.message);

    let userFriendlyError = `❌ *Maaf, terjadi kendala saat memproses permintaan:* \n${err.message}`;

    if (err.message.includes('CONSUMER_SUSPENDED')) {
      userFriendlyError = `🚫 *Project Kunci API Google Ditangguhkan (Suspended)!*
Project Google Cloud yang terkait dengan kunci API ini sedang dibekukan oleh Google.
Solusi: Silakan ganti dengan kunci API Google aktif lainnya di file \`.env\`.`;
    } else if (err.message.includes('401') || err.message.includes('API key not valid')) {
      userFriendlyError = `🔑 *Kunci API Tidak Valid atau Kadaluarsa!*
Google API menolak kunci tersebut. Pastikan kunci API (awalan AQ. atau lainnya) yang Anda masukkan masih aktif.`;
    } else if (err.message.includes('API Key') || err.message.includes('API_KEY')) {
      userFriendlyError = '🔑 *Konfigurasi Gemini API Key belum disetel.* Harap periksa file `.env` di server.';
    } else if (err.message.includes('429') || err.message.includes('Quota')) {
      userFriendlyError = '⏳ *Batas kuota Gemini tercapai (Rate Limit).* Mohon tunggu 1-2 menit sebelum mengirim pesan lagi.';
    }

    return await reply(userFriendlyError);
  } finally {
    // Hentikan status mengetik
    try {
      await sock.sendPresenceUpdate('paused', chatId);
    } catch {}
  }
}

module.exports = { handleAiInteraction };
