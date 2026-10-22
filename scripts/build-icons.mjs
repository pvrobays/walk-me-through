// Generates the store icons from one geometry, using only Node built-ins.
//   node scripts/build-icons.mjs          writes the committed icon files
//   node scripts/build-icons.mjs --check  regenerates them in memory and fails on drift
// The mark is the activity-bar walkthrough mark (packages/vscode/media/walkthrough.svg):
// two step boxes, a connector and an arrow, drawn on a rounded tile.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

// ---- Geometry (24×24 units, shared by every output) ----
const GRID = 24;
const TILE_RADIUS = 5;
const MARK_SCALE = 0.8; // The activity-bar mark, scaled about the centre to leave tile padding.
const STROKE = 2 * MARK_SCALE;
// The 24px mark's arrow chevron crosses the connector at store sizes, so the store mark drops it and
// fills the second step instead, reading as "the step you are on".
const MARK = [
  [[4, 4], [14, 4], [14, 9], [4, 9], [4, 4]], // first step
  [[10, 15], [20, 15], [20, 20], [10, 20], [10, 15]], // current step (outline; filled below)
  [[9, 9], [9, 12], [15, 12], [15, 15]], // connector
];
const FILLED = [[[10, 15], [20, 20]]]; // [top-left, bottom-right] in mark units
const round = value => Number(value.toFixed(3));
const place = ([x, y]) => [round(12 + (x - 12) * MARK_SCALE), round(12 + (y - 12) * MARK_SCALE)];
const polylines = MARK.map(line => line.map(place));
const fills = FILLED.map(corners => corners.map(place));

export const THEMES = {
  light: { tile: '#3574F0', mark: '#FFFFFF' },
  dark: { tile: '#548AF7', mark: '#FFFFFF' },
};

// ---- SVG ----
export function svg(theme, size = 40) {
  const { tile, mark } = THEMES[theme];
  const d = polylines.map(line => line.map(([x, y], index) => `${index ? 'L' : 'M'}${x} ${y}`).join('')).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${GRID} ${GRID}">\n`
    + `  <rect width="${GRID}" height="${GRID}" rx="${TILE_RADIUS}" fill="${tile}"/>\n`
    + fills.map(([[x1, y1], [x2, y2]]) => `  <rect x="${x1}" y="${y1}" width="${round(x2 - x1)}" height="${round(y2 - y1)}" fill="${mark}"/>\n`).join('')
    + `  <path d="${d}" fill="none" stroke="${mark}" stroke-width="${round(STROKE)}" stroke-linecap="round" stroke-linejoin="round"/>\n`
    + '</svg>\n';
}

// ---- Rasterizer (4×4 supersampling) ----
const segments = polylines.flatMap(line => line.slice(1).map((point, index) => [line[index], point]));
function inTile(x, y) {
  const r = TILE_RADIUS;
  const dx = Math.max(r - x, 0, x - (GRID - r)), dy = Math.max(r - y, 0, y - (GRID - r));
  return x >= 0 && y >= 0 && x <= GRID && y <= GRID && dx * dx + dy * dy <= r * r;
}
function inMark(x, y) {
  for (const [[x1, y1], [x2, y2]] of fills) if (x >= x1 && x <= x2 && y >= y1 && y <= y2) return true;
  const limit = (STROKE / 2) ** 2;
  for (const [[ax, ay], [bx, by]] of segments) {
    const vx = bx - ax, vy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy)));
    const ex = ax + t * vx - x, ey = ay + t * vy - y;
    if (ex * ex + ey * ey <= limit) return true;
  }
  return false;
}
const rgb = hex => [1, 3, 5].map(index => Number.parseInt(hex.slice(index, index + 2), 16));

export function rasterize(theme, size) {
  const tile = rgb(THEMES[theme].tile), mark = rgb(THEMES[theme].mark);
  const samples = 4, scale = GRID / size, pixels = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sy = 0; sy < samples; sy++) for (let sx = 0; sx < samples; sx++) {
      const x = (px + (sx + 0.5) / samples) * scale, y = (py + (sy + 0.5) / samples) * scale;
      if (!inTile(x, y)) continue;
      const color = inMark(x, y) ? mark : tile;
      r += color[0]; g += color[1]; b += color[2]; a++;
    }
    const offset = (py * size + px) * 4;
    if (a) { pixels[offset] = Math.round(r / a); pixels[offset + 1] = Math.round(g / a); pixels[offset + 2] = Math.round(b / a); }
    pixels[offset + 3] = Math.round((a * 255) / (samples * samples));
  }
  return pixels;
}

