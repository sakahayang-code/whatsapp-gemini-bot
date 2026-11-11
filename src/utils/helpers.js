const axios = require('axios');
const config = require('../config');

/**
 * Ekstraksi teks pesan lengkap dari payload Baileys
 */
function getMessageText(msg) {
  if (!msg.message) return '';

  let message = msg.message;
  if (message.ephemeralMessage) message = message.ephemeralMessage.message;
  if (message.viewOnceMessage) message = message.viewOnceMessage.message;
  if (message.viewOnceMessageV2) message = message.viewOnceMessageV2.message;

  return (
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    message.documentMessage?.caption ||
    ''
  ).trim();
}

/**
 * Ekstraksi sender ID bersih (tanpa domain @s.whatsapp.net)
 */
function getSenderId(msg) {
  const jid = msg.key.participant || msg.key.remoteJid || '';
  return jid.replace(/@.+/, '');
}

/**
 * Cek apakah sender adalah owner bot
 */
function isOwner(msg) {
  const sender = getSenderId(msg);
  if (config.bot.ownerNumbers.length === 0) return true; // jika tidak disetel, izinkan
  return config.bot.ownerNumbers.some(num => sender.includes(num));
}

/**
 * Format detik menjadi format waktu yang mudah dibaca (H m s)
 */
function formatUptime(uptimeSeconds) {
  const days = Math.floor(uptimeSeconds / (3600 * 24));
  const hours = Math.floor((uptimeSeconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = Math.floor(uptimeSeconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}h`);
  if (hours > 0) parts.push(`${hours}j`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}d`);

  return parts.join(' ');
}

/**
 * Evaluasi ekspresi matematika sederhana secara aman
 */
function safeEvaluate(expression) {
  const sanitized = expression.replace(/[^0-9+\-*/().^%]/g, '');
  if (!sanitized) throw new Error('Ekspresi matematika tidak valid');

  // Menggunakan Function constructor dengan lingkungan terbatas
  const fn = new Function(`return (${sanitized});`);
  const result = fn();
  if (typeof result !== 'number' || isNaN(result)) {
    throw new Error('Hasil perhitungan tidak valid');
  }
  return result;
}

/**
 * Cari ringkasan Wikipedia bahasa Indonesia
 */
async function searchWikipedia(query) {
  try {
    const url = `https://id.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'WhatsAppGeminiBot/1.0' },
      timeout: 8000
    });
    if (response.data && response.data.extract) {
      return {
        title: response.data.title,
        extract: response.data.extract,
        url: response.data.content_urls?.desktop?.page || ''
      };
    }
  } catch (e) {
    // Coba versi bahasa Inggris jika ID tidak ditemukan
    try {
      const urlEn = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
      const responseEn = await axios.get(urlEn, {
        headers: { 'User-Agent': 'WhatsAppGeminiBot/1.0' },
        timeout: 8000
      });
      if (responseEn.data && responseEn.data.extract) {
        return {
          title: responseEn.data.title,
          extract: responseEn.data.extract,
          url: responseEn.data.content_urls?.desktop?.page || ''
        };
      }
    } catch {}
  }
  return null;
}

module.exports = {
  getMessageText,
  getSenderId,
  isOwner,
  formatUptime,
  safeEvaluate,
  searchWikipedia
};
