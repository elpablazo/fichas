// Create a private Cloudflare backup, download it locally and restore into a fresh local D1 database.
// Never restores/replaces production rows. Never prints file contents or credentials.
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium, expect } from '@playwright/test';

const origin = 'https://fichas.toolco.workers.dev';
const browser = await chromium.launch();
const context = await browser.newContext();
try {
  const pairing = await context.request.post(`${origin}/api/auth/pair`, {
    headers: { 'X-Fichas': '1' },
    data: { code: readFileSync('private/pairing-code.txt', 'utf8').trim(), label: 'backup verification' },
  });
  expect(pairing.status()).toBe(204);
  const created = await context.request.post(`${origin}/api/backups`, { headers: { 'X-Fichas': '1' } });
  expect(created.status()).toBe(201);
  const { key } = (await created.json()) as { key: string };
  const date = key.slice(7, 17);
  const backup = await context.request.get(`${origin}/api/backups/${date}`);
  expect(backup.status()).toBe(200);
  mkdirSync('private/backups', { recursive: true, mode: 0o700 });
  const file = `private/backups/${date}.json`;
  writeFileSync(file, await backup.body(), { mode: 0o600 });
  chmodSync(file, 0o600);
  const rows = JSON.parse(readFileSync(file, 'utf8'));
  for (const plan of rows.plans) {
    const keys = JSON.parse(plan.source_keys);
    for (let n = 0; n < keys.length; n++) {
      const original = await context.request.get(`${origin}/api/plans/${encodeURIComponent(plan.id)}/files/${n}`);
      if (plan.status === 'active' || plan.status === 'archived') expect(original.status()).toBe(200);
    }
  }
  execFileSync('node', ['--import', 'tsx', 'scripts/restore-backup.ts', file], { stdio: 'inherit' });
  console.log('✓ Private R2 backup, confirmed original files and isolated local D1 recovery verified.');
} finally {
  await context.request.post(`${origin}/api/auth/logout`, { headers: { 'X-Fichas': '1' } });
  await browser.close();
}
