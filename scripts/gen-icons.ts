// Generates PNG icons from public/icon.svg (rosa mexicano + three stacked white tokens).
import { readFileSync } from 'node:fs';
import sharp from 'sharp';

const svg = readFileSync('public/icon.svg', 'utf8');
const fullBleed = svg.replace('rx="112"', 'rx="0"');
const badge = svg.replace(/<rect[^>]*\/>/, '').replace(/stroke="#E4007C"/, 'stroke="#000" stroke-opacity="0"');

const out: [string, string, number][] = [
  [svg, 'public/icon-192.png', 192],
  [svg, 'public/icon-512.png', 512],
  [fullBleed, 'public/icon-maskable-512.png', 512],
  [fullBleed, 'public/apple-touch-icon.png', 180],
  [badge, 'public/badge-96.png', 96],
];
for (const [src, file, size] of out) {
  await sharp(Buffer.from(src), { density: 300 }).resize(size, size).png({ compressionLevel: 9 }).toFile(file);
  console.log('wrote', file);
}
