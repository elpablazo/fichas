// Text normalization helpers for matching Spanish food text.

export function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Lowercase, strip accents, keep letters/digits/fraction glyphs, collapse spaces. */
export function norm(s: string): string {
  return stripAccents(s.toLowerCase())
    .replace(/(\d)([a-z])/g, '$1 $2') // "120g" → "120 g"
    .replace(/[^a-z0-9½¼¾⅓⅔/.+ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function slug(s: string): string {
  return stripAccents(s.toLowerCase())
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Candidate singular forms of a normalized word, most specific first. */
export function singularCandidates(w: string): string[] {
  const out = [w];
  if (w.length > 3 && w.endsWith('ces')) out.push(`${w.slice(0, -3)}z`);
  if (w.length > 3 && w.endsWith('es')) out.push(w.slice(0, -2));
  if (w.length > 2 && w.endsWith('s')) out.push(w.slice(0, -1));
  return out;
}

/** Spanish plural of a food phrase: pluralizes the head noun only ("tortilla de maíz" → "tortillas de maíz"). */
export function pluralize(phrase: string): string {
  const [head, ...rest] = phrase.split(' ');
  if (!head) return phrase;
  let p: string;
  if (/[aeiouáéó]$/i.test(head)) p = `${head}s`;
  else if (/z$/i.test(head)) p = `${head.slice(0, -1)}ces`;
  else if (/s$/i.test(head)) p = head;
  else p = `${stripTildeOnLastVowel(head)}es`;
  return [p, ...rest].join(' ');
}

function stripTildeOnLastVowel(w: string): string {
  // "limón" → "limon" (+es = "limones"), "melón" → "melones"
  return w.replace(/[áéíóú](?=[^aeiouáéíóú]*$)/, (c) => stripAccents(c));
}

export function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
