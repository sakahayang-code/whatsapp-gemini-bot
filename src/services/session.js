const config = require('../config');

class SessionManager {
  constructor() {
    // Menyimpan riwayat obrolan per chatId (user JID atau group JID)
    this.histories = new Map();
    // Menyimpan persona/prompt kustom per chat
    this.customPrompts = new Map();
    // Status AI per grup (default: true)
    this.groupAiStatus = new Map();
    // Cooldown per user untuk mencegah spam (timestamp)
    this.cooldowns = new Map();
    // Waktu aktivitas terakhir per chat
    this.lastActivity = new Map();

    // Jalankan pembersihan otomatis chat yang tidak aktif lebih dari 2 jam
    const timer = setInterval(() => this.cleanupInactiveSessions(), 30 * 60 * 1000);
    if (timer.unref) timer.unref();
  }

  getHistory(chatId) {
    if (!this.histories.has(chatId)) {
      this.histories.set(chatId, []);
    }
    this.lastActivity.set(chatId, Date.now());
    return this.histories.get(chatId);
  }

  addMessage(chatId, role, text) {
    const history = this.getHistory(chatId);
    history.push({
      role: role === 'user' ? 'user' : 'model',
      parts: [{ text }]
    });

    // Batasi panjang riwayat obrolan sesuai batas konfigurasi
    const maxItems = config.gemini.maxHistory * 2; // user + model = 1 turn
    if (history.length > maxItems) {
      // Potong dari depan, pastikan urutan tetap dimulai dari 'user'
      history.splice(0, history.length - maxItems);
      if (history.length > 0 && history[0].role !== 'user') {
        history.shift();
      }
    }
    this.lastActivity.set(chatId, Date.now());
  }

  clearHistory(chatId) {
    this.histories.delete(chatId);
    this.lastActivity.delete(chatId);
  }

  setCustomPrompt(chatId, prompt) {
    if (prompt) {
      this.customPrompts.set(chatId, prompt);
    } else {
      this.customPrompts.delete(chatId);
    }
  }

  getCustomPrompt(chatId) {
    return this.customPrompts.get(chatId) || null;
  }

  setGroupAi(groupId, enabled) {
    this.groupAiStatus.set(groupId, !!enabled);
  }

  isGroupAiEnabled(groupId) {
    if (!this.groupAiStatus.has(groupId)) {
      return true; // default menyala
    }
    return this.groupAiStatus.get(groupId);
  }

  checkCooldown(userId, cooldownMs = 2000) {
    const now = Date.now();
    const lastTime = this.cooldowns.get(userId) || 0;
    if (now - lastTime < cooldownMs) {
      return false; // Sedang cooldown
    }
    this.cooldowns.set(userId, now);
    return true; // Boleh lanjut
  }

  cleanupInactiveSessions() {
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    for (const [chatId, time] of this.lastActivity.entries()) {
      if (time < twoHoursAgo) {
        this.histories.delete(chatId);
        this.lastActivity.delete(chatId);
      }
    }
  }

  getStats() {
    return {
      activeSessions: this.histories.size,
      customPrompts: this.customPrompts.size,
      groupsMonitored: this.groupAiStatus.size
    };
  }
}

const sessionManager = new SessionManager();
module.exports = sessionManager;
