const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const webp = require('node-webpmux');
const config = require('../config');
const logger = require('../utils/logger');

function buildExif(pack, author) {
  const json = {
    'sticker-pack-id': 'com.gemini.whatsapp.bot',
    'sticker-pack-name': pack || config.sticker.packName,
    'sticker-pack-publisher': author || config.sticker.authorName,
    'android-app-store-link': 'https://play.google.com/store/apps/details?id=com.google.android.apps.bard',
    'ios-app-store-link': 'https://apps.apple.com/app/google-gemini/id6477489729',
    'emojis': ['✨', '🤖', '⚡']
  };

  const jsonBuf = Buffer.from(JSON.stringify(json), 'utf-8');
  const exif = Buffer.concat([
    Buffer.from([
      0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00,
      0x01, 0x00, 0x41, 0x57, 0x07, 0x00
    ]),
    Buffer.alloc(4),
    Buffer.from([0x1A, 0x00, 0x00, 0x00]),
    Buffer.from([0x00, 0x00, 0x00, 0x00]),
    jsonBuf
  ]);

  exif.writeUInt32LE(jsonBuf.length, 14);
  return exif;
}

/**
 * Konversi buffer gambar atau video menjadi WebP sticker WhatsApp
 */
async function createSticker(mediaBuffer, isVideo = false, packName, authorName) {
  const tmpDir = os.tmpdir();
  const inputExt = isVideo ? '.mp4' : '.jpg';
  const inputPath = path.join(tmpDir, `input_${Date.now()}_${Math.random().toString(36).substring(7)}${inputExt}`);
  const outputPath = path.join(tmpDir, `output_${Date.now()}_${Math.random().toString(36).substring(7)}.webp`);

  try {
    await fs.promises.writeFile(inputPath, mediaBuffer);

    const ffmpegArgs = isVideo
      ? [
          '-y',
          '-i', inputPath,
          '-vcodec', 'libwebp',
          '-filter:v', "scale='if(gt(a,1),512,-1)':'if(gt(a,1),-1,512)',pad=512:512:(512-iw)/2:(512-ih)/2:color=0x00000000,fps=15",
          '-lossless', '0',
          '-compression_level', '4',
          '-q:v', '50',
          '-loop', '0',
          '-an',
          '-vsync', '0',
          '-t', '7',
          outputPath
        ]
      : [
          '-y',
          '-i', inputPath,
          '-vcodec', 'libwebp',
          '-filter:v', "scale='if(gt(a,1),512,-1)':'if(gt(a,1),-1,512)',pad=512:512:(512-iw)/2:(512-ih)/2:color=0x00000000",
          '-lossless', '1',
          outputPath
        ];

    await new Promise((resolve, reject) => {
      const proc = spawn('ffmpeg', ffmpegArgs);
      let stderr = '';
      proc.stderr.on('data', data => { stderr += data.toString(); });
      proc.on('close', code => {
        if (code === 0) resolve();
        else reject(new Error(`FFmpeg error (code ${code}): ${stderr.slice(-200)}`));
      });
      proc.on('error', reject);
    });

    const webpBuffer = await fs.promises.readFile(outputPath);

    // Sematkan EXIF metadata
    const img = new webp.Image();
    await img.load(webpBuffer);
    img.exif = buildExif(packName, authorName);
    const finalStickerBuffer = await img.save(null);

    return finalStickerBuffer;
  } catch (err) {
    logger.error('Gagal membuat stiker:', err.message);
    throw err;
  } finally {
    // Bersihkan file sementara
    try { if (fs.existsSync(inputPath)) await fs.promises.unlink(inputPath); } catch {}
    try { if (fs.existsSync(outputPath)) await fs.promises.unlink(outputPath); } catch {}
  }
}

/**
 * Konversi stiker WebP kembali menjadi gambar PNG/JPEG (.toimg)
 */
async function stickerToImage(stickerBuffer) {
  const tmpDir = os.tmpdir();
  const inputPath = path.join(tmpDir, `stk_${Date.now()}_${Math.random().toString(36).substring(7)}.webp`);
  const outputPath = path.join(tmpDir, `img_${Date.now()}_${Math.random().toString(36).substring(7)}.png`);

  try {
    await fs.promises.writeFile(inputPath, stickerBuffer);

    await new Promise((resolve, reject) => {
      const proc = spawn('ffmpeg', ['-y', '-i', inputPath, outputPath]);
      let stderr = '';
      proc.stderr.on('data', data => { stderr += data.toString(); });
      proc.on('close', code => {
        if (code === 0) resolve();
        else reject(new Error(`FFmpeg error: ${stderr.slice(-200)}`));
      });
      proc.on('error', reject);
    });

    const pngBuffer = await fs.promises.readFile(outputPath);
    return pngBuffer;
  } catch (err) {
    logger.error('Gagal konversi stiker ke gambar:', err.message);
    throw err;
  } finally {
    try { if (fs.existsSync(inputPath)) await fs.promises.unlink(inputPath); } catch {}
    try { if (fs.existsSync(outputPath)) await fs.promises.unlink(outputPath); } catch {}
  }
}

module.exports = {
  createSticker,
  stickerToImage
};
