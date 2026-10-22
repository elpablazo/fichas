/// <reference lib="webworker" />
// Service worker: app-shell precache (manifest injected at build), navigation fallback, push.
export {};

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: { url: string; revision: string | null }[] };

const MANIFEST = self.__WB_MANIFEST;
const CACHE = 'fichas-shell';
const META = 'fichas-meta';
const keyOf = (e: { url: string; revision: string | null }) => (e.revision ? `${e.url}?__rev=${e.revision}` : e.url);
const current = new Set(MANIFEST.map((e) => new URL(keyOf(e), self.location.origin).href));
const validAsset = (url: string, response: Response) => {
  const type = response.headers.get('Content-Type') ?? '';
  return (
    response.ok &&
    (!url.endsWith('.js') || /(java|ecma)script/i.test(type)) &&
    (!url.endsWith('.css') || type.toLowerCase().startsWith('text/css'))
  );
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.all(
        MANIFEST.map(async (e) => {
          const cached = await cache.match(keyOf(e));
          if (cached && validAsset(e.url, cached)) return;
          const res = await fetch(e.url, { cache: 'reload' });
          // Reject the install on incomplete downloads; keep the previous offline shell active.
          if (!res.ok) throw new Error(`Precache failed: ${res.status}`);
          if (!validAsset(e.url, res)) throw new Error('Precache received an invalid asset.'); // SPA fallback: HTML/200.
          // A redirected response can't answer a navigation: store a clean copy.
          await cache.put(keyOf(e), res.redirected ? new Response(await res.blob(), { headers: res.headers }) : res);
        }),
      );
      // The first install takes over at once. An update waits until the app asks for it (its "Actualizar"
      // toast), unless the running version predates that toast and could never ask.
      const asks = await (await caches.open(META)).match('/__asks-to-update');
      if (!self.registration?.active || !asks) await self.skipWaiting();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if ((event.data as { type?: string } | null)?.type === 'SKIP_WAITING') void self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Keep the previous version's files one more release so open pages can still lazy-load.
      const meta = await caches.open(META);
      const prev = new Set<string>((await (await meta.match('/__previous'))?.json().catch(() => [])) ?? []);
      const cache = await caches.open(CACHE);
      for (const req of await cache.keys()) if (!current.has(req.url) && !prev.has(req.url)) await cache.delete(req);
      await meta.put('/__previous', new Response(JSON.stringify([...current])));
      await meta.put('/__asks-to-update', new Response('1'));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (req.mode === 'navigate') {
    const shell = MANIFEST.find((e) => e.url === '/');
    event.respondWith(
      (async () => {
        try {
          const hit = shell ? await caches.match(keyOf(shell)) : undefined;
          return hit ?? (await fetch(req));
        } catch {
          return Response.error();
        }
      })(),
    );
    return;
  }
  event.respondWith(
    (async () => {
      const entry = MANIFEST.find((e) => e.url === url.pathname);
      const hit = (entry && (await caches.match(keyOf(entry)))) || (await caches.match(req.url));
      return hit ?? fetch(req);
    })(),
  );
});

self.addEventListener('push', (event) => {
  let data: { title?: string; body?: string; url?: string; tag?: string } = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    data = { body: event.data?.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Fichas', {
      body: data.body ?? '',
      icon: '/icon-192.png',
      badge: '/badge-96.png',
      tag: data.tag,
      data: { url: data.url ?? '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | null)?.url ?? '/';
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const client = all[0] as WindowClient | undefined;
      if (client) {
        await client.focus();
        client.postMessage({ navigate: url });
      } else await self.clients.openWindow(url);
    })(),
  );
});
