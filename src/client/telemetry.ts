// Client errors + UX timings (§16): performance marks and batched POST /api/telemetry. No food text, ever.
import { db } from './db/dexie';

interface UxEvent {
  id: string;
  at: number;
  name: string;
  ms: number | null;
  taps: number | null;
  ctx: string | null;
}
interface ErrEvent {
  id: string;
  at: number;
  message: string;
  stack: string | null;
  ctx: string | null;
}

type PendingEvent = { kind: 'ux'; event: UxEvent } | { kind: 'error'; event: ErrEvent };
const PREFIX = 'telemetry:';
const MAX_QUEUED = 500;
const MAX_BYTES = 60_000; // Fetch keepalive has a 64 KiB body budget.
let writes: Promise<void> = Promise.resolve();
let sending: Promise<void> | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let firstLogRecorded = false;
let openedAt = 0;
let taps = 0;
let errorCount = 0;

function enqueue(value: PendingEvent): void {
  const key = `${PREFIX}${String(value.event.at).padStart(13, '0')}:${value.event.id}`;
  writes = writes
    .then(() =>
      db.transaction('rw', db.local, async () => {
        await db.local.put({ key, value });
        const keys = await db.local.where('key').startsWith(PREFIX).primaryKeys();
        if (keys.length > MAX_QUEUED) await db.local.bulkDelete(keys.slice(0, keys.length - MAX_QUEUED));
      }),
    )
    .catch(() => {}); // Storage errors must never block logging or recursively report themselves.
  schedule();
}

export function markUx(name: string): void {
  try {
    performance.mark(name);
  } catch {
    // marks are best-effort
  }
  if (name === 'log:tap' && !firstLogRecorded) {
    firstLogRecorded = true;
    record('open_to_first_log', Math.round(performance.now() - openedAt), taps);
  }
}

export function countTap(): void {
  taps++;
}

export function record(
  name: string,
  ms: number | null,
  tapCount: number | null = null,
  ctx: string | null = null,
): void {
  enqueue({ kind: 'ux', event: { id: crypto.randomUUID(), at: Date.now(), name, ms, taps: tapCount, ctx } });
}

export function reportError(message: string, stack?: string | null, ctx?: string | null): void {
  if (errorCount >= 20) return;
  errorCount++;
  enqueue({
    kind: 'error',
    event: {
      id: crypto.randomUUID(),
      at: Date.now(),
      message: message.slice(0, 500),
      stack: stack?.slice(0, 4000) ?? null,
      ctx: ctx ?? null,
    },
  });
}

function schedule(): void {
  if (timer) return;
  timer = setTimeout(() => {
    timer = undefined;
    void flush();
  }, 10_000);
}

export function flush(): Promise<void> {
  if (sending) return sending;
  sending = (async () => {
    try {
      await writes;
      if (!navigator.onLine) return;
      const rows = await db.local.where('key').startsWith(PREFIX).toArray();
      const ux: UxEvent[] = [],
        errors: ErrEvent[] = [],
        keys: string[] = [];
      let bytes = 24;
      for (const row of rows) {
        const value = row.value as PendingEvent;
        const size = new TextEncoder().encode(JSON.stringify(value.event)).length + 1;
        if (bytes + size > MAX_BYTES || ux.length >= 200 || errors.length >= 50) break;
        bytes += size;
        if (value.kind === 'ux') ux.push(value.event);
        else errors.push(value.event);
        keys.push(row.key);
      }
      if (!keys.length) return;
      const response = await fetch('/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Fichas': '1' },
        body: JSON.stringify({ errors, ux }),
        keepalive: true,
        credentials: 'same-origin',
      });
      // IDs are stable across retries; the server's INSERT OR IGNORE also handles a lost acknowledgement.
      if (response.ok) await db.local.bulkDelete(keys);
      if (response.status !== 401 && (await db.local.where('key').startsWith(PREFIX).count())) schedule();
    } catch {
      schedule();
    } finally {
      sending = null;
    }
  })();
  return sending;
}

export function startTelemetry(): void {
  window.addEventListener('error', (e) => reportError(e.message, e.error?.stack ?? null, 'window'));
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason as { message?: string; stack?: string } | undefined;
    reportError(r?.message ?? String(e.reason), r?.stack ?? null, 'promise');
  });
  document.addEventListener('pointerdown', countTap, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flush();
    else {
      openedAt = performance.now();
      firstLogRecorded = false;
      taps = 0;
      errorCount = 0;
      void flush();
    }
  });
  window.addEventListener('online', () => void flush());
  schedule(); // Resume the persistent queue after a reload, even without a new interaction.
}