// ---- PNG encoder: CRC-32, Adler-32 and a deterministic fixed-Huffman deflate ----
// node:zlib output can differ between zlib builds and CPU features; this encoder keeps the bytes reproducible everywhere.
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
export function crc32(bytes) { let c = 0xffffffff; for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function adler32(bytes) { let a = 1, b = 0; for (const byte of bytes) { a = (a + byte) % 65521; b = (b + a) % 65521; } return ((b << 16) | a) >>> 0; }

const LENGTH_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LENGTH_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DIST_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
const DIST_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];

function deflateFixed(data) {
  const bytes = []; let bit = 0, current = 0;
  const bits = (value, count) => { for (let i = 0; i < count; i++) { current |= ((value >>> i) & 1) << bit; if (++bit === 8) { bytes.push(current); bit = 0; current = 0; } } };
  const huffman = (code, length) => { for (let i = length - 1; i >= 0; i--) bits((code >>> i) & 1, 1); };
  const symbol = value => {
    if (value < 144) huffman(0x30 + value, 8);
    else if (value < 256) huffman(0x190 + value - 144, 9);
    else if (value < 280) huffman(value - 256, 7);
    else huffman(0xc0 + value - 280, 8);
  };
  const index = (table, value) => { let i = table.length - 1; while (table[i] > value) i--; return i; };
  bits(1, 1); bits(1, 2); // Final block, fixed Huffman codes.
  const head = new Int32Array(1 << 15).fill(-1), previous = new Int32Array(data.length);
  const hash = p => ((data[p] << 10) ^ (data[p + 1] << 5) ^ data[p + 2]) & 0x7fff;
  const insert = p => { if (p + 2 < data.length) { const h = hash(p); previous[p] = head[h]; head[h] = p; } };
  for (let i = 0; i < data.length;) {
    let bestLength = 0, bestDistance = 0;
    if (i + 2 < data.length) {
      const max = Math.min(258, data.length - i);
      for (let candidate = head[hash(i)], chain = 128; candidate >= 0 && i - candidate <= 32768 && chain > 0; candidate = previous[candidate], chain--) {
        let length = 0; while (length < max && data[candidate + length] === data[i + length]) length++;
        if (length > bestLength) { bestLength = length; bestDistance = i - candidate; if (length === max) break; }
      }
    }
    if (bestLength >= 3) {
      const l = index(LENGTH_BASE, bestLength); symbol(257 + l); bits(bestLength - LENGTH_BASE[l], LENGTH_EXTRA[l]);
      const d = index(DIST_BASE, bestDistance); huffman(d, 5); bits(bestDistance - DIST_BASE[d], DIST_EXTRA[d]);
      for (let k = 0; k < bestLength; k++) insert(i + k);
      i += bestLength;
    } else { symbol(data[i]); insert(i); i++; }
  }
  symbol(256);
  if (bit) bytes.push(current);
  return Buffer.from(bytes);
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0); body.copy(out, 4); out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
}

export function png(theme, size = 256) {
  const pixels = rasterize(theme, size), stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    const row = y * (stride + 1); raw[row] = 1; // Sub filter on every row.
    for (let x = 0; x < stride; x++) raw[row + 1 + x] = (pixels[y * stride + x] - (x >= 4 ? pixels[y * stride + x - 4] : 0)) & 0xff;
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6; // 8-bit RGBA, no interlace.
  const adler = Buffer.alloc(4); adler.writeUInt32BE(adler32(raw));
  const idat = Buffer.concat([Buffer.from([0x78, 0x01]), deflateFixed(raw), adler]);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', header), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

export function icons() {
  return {
    'packages/vscode/media/icon.png': png('light', 256),
    'packages/rider/src/main/resources/META-INF/pluginIcon.svg': Buffer.from(svg('light'), 'utf8'),
    'packages/rider/src/main/resources/META-INF/pluginIcon_dark.svg': Buffer.from(svg('dark'), 'utf8'),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  const stale = [];
  for (const [file, bytes] of Object.entries(icons())) {
    const target = path.join(root, file);
    if (check) { const committed = await readFile(target).catch(() => undefined); if (!committed || !committed.equals(bytes)) stale.push(file); }
    else await writeFile(target, bytes);
  }
  if (stale.length) { console.error(`Stale icon files: ${stale.join(', ')}. Run npm run icons:build.`); process.exitCode = 1; }
  else console.log(check ? 'Committed icons match scripts/build-icons.mjs.' : 'Wrote icons from scripts/build-icons.mjs.');
}
