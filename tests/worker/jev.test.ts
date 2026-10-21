import { env } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, pair } from './helpers';

const answers = (yes: string[], extra: Record<string, number> = {}) => ({
  model: 'jev-1.13.0',
  answers: Object.fromEntries(
    ['food', 'free', 'carb', 'protein', 'legume', 'dairy', 'fruit', 'veg', 'fat', 'nuts', 'sugar'].map((k) => [
      k,
      { type: 'noul', noul: extra[k] ?? (yes.includes(k) ? 0.93 : 0.04) },
    ]),
  ),
  usage: { input_tokens: 300, output_tokens: 11 },
});
const classify = (cookie: string, items: string[]) =>
  api('/api/ai/classify', { method: 'POST', cookie, body: JSON.stringify({ items }) });

const keyed = env as unknown as { JEV_API_KEY?: string };
beforeEach(async () => {
  keyed.JEV_API_KEY = 'jev-test-key';
  await env.DB.batch([
    env.DB.prepare("DELETE FROM ai_cache WHERE job = 'classify'"),
    env.DB.prepare("DELETE FROM auth_attempts WHERE ip LIKE 'jev:%'"),
  ]);
});
afterEach(() => {
  delete keyed.JEV_API_KEY;
  vi.restoreAllMocks();
});

describe('JEV live categorization', () => {
  it('asks System One typed yes/no questions and returns the food groups of each phrase', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      expect(String(url)).toBe('https://api.typesafe.ai/v1/systemone');
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer jev-test-key');
      const body = JSON.parse(String(init?.body));
      expect(body.model).toBe('jev-latest');
      expect(body.state.comida).toBeTypeOf('string');
      expect(Object.values(body.questions).every((q) => (q as { type: string }).type === 'noul')).toBe(true);
      return Response.json(
        body.state.comida === 'café negro' ? answers(['food'], { free: 0.9 }) : answers(['food', 'carb', 'protein']),
      );
    });
    const res = await classify(await pair(), ['3 tacos de pollo', 'café negro']);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      items: [
        { text: '3 tacos de pollo', food: 0.93, free: false, groups: ['carb', 'protein'] },
        { text: 'café negro', food: 0.93, free: true, groups: [] },
      ],
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('caches by normalized phrase, so repeated words cost nothing', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(answers(['food', 'veg'])));
    const cookie = await pair();
    await classify(cookie, ['Nopales asados']);
    const again = await classify(cookie, ['  nopales   ASADOS ']);
    expect(await again.json()).toMatchObject({ items: [{ text: 'nopales   ASADOS', groups: ['veg'] }] });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('leaves out a phrase JEV could not answer instead of failing the request', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('busy', { status: 503 }));
    const res = await classify(await pair(), ['mole']);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: [] });
  });

  it('is unavailable without a key, and validates input', async () => {
    const cookie = await pair();
    delete keyed.JEV_API_KEY;
    const fetch = vi.spyOn(globalThis, 'fetch');
    expect((await classify(cookie, ['mole'])).status).toBe(503);
    keyed.JEV_API_KEY = 'jev-test-key';
    expect((await classify(cookie, [])).status).toBe(400);
    expect((await classify(cookie, ['x'.repeat(81)])).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
    expect((await classify('', ['mole'])).status).toBe(401);
  });
});
