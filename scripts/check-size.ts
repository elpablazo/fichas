// Bundle budgets (§12): initial JS ≤ 90 KB gzip, CSS ≤ 15 KB gzip, precache ≤ 400 KB (transfer size).
import { readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const DIST = 'dist/client';
const gz = (f: string) => gzipSync(readFileSync(`${DIST}${f}`), { level: 9 }).length;
const html = readFileSync(`${DIST}/index.html`, 'utf8');
const initialJs = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.js)"/g)].map((m) => m[1] as string);
const css = [...html.matchAll(/href="(\/assets\/[^"]+\.css)"/g)].map((m) => m[1] as string);
const sw = readFileSync(`${DIST}/sw.js`, 'utf8');
const precache = [...sw.matchAll(/"url":"([^"]+)"/g)].map((m) => (m[1] === '/' ? '/index.html' : (m[1] as string)));

const js = initialJs.reduce((s, f) => s + gz(f), 0);
const cssSize = css.reduce((s, f) => s + gz(f), 0);
const pre =
  precache.reduce((s, f) => s + (/\.(png)$/.test(f) ? statSync(`${DIST}${f}`).size : gz(f)), 0) + gzipSync(sw).length;
const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;
const rows: [string, number, number][] = [
  ['initial JS (gzip)', js, 90 * 1024],
  ['CSS (gzip)', cssSize, 15 * 1024],
  ['precache (transfer)', pre, 400 * 1024],
];
let fail = false;
for (const [name, v, max] of rows) {
  const ok = v <= max;
  fail ||= !ok;
  console.log(`${ok ? '✓' : '✗'} ${name}: ${kb(v)} / ${kb(max)}`);
}
if (fail) process.exit(1);
