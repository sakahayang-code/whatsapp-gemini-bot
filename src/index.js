const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const chalkModule = require('chalk');
const chalk = chalkModule.default || chalkModule;
const fs = require('fs');
const path = require('path');

const config = require('./config');
const geminiService = require('./services/gemini');
const { handleIncomingMessage } = require('./handlers/message');
const logger = require('./utils/logger');

// Cetak Banner Pembuka yang Keren
function printBanner() {
  console.log(chalk.cyanBright(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   ✨ WHATSAPP AI BOT - POWERED BY GEMINI 3.8 FLASH HIGH ✨     ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`));
  logger.info(`Memulai ${config.bot.name}...`);
  logger.info(`Model AI Aktif : ${config.gemini.model}`);
  logger.info(`Command Prefix : ${config.bot.prefix}`);
  logger.info(`Mode Pairing   : ${config.connection.usePairingCode ? 'Pairing Code' : 'QR Code Scanner'}`);
  if (config.gemini.apiKeys.length === 0) {
    logger.warn('PERINGATAN: GEMINI_API_KEY belum disetel di file .env!');
  } else {
    logger.success(`Gemini API Key terdeteksi (${config.gemini.apiKeys.length} kunci terpasang).`);
  }
  console.log('─────────────────────────────────────────────────────────────────');
}

let isPairingRequested = false;

async function startWhatsAppBot() {
  // Pastikan folder sesi ada
  if (!fs.existsSync(config.bot.sessionDir)) {
    fs.mkdirSync(config.bot.sessionDir, { recursive: true });
  }

  // Muat status autentikasi multi-file
  const { state, saveCreds } = await useMultiFileAuthState(config.bot.sessionDir);
  const { version, isLatest } = await fetchLatestBaileysVersion();
  logger.info(`Versi WhatsApp Web: v${version.join('.')} (Terbaru: ${isLatest})`);

  // Konfigurasi Socket Baileys
  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }), // Sembunyikan log internal Baileys agar terminal bersih
    printQRInTerminal: false,
    auth: state,
    browser: Browsers.ubuntu('Chrome'),
    generateHighQualityLinkPreview: true,
    syncFullHistory: false
  });

  // ----------------------------------------------------
  // EVENT: KONEKSI & AUTENTIKASI
  // ----------------------------------------------------
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    // Tampilkan QR Code di terminal jika pairing code tidak digunakan
    if (qr && !config.connection.usePairingCode) {
      console.log('\n');
      logger.info('Silakan scan QR Code di bawah menggunakan WhatsApp di ponsel Anda:');
      qrcode.generate(qr, { small: true });
      logger.info('Atau jika ingin memakai Pairing Code (nomor HP), atur USE_PAIRING_CODE=true di .env\n');
    }

    // Tangani Pairing Code jika diaktifkan dan belum terdaftar
    if (config.connection.usePairingCode && !sock.authState.creds.registered && !isPairingRequested) {
      isPairingRequested = true;
      if (!config.connection.pairingNumber) {
        logger.error('USE_PAIRING_CODE aktif tapi PAIRING_NUMBER di file .env masih kosong!');
        logger.info('Harap isi nomor HP WhatsApp di .env (misal: PAIRING_NUMBER=6281234567890)');
      } else {
        setTimeout(async () => {
          try {
            logger.info(`Meminta kode pairing untuk nomor: ${config.connection.pairingNumber}...`);
            const code = await sock.requestPairingCode(config.connection.pairingNumber);
            const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;

            console.log('\n' + chalk.black.bgGreen.bold(' ══════════════════ KODE PAIRING WHATSAPP ══════════════════ '));
            console.log(chalk.bold.yellowBright(`\n                    ${formattedCode}                    \n`));
            console.log(chalk.black.bgGreen.bold(' ═══════════════════════════════════════════════════════════ '));
            console.log(chalk.cyan('📱 Langkah menghubungkan:'));
            console.log(chalk.white(' 1. Buka WhatsApp di ponsel Anda'));
            console.log(chalk.white(' 2. Buka menu Perangkat Tertaut > Tautkan Perangkat'));
            console.log(chalk.white(' 3. Pilih "Tautkan dengan nomor telepon saja"'));
            console.log(chalk.white(` 4. Masukkan kode di atas: ${chalk.bold(formattedCode)}\n`));
          } catch (pairErr) {
            logger.error('Gagal membuat Pairing Code:', pairErr.message);
            isPairingRequested = false;
          }
        }, 4000);
      }
    }

    // Status: KONEKSI TERBUKA (BERHASIL TERHUBUNG)
    if (connection === 'open') {
      const userJid = sock.user?.id || '';
      const botNum = userJid.split(':')[0] || userJid.split('@')[0];
      console.log('\n' + chalk.green('✔') + chalk.bold.greenBright(' WHATSAPP BOT BERHASIL TERHUBUNG!'));
      logger.success(`Nama Akun     : ${sock.user?.name || config.bot.name}`);
      logger.success(`Nomor Akun    : +${botNum}`);
      logger.success(`Model AI Aktif: ${geminiService.getActiveModel()}`);
      logger.success(`Siap menerima pesan! Ketik '${config.bot.prefix}menu' di WhatsApp.`);
      console.log('─────────────────────────────────────────────────────────────────\n');
    }

    // Status: KONEKSI TERPUTUS
    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      logger.warn(`Koneksi terputus (Status: ${statusCode || 'unknown'}).`);

      if (shouldReconnect) {
        logger.info('Mencoba menyambungkan kembali dalam 5 detik...');
        setTimeout(() => startWhatsAppBot(), 5000);
      } else {
        logger.error('Sesi telah keluar (Logged Out). Menghapus folder auth dan menunggu pairing baru...');
        try {
          fs.rmSync(config.bot.sessionDir, { recursive: true, force: true });
        } catch {}
        setTimeout(() => startWhatsAppBot(), 3000);
      }
    }
  });

  // ----------------------------------------------------
  // EVENT: SIMPAN KREDENSIAL SESI SECARA OTOMATIS
  // ----------------------------------------------------
  sock.ev.on('creds.update', saveCreds);

  // ----------------------------------------------------
  // EVENT: PESAN MASUK (MESSAGES.UPSERT)
  // ----------------------------------------------------
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      try {
        await handleIncomingMessage(sock, msg);
      } catch (msgErr) {
        logger.error('Error memproses pesan:', msgErr);
      }
    }
  });

  return sock;
}

// Tangani penutupan proses secara rapi
process.on('SIGINT', () => {
  logger.info('\nMenghentikan bot...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('\nMenghentikan bot...');
  process.exit(0);
});

// Mulai bot
printBanner();
startWhatsAppBot().catch(err => {
  logger.error('Fatal Error saat memulai bot:', err);
});
