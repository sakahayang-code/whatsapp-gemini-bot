const assert = require('assert');
const config = require('../src/config');
const sessionManager = require('../src/services/session');
const geminiService = require('../src/services/gemini');
const { textToSpeech } = require('../src/services/tts');
const { safeEvaluate, formatUptime, getSenderId, getMessageText } = require('../src/utils/helpers');

async function runTests() {
  console.log('🧪 Memulai Pengujian Unit Bot WhatsApp...\n');

  // Test 1: Config Defaults
  console.log('1. Memeriksa Konfigurasi Default...');
  assert.ok(config.gemini.model.includes('gemini-3.8-flash'));
  assert.strictEqual(config.bot.prefix, '.');
  assert.strictEqual(typeof config.gemini.fallbackModels, 'object');
  console.log('   ✔ Konfigurasi valid.');

  // Test 2: Session Manager
  console.log('2. Memeriksa Session Manager & Memori...');
  const testChatId = '62899999999@s.whatsapp.net';
  sessionManager.clearHistory(testChatId);
  sessionManager.addMessage(testChatId, 'user', 'Halo!');
  sessionManager.addMessage(testChatId, 'model', 'Halo! Ada yang bisa saya bantu?');

  const history = sessionManager.getHistory(testChatId);
  assert.strictEqual(history.length, 2);
  assert.strictEqual(history[0].role, 'user');
  assert.strictEqual(history[1].role, 'model');

  sessionManager.clearHistory(testChatId);
  assert.strictEqual(sessionManager.getHistory(testChatId).length, 0);
  console.log('   ✔ Session memory berfungsi normal.');

  // Test 3: Personas
  console.log('3. Memeriksa Persona Switching...');
  const hasProgrammer = geminiService.setPersona(testChatId, 'programmer');
  assert.strictEqual(hasProgrammer, true);
  assert.ok(sessionManager.getCustomPrompt(testChatId).includes('Senior Full-Stack Engineer'));

  const hasInvalid = geminiService.setPersona(testChatId, 'non_existent_persona');
  assert.strictEqual(hasInvalid, false);
  console.log('   ✔ Persona switching berfungsi normal.');

  // Test 4: Model resolution & fallback
  console.log('4. Memeriksa Model Setter & Fallback...');
  const initialModel = geminiService.getActiveModel();
  assert.ok(initialModel.includes('gemini-3.8-flash'));
  geminiService.setModel('gemini-2.0-flash');
  assert.strictEqual(geminiService.getActiveModel(), 'gemini-2.0-flash');
  geminiService.setModel(initialModel);
  console.log('   ✔ Model setter valid.');

  // Test 5: Safe Evaluate
  console.log('5. Memeriksa Evaluasi Matematika (.calc)...');
  assert.strictEqual(safeEvaluate('10 + 20 * 2'), 50);
  assert.strictEqual(safeEvaluate('(100 - 20) / 4'), 20);
  assert.throws(() => safeEvaluate('abc'), /tidak valid/);
  console.log('   ✔ Kalkulator aman dan akurat.');

  // Test 6: Helper formatUptime & getSenderId
  console.log('6. Memeriksa Format Waktu & ID...');
  const timeStr = formatUptime(3665);
  assert.ok(timeStr.includes('1j') && timeStr.includes('1m') && timeStr.includes('5d'));

  const dummyMsg = {
    key: { remoteJid: '628123456789@s.whatsapp.net' },
    message: { conversation: '.ping' }
  };
  assert.strictEqual(getSenderId(dummyMsg), '628123456789');
  assert.strictEqual(getMessageText(dummyMsg), '.ping');
  console.log('   ✔ Helper parser valid.');

  // Test 7: Google TTS
  console.log('7. Memeriksa Layanan Google TTS...');
  const audioBuf = await textToSpeech('Tes audio WhatsApp Gemini', 'id');
  assert.ok(Buffer.isBuffer(audioBuf));
  assert.ok(audioBuf.length > 100);
  console.log(`   ✔ TTS berhasil menghasilkan audio buffer (${audioBuf.length} bytes).`);

  console.log('\n✨ SEMUA PENGUJIAN UNIT BERHASIL DILALUI DENGAN SUKSES! 🚀');
}

runTests().catch(err => {
  console.error('\n❌ Pengujian Gagal:', err);
  process.exit(1);
});
