const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPng(width, height, r, g, b) {
  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // CRC Table
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) c = 0xedb88320 ^ (c >>> 1);
      else c = c >>> 1;
    }
    crcTable[n] = c;
  }

  function crc32(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);

    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const crcVal = crc32(Buffer.concat([typeBuf, data]));
    crcBuf.writeUInt32BE(crcVal, 0);

    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  // IHDR: width(4), height(4), bitDepth(1=8), colorType(1=6:RGBA), comp(1=0), filter(1=0), interlace(1=0)
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8 bits per channel
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // Scanlines with nice gradient & border
  const scanlines = Buffer.alloc(height * (1 + width * 4));
  let offset = 0;

  const cx = width / 2;
  const cy = height / 2;
  const radius = width * 0.45;

  for (let y = 0; y < height; y++) {
    scanlines[offset++] = 0; // Filter: none
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Deep emerald gradient background with rounded squircle
      const t = y / height;
      let pr = Math.round(5 + (16 - 5) * t);
      let pg = Math.round(150 - 60 * t);
      let pb = Math.round(105 - 20 * t);
      let pa = 255;

      // Inside central badge/circle
      if (dist < radius) {
        if (dist > radius - 6) {
          // Gold border
          pr = 245; pg = 158; pb = 11;
        } else if (dist < radius * 0.3) {
          // Center target dot
          pr = 255; pg = 255; pb = 255;
        } else if (Math.abs(dx) < 4 || Math.abs(dy) < 4) {
          // Crosshairs
          pr = 255; pg = 255; pb = 255;
        }
      }

      scanlines[offset++] = pr;
      scanlines[offset++] = pg;
      scanlines[offset++] = pb;
      scanlines[offset++] = pa;
    }
  }

  const compressed = zlib.deflateSync(scanlines);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const dir = path.join(__dirname, '../client/public');
const p192 = createPng(192, 192, 5, 150, 105);
fs.writeFileSync(path.join(dir, 'tech-icon-192.png'), p192);

const p512 = createPng(512, 512, 5, 150, 105);
fs.writeFileSync(path.join(dir, 'tech-icon-512.png'), p512);

console.log('Successfully generated tech-icon-192.png and tech-icon-512.png');
