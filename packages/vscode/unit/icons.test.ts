import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
// The generator is a plain Node script; Vitest loads it directly.
import { crc32, icons, rasterize } from '../../../scripts/build-icons.mjs';

it('commits store icons that the generator reproduces byte for byte', () => {
  for (const [file, bytes] of Object.entries(icons() as Record<string, Buffer>)) expect(readFileSync(file).equals(bytes), file).toBe(true);
});

it('ships a valid 256x256 RGBA PNG for VS Code that decodes to the rasterized mark', () => {
  const file = readFileSync('packages/vscode/media/icon.png');
  expect(file.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const chunks: { type: string; data: Buffer }[] = [];
  for (let offset = 8; offset < file.length;) {
    const length = file.readUInt32BE(offset), type = file.toString('ascii', offset + 4, offset + 8);
    const data = file.subarray(offset + 8, offset + 8 + length);
    expect(file.readUInt32BE(offset + 8 + length)).toBe(crc32(file.subarray(offset + 4, offset + 8 + length)));
    chunks.push({ type, data }); offset += length + 12;
  }
  expect(chunks.map(chunk => chunk.type)).toEqual(['IHDR', 'IDAT', 'IEND']);
  const header = chunks[0].data;
  expect([header.readUInt32BE(0), header.readUInt32BE(4), header[8], header[9]]).toEqual([256, 256, 8, 6]);
  const raw = inflateSync(chunks[1].data), stride = 256 * 4, pixels = Buffer.alloc(stride * 256);
  for (let y = 0; y < 256; y++) {
    expect(raw[y * (stride + 1)]).toBe(1);
    for (let x = 0; x < stride; x++) pixels[y * stride + x] = (raw[y * (stride + 1) + 1 + x] + (x >= 4 ? pixels[y * stride + x - 4] : 0)) & 0xff;
  }
  expect(pixels.equals(rasterize('light', 256))).toBe(true);
  expect(pixels[3]).toBe(0); // Transparent outside the rounded tile.
  expect(pixels[(128 * 256 + 128) * 4 + 3]).toBe(255);
});

it('ships 40x40 light and dark Rider plugin icons', () => {
  for (const name of ['pluginIcon.svg', 'pluginIcon_dark.svg']) {
    const svg = readFileSync(`packages/rider/src/main/resources/META-INF/${name}`, 'utf8');
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="40" height="40" viewBox="0 0 24 24">/);
  }
  expect(readFileSync('packages/rider/src/main/resources/META-INF/pluginIcon.svg', 'utf8'))
    .not.toBe(readFileSync('packages/rider/src/main/resources/META-INF/pluginIcon_dark.svg', 'utf8'));
});
