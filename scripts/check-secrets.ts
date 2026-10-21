// Fails if any file git would track contains a secret or personal file (§15). Runs in pre-commit and CI.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';

const PATTERNS: [string, RegExp][] = [
  ['OpenRouter key', /sk-or-v1-[a-f0-9]{32,}/],
  ['generic sk- key', /\bsk-[A-Za-z0-9_-]{32,}/],
  ['private key block', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['AWS key', /\bAKIA[0-9A-Z]{16}\b/],
  ['assigned secret', /(?:API_TOKEN|API_KEY|PRIVATE_KEY|PAIRING_CODE)\s*=\s*["']?[A-Za-z0-9_\-+/]{16,}/],
];

/** Exact secret values from local env files must never appear in tracked files. */
function localSecrets(): string[] {
  const out: string[] = [];
  for (const f of ['.env', '.dev.vars']) {
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, 'utf8').split('\n')) {
      const m = line.match(/^\s*[A-Z0-9_]+\s*=\s*"?([^"\n]+)"?\s*$/);
      if (m?.[1] && m[1].length >= 12) out.push(m[1]);
    }
  }
  if (existsSync('private/pairing-code.txt')) out.push(readFileSync('private/pairing-code.txt', 'utf8').trim());
  if (existsSync('private/vapid-private.json')) {
    const key = JSON.parse(readFileSync('private/vapid-private.json', 'utf8'));
    if (typeof key.d === 'string') out.push(key.d);
  }
  return out;
}

const client = process.argv.includes('--client');
function clientFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    return entry.isDirectory() ? clientFiles(path) : [path];
  });
}
const files = client
  ? clientFiles('dist/client')
  : execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean);
const secrets = localSecrets();
const problems: string[] = [];
for (const f of files) {
  if (/\.pdf$/i.test(f) || f.startsWith('private/')) problems.push(`${f}: personal file would be committed`);
  if (!existsSync(f) || (!client && /\.(png|jpg|jpeg|webp|ico)$/i.test(f))) continue;
  const text = readFileSync(f, 'utf8');
  for (const [name, re] of PATTERNS)
    if (re.test(text) && !f.endsWith('check-secrets.ts')) problems.push(`${f}: looks like a ${name}`);
  for (const s of secrets) if (text.includes(s)) problems.push(`${f}: contains a value from .env/.dev.vars/private`);
}
if (problems.length) {
  console.error(`check:secrets — ${problems.length} problem(s):\n${problems.map((p) => `  • ${p}`).join('\n')}`);
  process.exit(1);
}
console.log(`check:secrets${client ? ' client' : ''} ok — ${files.length} files scanned.`);
