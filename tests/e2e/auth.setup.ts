import { readFileSync } from 'node:fs';
import { expect, test as setup } from '@playwright/test';
import { AUTH_FILE } from '../../playwright.config';

setup('pair once and mark the install hint as seen', async ({ request }) => {
  const code = readFileSync('.dev.vars', 'utf8').match(/OWNER_PAIRING_CODE="([^"]+)"/)?.[1] ?? '';
  const res = await request.post('/api/auth/pair', { headers: { 'X-Fichas': '1' }, data: { code, label: 'e2e' } });
  expect(res.status()).toBe(204);
  const onboarding = { install_hint: true, notif_asked: [], token_hint: false };
  const push = await request.post('/api/sync', {
    headers: { 'X-Fichas': '1' },
    data: { mutations: [{ table: 'settings', op: 'upsert', row: { key: 'onboarding', value: onboarding } }] },
  });
  expect(push.status()).toBe(200);
  await request.storageState({ path: AUTH_FILE });
});
