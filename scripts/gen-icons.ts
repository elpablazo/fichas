// Generates PNG icons from public/icon.svg (Fichas 2.0: a gold ficha with a sprout, on greenhouse green).
import { readFileSync } from 'node:fs';
import sharp from 'sharp';

const svg = readFileSync('public/icon.svg', 'utf8');
const fullBleed = svg.replace('rx="112"', 'rx="0"');
// Notification badge: the same shapes as one white silhouette (Android tints it).
const badge = svg
  .replace(/<rect[^>]*\/>/, '')
  .replace(/<defs>[\s\S]*<\/defs>/, '')
  .replace(/fill="#[0-9a-f]{6}"/gi, 'fill="#fff"')
  .replace(/stroke="#[0-9a-f]{6}"/gi, 'stroke="#fff"');

const out: [string, string, number][] = [
  [svg, 'public/icon-192.png', 192],
  [svg, 'public/icon-512.png', 512],
  [fullBleed, 'public/icon-maskable-512.png', 512],
  [fullBleed, 'public/apple-touch-icon.png', 180],
  [badge, 'public/badge-96.png', 96],
];
for (const [src, file, size] of out) {
  await sharp(Buffer.from(src), { density: 300 })
    .resize(size, size)
    .png({ compressionLevel: 9, palette: true, quality: 92, effort: 10 })
    .toFile(file);
  console.log('wrote', file);
}
