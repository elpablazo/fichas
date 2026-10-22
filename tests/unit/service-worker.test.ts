import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { expect, it, vi } from 'vitest';

// Execute the real install handler with browser API doubles, including HTTP failures and retries.
const script = stripTypeScriptTypes(readFileSync('src/client/sw.ts', 'utf8')).replace('export {};', '');
function installer(
  cache: Map<string, Response>,
  fetch: (url: string) => Promise<Response>,
  registration?: { active: object | null },
) {
  const handlers = new Map<string, (event: { waitUntil: (promise: Promise<void>) => void; data?: unknown }) => void>();
  const skipWaiting = vi.fn();
  runInNewContext(script, {
    URL,
    Response,
    fetch,
    caches: {
      open: async () => ({
        match: async (url: string) => cache.get(new URL(url, 'https://fichas.test').href),
        keys: async () => [...cache.keys()].map((url) => ({ url })),
        put: async (url: string, response: Response) => {
          cache.set(new URL(url, 'https://fichas.test').href, response);
        },
      }),
    },
    self: {
      location: { origin: 'https://fichas.test' },
      __WB_MANIFEST: [
        { url: '/', revision: 'new-shell' },
        { url: '/required.js', revision: null },
      ],
      addEventListener: (
        name: string,
        handler: (event: { waitUntil: (promise: Promise<void>) => void; data?: unknown }) => void,
      ) => handlers.set(name, handler),
      skipWaiting,
      registration,
    },
  });
  return {
    skipWaiting,
    message: (data: unknown) => handlers.get('message')!({ waitUntil: () => {}, data }),
    install: () =>
      new Promise<void>((resolve, reject) => {
        handlers.get('install')!({ waitUntil: (promise) => void promise.then(resolve, reject) });
      }),
  };
}

it.each([404, 503])(
  'keeps the previous offline shell when a required asset returns %i, then retries',
  async (status) => {
    const oldKey = 'https://fichas.test/?__rev=old-shell';
    const cache = new Map([[oldKey, new Response('previous working shell')]]);
    const fetch = vi.fn(
      async (url: string) =>
        new Response(url === '/' ? 'new shell' : 'unavailable', {
          status: url === '/' ? 200 : status,
        }),
    );
    const failed = installer(cache, fetch);
    await expect(failed.install()).rejects.toThrow(`Precache failed: ${status}`);
    expect(failed.skipWaiting).not.toHaveBeenCalled();
    expect(await cache.get(oldKey)!.clone().text()).toBe('previous working shell');
    expect(cache.has('https://fichas.test/required.js')).toBe(false);

    const retryFetch = vi.fn(
      async () => new Response('complete asset', { headers: { 'Content-Type': 'text/javascript' } }),
    );
    const retry = installer(cache, retryFetch);
    await retry.install();
    expect(retry.skipWaiting).toHaveBeenCalledOnce();
    expect(retryFetch).toHaveBeenCalledWith('/required.js', { cache: 'reload' });
    expect(await cache.get('https://fichas.test/required.js')!.text()).toBe('complete asset');
    expect(cache.has(oldKey)).toBe(true);
  },
);

it('rejects a network failure without activating the incomplete version', async () => {
  const worker = installer(new Map(), async () => {
    throw new Error('Offline');
  });
  await expect(worker.install()).rejects.toThrow('Offline');
  expect(worker.skipWaiting).not.toHaveBeenCalled();
});

it('rejects an HTML SPA fallback masquerading as a successful script download', async () => {
  const worker = installer(
    new Map(),
    async () =>
      new Response('<html>shell</html>', {
        headers: { 'Content-Type': 'text/html' },
      }),
  );
  await expect(worker.install()).rejects.toThrow('Precache received an invalid asset');
  expect(worker.skipWaiting).not.toHaveBeenCalled();
});

it('repairs invalid assets left in the cache by an earlier version', async () => {
  const key = 'https://fichas.test/required.js';
  const cache = new Map([[key, new Response('<html>fallback</html>', { headers: { 'Content-Type': 'text/html' } })]]);
  const worker = installer(
    cache,
    async () =>
      new Response('recovered', {
        headers: { 'Content-Type': 'application/javascript' },
      }),
  );
  await worker.install();
  expect(worker.skipWaiting).toHaveBeenCalledOnce();
  expect(await cache.get(key)!.text()).toBe('recovered');
});

it('an update waits for the app to ask, when the running version can ask', async () => {
  const ok = async () => new Response('asset', { headers: { 'Content-Type': 'text/javascript' } });
  // The running version (2.0+) marked that it shows the "Actualizar" toast.
  const cache = new Map([['https://fichas.test/__asks-to-update', new Response('1')]]);
  const worker = installer(cache, ok, { active: {} });
  await worker.install();
  expect(worker.skipWaiting).not.toHaveBeenCalled();
  worker.message({ type: 'SKIP_WAITING' });
  expect(worker.skipWaiting).toHaveBeenCalledOnce();
});

it('an update over a version without the toast takes over at once', async () => {
  const ok = async () => new Response('asset', { headers: { 'Content-Type': 'text/javascript' } });
  const worker = installer(new Map(), ok, { active: {} });
  await worker.install();
  expect(worker.skipWaiting).toHaveBeenCalledOnce();
});
