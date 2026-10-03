// Draws the app icons: the same warm light on near-black, no dependencies.
// Run with `node scripts/make-icons.mjs`. The glow stays inside the central 60%, so the
// same image works as a maskable icon.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const t = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
};

const lin = (c) => Math.pow(c / 255, 2.2);
const BG = [5, 4, 7].map(lin);
const EMBER = [1, 0.36, 0.1], AMBER = [1, 0.6, 0.28], WHITE = [1, 0.9, 0.76];

function render(size) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) / size;
      const core = Math.exp(-Math.pow(d / 0.05, 2));
      const halo = 0.55 * Math.exp(-d / 0.09);
      const wide = 0.16 * Math.exp(-d / 0.22);
      const e = core * 1.4 + halo + wide;
      const px = [0, 1, 2].map((i) => {
        const col = (core * WHITE[i] * 1.4 + halo * AMBER[i] + wide * EMBER[i]) / Math.max(e, 1e-6);
        let v = BG[i] + col * (1 - Math.exp(-e * 1.5));
        v = Math.pow(Math.min(1, v), 1 / 2.2) * 255;
        // Plain rounding: dither noise made the 512 icon six times larger and banding is invisible at icon size.
        return Math.max(0, Math.min(255, Math.round(v)));
      });
      const o = y * (size * 3 + 1) + 1 + x * 3;
      raw[o] = px[0]; raw[o + 1] = px[1]; raw[o + 2] = px[2];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  writeFileSync(new URL(`../public/${name}`, import.meta.url), render(size));
  console.log('wrote', name);
}
