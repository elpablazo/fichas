// Copy lint (§14.5): length limits, banned words, tone rules, pool sizes. Exit 1 on any violation.
import * as core from '../src/client/copy/es-MX';
import * as more from '../src/client/copy/more';
import { pushPools } from '../src/client/copy/push';

const copy = { ...core, ...more, pools: { ...core.pools, ...pushPools } };

const BANNED = [
  'trampa',
  'pecado',
  'culpa',
  'malo',
  'mala ',
  'fallaste',
  'fracas',
  'excedi',
  'exceso',
  'prohibid',
  'deberias',
  'tienes que',
  'cuidado',
  'advertencia',
  'alerta',
  'calor',
  'kcal',
  'racha',
  'perdiste',
  'no rompas',
  'dieta',
  'gord',
  'flac',
  'peso ideal',
  'castigo',
  'compens',
  'macronutri',
  'asignaci',
  'limite',
];
/** The app has no voice of its own (owner, 2026-10-21): it never speaks as "yo"/"nosotros".
 *  Buttons in the owner's voice ("Me lo comí", "Me la salté") are fine; these are the app talking. */
const FIRST_PERSON = [
  'supuse',
  'encontre',
  'no pude',
  'te aviso',
  'te escucho',
  'ajusto',
  'cuadramos',
  'dimelo',
  'lo quite',
  'esto veo',
  'lo leo',
  'lo busco',
  'lo cuento',
  ' veo ',
  'arrancamos',
  'cerramos',
  'seguimos',
  'retomamos',
  'te propongo',
  'te recomiendo',
  'te sugiero',
  ' toco ',
];
/** Keys that are fixed strings for a single, rare moment (not pools that repeat). */
const NOT_POOLS = new Set(['push.title.slot', 'push.title.plan', 'push.title.test', 'push.body.test']);

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const entries: [string, string][] = [];
for (const [k, list] of Object.entries(copy.pools)) for (const v of list) entries.push([k, v]);
const flat = (prefix: string, obj: unknown) => {
  if (typeof obj === 'string') entries.push([prefix, obj]);
  else if (Array.isArray(obj)) for (const [i, v] of obj.entries()) flat(`${prefix}.${i}`, v);
  else if (obj && typeof obj === 'object')
    for (const [k, v] of Object.entries(obj)) flat(prefix ? `${prefix}.${k}` : k, v);
};
flat('button', copy.buttons);
flat('title', copy.titles);
flat('line', copy.lines);
flat('label', copy.labels);
flat('type', copy.typeLabels);
flat('a11y', copy.a11y);
flat('line.swap', copy.swapLabels);
flat('line.game', copy.gameCopy);
flat('line.kitchen', copy.kitchenCopy);
flat('line.notification', copy.notificationCopy);
flat('line.story', copy.storyCopy);
flat('line.diagnostics', copy.diagnosticsCopy);
flat('line.plan', copy.planLines);
flat('line.new', copy.whatsNew);
flat('line.today', copy.todayCopy);
flat('line.pace', copy.paceCopy);
flat('line.meter', copy.meterCopy);
flat('line.now', copy.nowCopy);
flat('line.verdict', copy.verdictCopy);
flat('line.describe', copy.describeCopy);
flat('line.day', copy.dayCopy);
flat('line.garden', copy.gardenCopy);
flat('line.stage', copy.stageLabels);
flat('line.unlock', copy.unlockNames);
flat('line.weight', copy.weightCopy);
flat('line.settings', copy.settingsCopy);
flat('line.export', copy.exportCopy);

const LIMITS: [RegExp, number][] = [
  [/^(toast\.|log\.|comeback$|surprise$)/, 60],
  [/^button\./, 16],
  [/^title\./, 28],
  [/^push\.title\./, 24],
  [/^push\.body\./, 60],
  [/^line\./, 72],
];

const errors: string[] = [];
for (const [key, raw] of entries) {
  const text = raw.replace(/\{\w+\}/g, 'xx');
  const f = fold(raw);
  for (const [re, max] of LIMITS)
    if (re.test(key) && text.length > max) errors.push(`${key}: ${text.length} chars > ${max} — "${raw}"`);
  if (
    key.startsWith('button.') &&
    text
      .trim()
      .split(/\s+/)
      .filter((w) => /\p{L}/u.test(w)).length > 3
  )
    errors.push(`${key}: more than 3 words — "${raw}"`);
  for (const b of BANNED) {
    if (key.startsWith('weight.') && b === 'peso ideal') continue;
    if (f.includes(b)) errors.push(`${key}: banned "${b}" — "${raw}"`);
  }
  for (const p of FIRST_PERSON)
    if (` ${f} `.includes(p)) errors.push(`${key}: app speaking in first person "${p.trim()}" — "${raw}"`);
  if ((raw.match(/!/g) ?? []).length > 1) errors.push(`${key}: more than one "!" — "${raw}"`);
  if (key.startsWith('push.')) {
    const maxWords = key.startsWith('push.title.') ? 3 : 8;
    const words = raw
      .replace(/\{slot\}/g, 'Colación')
      .trim()
      .split(/\s+/).length;
    if (words > maxWords) errors.push(`${key}: more than ${maxWords} words — "${raw}"`);
  }
  for (const w of raw.split(/[^\p{L}]+/u))
    if (w.length > 3 && w === w.toUpperCase() && /\p{Lu}/u.test(w)) errors.push(`${key}: ALL-CAPS "${w}"`);
  for (const sentence of raw.split(/[.!?¿¡]+/)) {
    const words = sentence.trim().split(/\s+/).filter(Boolean).length;
    if (words > 12) errors.push(`${key}: sentence over 12 words — "${raw}"`);
  }
}
for (const [key, list] of Object.entries(copy.pools)) {
  const frequent = /^(log\.|comeback$|dayClose\.|surprise$|push\.body\.)/.test(key);
  if (frequent && !NOT_POOLS.has(key) && list.length < 5)
    errors.push(`${key}: pool has ${list.length} variants (needs ≥ 5)`);
}

if (errors.length) {
  console.error(`copy:lint — ${errors.length} problem(s):\n${errors.map((e) => `  • ${e}`).join('\n')}`);
  process.exit(1);
}
console.log(`copy:lint ok — ${entries.length} strings checked.`);
