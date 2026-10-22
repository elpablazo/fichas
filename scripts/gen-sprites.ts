// Builds the sprite sheets from scripts/sprites/art.ts (run after editing the art: `npm run gen:sprites`).
// - Food-type icons are inlined in index.html (first paint needs them, no request).
// - Food icons go to src/client/sprites/foods.svg, loaded by URL (hashed, precached) when a list needs them.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { foods, groups } from './sprites/art';

const compact = (s: string) =>
  s
    .replace(/\s*\n\s*/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
const symbol = (id: string, body: string) => `<symbol id="${id}" viewBox="0 0 32 32">${compact(body)}</symbol>`;

const inline = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${Object.entries(groups)
  .map(([k, v]) => symbol(`g-${k}`, v))
  .join('')}</defs></svg>`;
const html = readFileSync('index.html', 'utf8');
const START = '<!-- sprites:start -->';
const END = '<!-- sprites:end -->';
const a = html.indexOf(START);
const b = html.indexOf(END);
if (a < 0 || b < 0) throw new Error('index.html needs <!-- sprites:start --> and <!-- sprites:end --> markers');
writeFileSync('index.html', `${html.slice(0, a + START.length)}\n    ${inline}\n    ${html.slice(b)}`);

const sheet = `<svg xmlns="http://www.w3.org/2000/svg"><defs>${Object.entries(foods)
  .map(([k, v]) => symbol(`f-${k}`, v))
  .join('')}</defs></svg>\n`;
mkdirSync('src/client/sprites', { recursive: true });
writeFileSync('src/client/sprites/foods.svg', sheet);

// Contact sheet for visual review (private/, never committed).
mkdirSync('private/qa', { recursive: true });
const cell = (prefix: string, id: string, body: string) =>
  `<figure><svg viewBox="0 0 32 32" width="56" height="56">${compact(body)}</svg><svg viewBox="0 0 32 32" width="22" height="22">${compact(body)}</svg><figcaption>${prefix}${id}</figcaption></figure>`;
const grid = (bg: string, ink: string) =>
  `<section style="background:${bg};color:${ink};padding:12px;display:flex;flex-wrap:wrap;gap:6px">${[
    ...Object.entries(groups).map(([k, v]) => cell('g-', k, v)),
    ...Object.entries(foods).map(([k, v]) => cell('', k, v)),
  ].join('')}</section>`;
writeFileSync(
  'private/qa/sprites.html',
  `<!doctype html><meta charset="utf-8"><style>body{margin:0;font:11px system-ui}figure{margin:0;width:84px;text-align:center}figcaption{margin-top:2px}</style>${grid('#fffdf6', '#18271d')}${grid('#16211a', '#eef2e6')}`,
);
console.log(
  `sprites: ${Object.keys(groups).length} inline (${inline.length} B), ${Object.keys(foods).length} foods (${sheet.length} B)`,
);
