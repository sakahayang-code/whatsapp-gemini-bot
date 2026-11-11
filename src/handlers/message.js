const config = require('../config');
const { handleCommand } = require('./command');
const { handleAiInteraction } = require('./aiHandler');
const { getMessageText } = require('../utils/helpers');
const { extractMediaInfo } = require('../utils/media');
const sessionManager = require('../services/session');
const logger = require('../utils/logger');

/**
 * Pemroses pusat pesan masuk WhatsApp (messages.upsert)
 */
async function handleIncomingMessage(sock, msg) {
  // Abaikan pesan kosong, status WhatsApp (broadcast story), atau pesan dari bot sendiri
  if (!msg.message || msg.key.remoteJid === 'status@broadcast' || msg.key.fromMe) {
    return;
  }

  const chatId = msg.key.remoteJid;
  const isGroup = chatId.endsWith('@g.us');
  const rawText = getMessageText(msg);
  const mediaInfo = extractMediaInfo(msg);

  // Ambil ID bot saat ini untuk mendeteksi mention
  const botNumber = sock.user?.id ? sock.user.id.split(':')[0] : '';

  // ----------------------------------------------------
  // 1. CEK APAKAH INI PERINTAH (COMMAND BER-PREFIX)
  // ----------------------------------------------------
  const prefixes = [config.bot.prefix, '!', '#', '/'];
  const matchedPrefix = prefixes.find(p => rawText.startsWith(p));

  if (matchedPrefix) {
    const trimmed = rawText.slice(matchedPrefix.length).trim();
    const parts = trimmed.split(/\s+/);
    const command = parts[0];
    const args = parts.slice(1);

    if (command) {
      try {
        const result = await handleCommand(sock, msg, command, args, rawText);
        if (result === 'DELEGATE_TO_AI') {
          const query = args.join(' ');
          await handleAiInteraction(sock, msg, query);
        }
        return;
      } catch (cmdErr) {
        logger.error(`Error saat menjalankan perintah [${command}]:`, cmdErr);
      }
    }
  }

  // ----------------------------------------------------
  // 2. CEK OBROLAN GRUP
  // ----------------------------------------------------
  if (isGroup) {
    // Jika AI di grup ini dimatikan oleh admin via .ai off, abaikan
    if (!sessionManager.isGroupAiEnabled(chatId)) {
      return;
    }

    // Deteksi apakah bot di-mention atau pesan bot di-reply
    const contextInfo =
      msg.message?.extendedTextMessage?.contextInfo ||
      msg.message?.imageMessage?.contextInfo ||
      msg.message?.audioMessage?.contextInfo ||
      msg.message?.documentMessage?.contextInfo;

    const mentionedJids = contextInfo?.mentionedJid || [];
    const isBotMentioned = botNumber && mentionedJids.some(jid => jid.includes(botNumber));
    const isQuotingBot = botNumber && contextInfo?.participant?.includes(botNumber);

    // Di grup, bot hanya merespons jika di-mention, di-reply, atau jika mode 'all'
    if (isBotMentioned || isQuotingBot || config.bot.groupReplyMode === 'all') {
      // Bersihkan mention (@628...) dari teks pertanyaan
      let cleanQuery = rawText;
      if (botNumber) {
        cleanQuery = cleanQuery.replace(new RegExp(`@${botNumber}[^\\s]*`, 'g'), '').trim();
      }
      await handleAiInteraction(sock, msg, cleanQuery);
      return;
    }

    // Jika ada media dengan caption yang mereferensikan AI
    if (mediaInfo && (rawText.toLowerCase().includes('ai') || rawText.toLowerCase().includes('gemini'))) {
      await handleAiInteraction(sock, msg, rawText);
      return;
    }

    return; // Di grup jika tidak di-mention, abaikan agar tidak spam
  }

  // ----------------------------------------------------
  // 3. CEK CHAT PRIBADI (DIRECT MESSAGE / DM)
  // ----------------------------------------------------
  if (!isGroup) {
    // Jika user mengirimkan media (Foto / Voice Note / Dokumen) di chat pribadi, proses langsung dengan AI
    if (mediaInfo) {
      await handleAiInteraction(sock, msg, rawText);
      return;
    }

    // Jika fitur auto-reply chat pribadi diaktifkan
    if (config.bot.dmAutoReply && rawText) {
      await handleAiInteraction(sock, msg, rawText);
      return;
    }
  }
}

module.exports = { handleIncomingMessage };
