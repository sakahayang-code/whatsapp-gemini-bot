const googleTTS = require('google-tts-api');
const logger = require('../utils/logger');

/**
 * Menghasilkan buffer audio MP3 / PTT dari teks
 */
async function textToSpeech(text, lang = 'id') {
  try {
    const cleanText = text.slice(0, 500); // batasi panjang teks
    if (cleanText.length <= 200) {
      const base64 = await googleTTS.getAudioBase64(cleanText, {
        lang: lang,
        slow: false,
        host: 'https://translate.google.com',
        timeout: 10000
      });
      return Buffer.from(base64, 'base64');
    } else {
      const results = await googleTTS.getAllAudioBase64(cleanText, {
        lang: lang,
        slow: false,
        host: 'https://translate.google.com',
        timeout: 10000
      });
      const buffers = results.map(r => Buffer.from(r.base64, 'base64'));
      return Buffer.concat(buffers);
    }
  } catch (err) {
    logger.error('Gagal membuat Text-to-Speech:', err.message);
    throw err;
  }
}

module.exports = {
  textToSpeech
};
