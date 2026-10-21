// Generate once; never print the private key or rotate an existing identity implicitly.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

mkdirSync('private', { recursive: true });
const path = 'private/vapid-private.json';
let key: JsonWebKey;
if (existsSync(path)) key = JSON.parse(readFileSync(path, 'utf8'));
else {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  key = await crypto.subtle.exportKey('jwk', pair.privateKey);
  writeFileSync(path, JSON.stringify(key), { mode: 0o600, flag: 'wx' });
}
if (!key.d || !key.x || !key.y) throw new Error('Invalid existing VAPID identity.');
const bytes = Buffer.concat([Buffer.from([4]), Buffer.from(key.x, 'base64url'), Buffer.from(key.y, 'base64url')]);
writeFileSync('private/vapid-public.txt', bytes.toString('base64url'), { mode: 0o600 });
console.log('VAPID identity ready in ignored private files; no keys printed.');
