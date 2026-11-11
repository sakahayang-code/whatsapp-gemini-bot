const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config');
const sessionManager = require('./session');
const logger = require('../utils/logger');

class GeminiService {
  constructor() {
    this.apiKeys = [...config.gemini.apiKeys];
    this.currentKeyIndex = 0;
    this.activeModel = config.gemini.model;
    this.fallbackModels = [...config.gemini.fallbackModels];
    this.hasWarnedModelFallback = false;

    // Preset persona yang bisa dipilih pengguna
    this.personas = {
      assistant: config.gemini.systemInstruction,
      programmer: `Kamu adalah Senior Full-Stack Engineer & Software Architect kelas dunia. Berikan solusi kode yang bersih, efisien, aman, dan berikan penjelasan singkat padat. Format kode selalu dalam \`\`\`bahasa ... \`\`\`. Bahasa Indonesia santai dan profesional.`,
      guru: `Kamu adalah seorang Guru dan Mentor yang sangat sabar, ramah, dan bijaksana. Jelaskan konsep rumit dengan analogi sederhana sehari-hari agar anak sekolah maupun pemula langsung paham.`,
      formal: `Anda adalah konsultan profesional eksekutif. Gunakan Bahasa Indonesia baku, sopan, terstruktur, berbasis data, dan bernada formal tingkat tinggi.`,
      santai: `Lu adalah temen ngobrol asik, santai, pake bahasa gaul Jakarta (gue/lu/bro/sis/cuy). Responsif, seru, humoris, tapi tetep cerdas dan tau banyak hal.`,
      anime: `Kamu adalah karakter anime waifu yang imut, perhatian, dan ceria! Suka menggunakan ekspresi lucu seperti (≧◡≦), (*^▽^*), atau 'nyaa~' di akhir kalimat, tapi tetap membantu menjawab pertanyaan tuannya dengan pintar!`
    };
  }

  getApiKey() {
    if (this.apiKeys.length === 0) {
      throw new Error('API Key Gemini belum disetel! Harap masukkan GEMINI_API_KEY di file .env');
    }
    return this.apiKeys[this.currentKeyIndex];
  }

  rotateApiKey() {
    if (this.apiKeys.length > 1) {
      this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
      logger.warn(`Beralih ke API Key Gemini berikutnya (Indeks: ${this.currentKeyIndex})`);
      return true;
    }
    return false;
  }

