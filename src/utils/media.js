const { downloadContentFromMessage, getContentType } = require('@whiskeysockets/baileys');
const logger = require('./logger');

/**
 * Ekstraksi informasi media baik dari pesan langsung maupun dari pesan yang di-quote (reply)
 */
function extractMediaInfo(msg) {
  if (!msg.message) return null;

  let message = msg.message;

  // Tangani ephemeral atau viewOnce wrapper
  if (message.ephemeralMessage) {
    message = message.ephemeralMessage.message;
  }
  if (message.viewOnceMessage) {
    message = message.viewOnceMessage.message;
  }
  if (message.viewOnceMessageV2) {
    message = message.viewOnceMessageV2.message;
  }

  const type = getContentType(message);

  // Cek apakah pesan langsung berisi media
  if (type === 'imageMessage') {
    return {
      message: message.imageMessage,
      type: 'image',
      mimetype: message.imageMessage.mimetype || 'image/jpeg',
      caption: message.imageMessage.caption || ''
    };
  }

  if (type === 'videoMessage') {
    return {
      message: message.videoMessage,
      type: 'video',
      mimetype: message.videoMessage.mimetype || 'video/mp4',
      caption: message.videoMessage.caption || '',
      seconds: message.videoMessage.seconds || 0
    };
  }

  if (type === 'audioMessage') {
    return {
      message: message.audioMessage,
      type: 'audio',
      mimetype: message.audioMessage.mimetype || 'audio/ogg; codecs=opus',
      ptt: !!message.audioMessage.ptt
    };
  }

  if (type === 'documentMessage') {
    return {
      message: message.documentMessage,
      type: 'document',
      mimetype: message.documentMessage.mimetype || 'application/octet-stream',
      fileName: message.documentMessage.fileName || 'document',
      caption: message.documentMessage.caption || ''
    };
  }

  if (type === 'stickerMessage') {
    return {
      message: message.stickerMessage,
      type: 'sticker',
      mimetype: 'image/webp'
    };
  }

  // Cek pesan yang di-quote / reply
  const contextInfo = message[type]?.contextInfo;
  if (contextInfo && contextInfo.quotedMessage) {
    let quoted = contextInfo.quotedMessage;
    if (quoted.ephemeralMessage) quoted = quoted.ephemeralMessage.message;
    if (quoted.viewOnceMessage) quoted = quoted.viewOnceMessage.message;
    if (quoted.viewOnceMessageV2) quoted = quoted.viewOnceMessageV2.message;

    const quotedType = getContentType(quoted);
    if (quotedType === 'imageMessage') {
      return {
        message: quoted.imageMessage,
        type: 'image',
        mimetype: quoted.imageMessage.mimetype || 'image/jpeg',
        caption: quoted.imageMessage.caption || '',
        isQuoted: true
      };
    }
    if (quotedType === 'videoMessage') {
      return {
        message: quoted.videoMessage,
        type: 'video',
        mimetype: quoted.videoMessage.mimetype || 'video/mp4',
        caption: quoted.videoMessage.caption || '',
        seconds: quoted.videoMessage.seconds || 0,
        isQuoted: true
      };
    }
    if (quotedType === 'audioMessage') {
      return {
        message: quoted.audioMessage,
        type: 'audio',
        mimetype: quoted.audioMessage.mimetype || 'audio/ogg; codecs=opus',
        ptt: !!quoted.audioMessage.ptt,
        isQuoted: true
      };
    }
    if (quotedType === 'documentMessage') {
      return {
        message: quoted.documentMessage,
        type: 'document',
        mimetype: quoted.documentMessage.mimetype || 'application/octet-stream',
        fileName: quoted.documentMessage.fileName || 'document',
        caption: quoted.documentMessage.caption || '',
        isQuoted: true
      };
    }
    if (quotedType === 'stickerMessage') {
      return {
        message: quoted.stickerMessage,
        type: 'sticker',
        mimetype: 'image/webp',
        isQuoted: true
      };
    }
  }

  return null;
}

/**
 * Mengunduh media menjadi Buffer
 */
async function downloadMedia(mediaMessage, type) {
  try {
    const stream = await downloadContentFromMessage(mediaMessage, type);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk]);
    }
    return buffer;
  } catch (error) {
    logger.error(`Gagal mengunduh media tipe ${type}:`, error.message);
    throw error;
  }
}

module.exports = {
  extractMediaInfo,
  downloadMedia
};
