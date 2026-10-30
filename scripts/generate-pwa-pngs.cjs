const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Minimal pure Node.js PNG encoder without external packages
function createPNG(width, height, getPixel) {
  const bytesPerPixel = 4;
  const scanlineLength = width * bytesPerPixel + 1; // +1 for filter type byte
  const rawData = Buffer.alloc(scanlineLength * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * scanlineLength;
    rawData[rowOffset] = 0; // Filter type 0 (None)

    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getPixel(x, y, width, height);
      const pixelOffset = rowOffset + 1 + x * bytesPerPixel;
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  const deflated = zlib.deflateSync(rawData);

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR Chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth: 8
  ihdr[9] = 6; // Color type: 6 (RGBA)
  ihdr[10] = 0; // Compression method: 0
  ihdr[11] = 0; // Filter method: 0
  ihdr[12] = 0; // Interlace method: 0
  const ihdrChunk = createChunk('IHDR', ihdr);

  // IDAT Chunk
  const idatChunk = createChunk('IDAT', deflated);

  // IEND Chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = data.length;
  const buffer = Buffer.alloc(8 + length + 4);
  buffer.writeUInt32BE(length, 0);
  buffer.write(type, 4);
  data.copy(buffer, 8);

  const crc = crc32(Buffer.concat([Buffer.from(type), data]));
  buffer.writeUInt32BE(crc, 8 + length);
  return buffer;
}

// CRC-32 table computation
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

// Pixel generator for Caisse Pro high-tech icon
function getCaisseProPixel(x, y, w, h, isMaskable = false) {
  const cx = w / 2;
  const cy = h / 2;
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const maxR = w / 2;

  // Background base
  let r = 7;
  let g = 10;
  let b = 22;
  let a = 255;

  // Maskable safe zone or squircle boundary
  if (!isMaskable) {
    const cornerRadius = w * 0.22;
    const qx = Math.abs(x - cx) - (w / 2 - cornerRadius);
    const qy = Math.abs(y - cy) - (h / 2 - cornerRadius);
    if (qx > 0 && qy > 0 && Math.sqrt(qx * qx + qy * qy) > cornerRadius) {
      return [0, 0, 0, 0]; // Transparent outer edge
    }
  }

  // Cyan gradient glow ring
  const ringR = w * 0.38;
  const ringDist = Math.abs(dist - ringR);
  if (ringDist < w * 0.015) {
    return [0, 242, 254, 230];
  }

  // Center Terminal Monitor Area
  const termW = w * 0.52;
  const termH = h * 0.44;
  const tx = Math.abs(dx);
  const ty = Math.abs(dy);

  if (tx < termW / 2 && ty < termH / 2) {
    // Screen bezel
    if (tx > termW / 2 - w * 0.02 || ty > termH / 2 - h * 0.02) {
      return [0, 242, 254, 255]; // Cyan bezel border
    }

    // Inside screen (dark terminal)
    r = 10;
    g = 14;
    b = 30;

    // Header dots
    if (dy < -termH * 0.28 && dy > -termH * 0.4) {
      if (Math.abs(dx - (-termW * 0.3)) < w * 0.02) return [0, 242, 254, 255];
      if (Math.abs(dx - (-termW * 0.18)) < w * 0.02) return [16, 185, 129, 255];
      if (Math.abs(dx - (-termW * 0.06)) < w * 0.02) return [245, 158, 11, 255];
    }

    // Numpad touch grid left side
    if (dx < -termW * 0.05 && dy > -termH * 0.15 && dy < termH * 0.35) {
      const gridX = Math.floor((dx + termW * 0.42) / (termW * 0.12));
      const gridY = Math.floor((dy + termH * 0.15) / (termH * 0.16));
      if (gridX >= 0 && gridX < 3 && gridY >= 0 && gridY < 3) {
        return (gridX === 1 && gridY === 1) ? [0, 242, 254, 255] : [30, 42, 75, 255];
      }
    }

    // Golden Total right side
    if (dx > termW * 0.05 && dx < termW * 0.42 && dy > -termH * 0.15 && dy < termH * 0.1) {
      return [245, 158, 11, 240];
    }

    // Green Checkout Button right side
    if (dx > termW * 0.05 && dx < termW * 0.42 && dy > termH * 0.15 && dy < termH * 0.35) {
      return [16, 185, 129, 255];
    }
  }

  // Little receipt sticking out of top
  if (dx > termW * 0.05 && dx < termW * 0.35 && dy < -termH * 0.5 && dy > -h * 0.38) {
    return [255, 255, 255, 255];
  }

  return [r, g, b, a];
}

const publicDir = path.resolve(__dirname, '../public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

console.log('Generating PWA standard PNG icons...');

// 1. pwa-192x192.png
const pwa192 = createPNG(192, 192, (x, y, w, h) => getCaisseProPixel(x, y, w, h, false));
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), pwa192);

// 2. pwa-512x512.png
const pwa512 = createPNG(512, 512, (x, y, w, h) => getCaisseProPixel(x, y, w, h, false));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), pwa512);

// 3. pwa-maskable-512x512.png (with full bleed background for Android squircles)
const pwaMaskable = createPNG(512, 512, (x, y, w, h) => getCaisseProPixel(x, y, w, h, true));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), pwaMaskable);

// 4. apple-touch-icon.png (180x180)
const appleIcon = createPNG(180, 180, (x, y, w, h) => getCaisseProPixel(x, y, w, h, true));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), appleIcon);

// 5. favicon.png
const favicon = createPNG(64, 64, (x, y, w, h) => getCaisseProPixel(x, y, w, h, false));
fs.writeFileSync(path.join(publicDir, 'favicon.png'), favicon);

console.log('All PWA icons generated successfully in public/');