  /**
   * Menyiapkan instance GenerativeModel dengan sistem prompt dinamis
   */
  getModelInstance(chatId, modelName = this.activeModel) {
    const key = this.getApiKey();
    const genAI = new GoogleGenerativeAI(key);

    // Cek apakah ada prompt kustom untuk chat ini
    const customPrompt = chatId ? sessionManager.getCustomPrompt(chatId) : null;
    const systemInstruction = customPrompt || config.gemini.systemInstruction;

    return genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: systemInstruction,
      generationConfig: {
        temperature: config.gemini.temperature,
        topP: config.gemini.topP,
        topK: config.gemini.topK,
        maxOutputTokens: config.gemini.maxOutputTokens
      }
    });
  }

  /**
   * Mengirim request dengan mekanisme otomatis retry kunci dan fallback model
   */
  async executeWithFallback(chatId, operation) {
    const modelsToTry = [this.activeModel, ...this.fallbackModels.filter(m => m !== this.activeModel)];
    let lastError = null;

    for (const modelToTry of modelsToTry) {
      // Coba dengan API key saat ini atau rotate jika limit
      let keyAttempts = 0;
      const maxKeyAttempts = Math.max(1, this.apiKeys.length);

      while (keyAttempts < maxKeyAttempts) {
        try {
          const modelInstance = this.getModelInstance(chatId, modelToTry);
          const result = await operation(modelInstance);

          // Jika model yang berhasil berbeda dari activeModel awal, catat transisi
          if (modelToTry !== this.activeModel && !this.hasWarnedModelFallback) {
            logger.warn(`Model '${this.activeModel}' tidak dapat diakses di endpoint saat ini. Mengalihkan otomatis ke '${modelToTry}'.`);
            this.activeModel = modelToTry;
            this.hasWarnedModelFallback = true;
          }

          return result;
        } catch (error) {
          lastError = error;
          const errMsg = error.message || '';

          // Jika error adalah 429 Quota Exceeded dan ada API key lain, rotate key
          if (errMsg.includes('429') || errMsg.includes('Quota') || errMsg.includes('ResourceExhausted')) {
            logger.warn(`Quota limit pada kunci aktif. Mencoba merotasi kunci...`);
            if (this.rotateApiKey()) {
              keyAttempts++;
              continue;
            }
          }

          // Jika error adalah model tidak ditemukan (404), coba model fallback berikutnya
          if (errMsg.includes('404') || errMsg.includes('not found') || errMsg.includes('is not supported')) {
            logger.warn(`Model '${modelToTry}' tidak ditemukan pada API. Mencoba fallback ke model lain...`);
            break; // keluar dari loop key, coba model selanjutnya
          }

          // Error lainnya: throw atau break
          logger.error(`Kesalahan eksekusi Gemini (${modelToTry}):`, errMsg);
          break;
        }
      }
    }

    throw lastError || new Error('Gagal mendapatkan respons dari Gemini API.');
  }

  /**
   * Chat teks interaktif dengan memori percakapan
   */
  async chat(chatId, userMessage) {
    return await this.executeWithFallback(chatId, async (model) => {
      const history = sessionManager.getHistory(chatId);

      // Inisialisasi obrolan dengan riwayat sebelumnya
      const chat = model.startChat({
        history: history.map(item => ({
          role: item.role,
          parts: item.parts.map(p => ({ text: p.text }))
        }))
      });

      const response = await chat.sendMessage(userMessage);
      const replyText = response.response.text();

      // Simpan percakapan ke riwayat session
      sessionManager.addMessage(chatId, 'user', userMessage);
      sessionManager.addMessage(chatId, 'model', replyText);

      return replyText;
    });
  }

  /**
   * Analisis Gambar (Vision) dengan prompt opsional
   */
  async analyzeImage(chatId, imageBuffer, mimeType, prompt = 'Jelaskan gambar ini secara detail dan jelas.') {
    return await this.executeWithFallback(chatId, async (model) => {
      const imagePart = {
        inlineData: {
          data: imageBuffer.toString('base64'),
          mimeType: mimeType || 'image/jpeg'
        }
      };

      const result = await model.generateContent([prompt, imagePart]);
      const replyText = result.response.text();

      // Simpan ringkasan ke riwayat
      sessionManager.addMessage(chatId, 'user', `[Gambar]: ${prompt}`);
      sessionManager.addMessage(chatId, 'model', replyText);

      return replyText;
    });
  }

  /**
   * Analisis Audio / Voice Note (PTT)
   */
  async analyzeAudio(chatId, audioBuffer, mimeType = 'audio/ogg', customPrompt) {
    return await this.executeWithFallback(chatId, async (model) => {
      const defaultPrompt = 'Ini adalah pesan suara (audio/voice note) dari pengguna di WhatsApp. Dengarkan dan pahami apa yang mereka sampaikan atau tanyakan, kemudian berikan jawaban atau tanggapan yang lengkap, relevan, dan membantu dalam Bahasa Indonesia.';
      const prompt = customPrompt || defaultPrompt;

      const audioPart = {
        inlineData: {
          data: audioBuffer.toString('base64'),
          mimeType: mimeType
        }
      };

      const result = await model.generateContent([prompt, audioPart]);
      const replyText = result.response.text();

      sessionManager.addMessage(chatId, 'user', `[Pesan Suara / Audio]`);
      sessionManager.addMessage(chatId, 'model', replyText);

      return replyText;
    });
  }

  /**
   * Analisis Dokumen (PDF, TXT, Code, CSV, etc.)
   */
  async analyzeDocument(chatId, docBuffer, mimeType, fileName, customPrompt) {
    return await this.executeWithFallback(chatId, async (model) => {
      const prompt = customPrompt || `Tolong analisis dan berikan rangkuman serta poin-poin utama dari isi dokumen "${fileName}" ini.`;

      const docPart = {
        inlineData: {
          data: docBuffer.toString('base64'),
          mimeType: mimeType
        }
      };

      const result = await model.generateContent([prompt, docPart]);
      const replyText = result.response.text();

      sessionManager.addMessage(chatId, 'user', `[Dokumen: ${fileName}]: ${prompt}`);
      sessionManager.addMessage(chatId, 'model', replyText);

      return replyText;
    });
  }

  /**
   * Ganti persona bot untuk chat tertentu
   */
  setPersona(chatId, personaKey) {
    if (this.personas[personaKey]) {
      sessionManager.setCustomPrompt(chatId, this.personas[personaKey]);
      sessionManager.clearHistory(chatId);
      return true;
    }
    return false;
  }

  /**
   * Reset obrolan untuk chat tertentu
   */
  resetChat(chatId) {
    sessionManager.clearHistory(chatId);
  }

  /**
   * Mengubah model aktif secara langsung
   */
  setModel(newModelName) {
    this.activeModel = newModelName;
    this.hasWarnedModelFallback = false;
    logger.info(`Model Gemini diubah menjadi: ${newModelName}`);
  }

  getActiveModel() {
    return this.activeModel;
  }
}

const geminiService = new GeminiService();
module.exports = geminiService;
