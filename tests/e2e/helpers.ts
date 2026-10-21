import { type BrowserContext, expect, type Locator, type Page, type TestInfo } from '@playwright/test';

/** Runs per budget (p50 needs ≥ 20: `BUDGET_RUNS=20 npm run e2e`). Hard max is checked on every run. */
export const RUNS = Number(process.env.BUDGET_RUNS ?? 1);

// Records taps, JS start, the first now-card paint, log rewards (stamp/pop) and undo reverts on the page's own clock
// (Playwright's fake clock advances in real time but replaces performance marks in WebKit).
const FX = `(() => {
  const fx = { taps: [], pops: [], card: null, jsStart: null, watchHollow: false, hollow: null };
  window.__fx = fx;
  const mark = performance.mark ? performance.mark.bind(performance) : () => undefined;
  performance.mark = (name, opts) => {
    if (name === 'app:js-start' && fx.jsStart === null) fx.jsStart = performance.now();
    try { return mark(name, opts); } catch { return undefined; }
  };
  document.addEventListener('pointerdown', () => fx.taps.push(performance.now()), true);
  new MutationObserver(() => {
    const t = performance.now();
    if (fx.card === null && document.querySelector('[data-card]')) fx.card = t;
    if (document.querySelector('.anim-pop, .anim-stamp')) fx.pops.push(t);
    if (fx.watchHollow && fx.hollow === null && !document.querySelector('[data-slot=comida][data-state=done]')) fx.hollow = t;
  }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
})()`;

interface Fx {
  taps: number[];
  pops: number[];
  card: number | null;
  jsStart: number | null;
  watchHollow: boolean;
  hollow: number | null;
}
export function fx<T>(page: Page, fn: (fx: Fx) => T): Promise<T> {
  return page.evaluate(`(${fn.toString()})(window.__fx)`) as Promise<T>;
}

/** A unique app day per test, iteration and device project so tests never share a day in local D1. */
export function dayFor(info: TestInfo, test: number, iter = 0): string {
  const offset = (info.project.name === 'pixel' ? 10000 : 0) + test * 40 + iter;
  return new Date(Date.UTC(2026, 9, 20 + offset)).toISOString().slice(0, 10);
}

export async function newPage(context: BrowserContext, day: string, hhmm: string): Promise<Page> {
  const page = await context.newPage();
  await page.clock.install({ time: new Date(`${day}T${hhmm}:00-06:00`) });
  await page.addInitScript(FX);
  // iPhone 12-class proxy (§14.2): 4× CPU throttle on Chromium.
  if (context.browser()?.browserType().name() === 'chromium') {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  }
  return page;
}

/** Opens Today and waits until "Tu día" and the now card are ready (data synced). */
export async function openToday(page: Page): Promise<number> {
  const t0 = Date.now();
  await page.goto('/');
  await page.locator('[data-testid=day-card] [data-testid=day-meter]').waitFor();
  await page.locator('[data-card]').waitFor();
  return Date.now() - t0;
}

/** Writes a meal in the describe sheet and logs it (the sheet must be open). */
export async function describeAndLog(page: Page, text: string): Promise<void> {
  await page.getByTestId('describe-input').fill(text);
  await page.getByTestId('impact').waitFor();
  await page.getByTestId('log').click();
}

/** Waits until the sheets fetched right after the first paint have loaded. The installed app precaches them;
 *  browser tests run without a service worker, so going offline earlier would cut those downloads. */
export async function warm(page: Page): Promise<void> {
  await page.locator('html[data-warm]').waitFor({ state: 'attached' });
}

/** Waits for Today's banner slot to settle (rewards evaluated) and dismisses the plan-renewal card if it shows. */
export async function dismissRenewal(page: Page): Promise<void> {
  await page.locator('[data-testid=banner][data-ready]').waitFor();
  const renewal = page.getByTestId('renewal');
  if (await renewal.isVisible()) await renewal.getByRole('button', { name: 'Ahora no', exact: true }).click();
}

export class Taps {
  n = 0;
  async tap(l: Locator): Promise<void> {
    this.n++;
    await l.click();
  }
}

/** ms from the last tap to the first token pop after it. */
export function popLatency(page: Page): Promise<number> {
  return fx(page, (f) => {
    const tap = f.taps[f.taps.length - 1] ?? 0;
    const pop = f.pops.find((p) => p >= tap);
    return pop === undefined ? Number.POSITIVE_INFINITY : pop - tap;
  });
}

export function p50(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor((s.length - 1) / 2)] ?? 0;
}

export function checkBudget(name: string, times: number[], p50Max: number, hardMax: number): void {
  const med = p50(times);
  console.log(`${name}: p50 ${med} ms, max ${Math.max(...times)} ms over ${times.length} run(s)`);
  expect(Math.max(...times), `${name} hard max`).toBeLessThanOrEqual(hardMax);
  if (times.length >= 5) expect(med, `${name} p50`).toBeLessThanOrEqual(p50Max);
}

export const toast = (page: Page) => page.locator('[role=status]').filter({ hasText: /./ }).first();
