const { readFileSync } = require('node:fs');

module.exports = async (browser, { url }) => {
  const code = process.env.LHCI_URL
    ? readFileSync('private/pairing-code.txt', 'utf8').trim()
    : readFileSync('.dev.vars', 'utf8').match(/^OWNER_PAIRING_CODE="([^"]+)"/m)?.[1];
  if (!code) throw new Error('Missing Lighthouse pairing code.');
  const page = await browser.newPage();
  try {
    if (process.env.LHCI_URL) {
      // The warm-up page is also read-only; Lighthouse blocks AI for subsequent audit pages.
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        const path = new URL(request.url()).pathname;
        if (path === '/api/telemetry') return request.respond({ status: 204 });
        if (path.startsWith('/api/ai/')) return request.abort();
        if (path === '/api/sync' && request.method() === 'POST')
          return request.respond({ status: 503, contentType: 'application/json', body: '{}' });
        return request.continue();
      });
    }
    // Retry a transient empty response only while connecting the initial warm-up page.
    // Measured Lighthouse navigations retain their normal failure behavior.
    for (let attempt = 0; ; attempt++) {
      try {
        await page.goto(url);
        break;
      } catch (error) {
        if (attempt === 2 || !String(error).includes('net::ERR_EMPTY_RESPONSE')) throw error;
        await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
      }
    }
    const status = await page.evaluate(
      async ({ code, label }) => {
        const response = await fetch('/api/auth/pair', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Fichas': '1' },
          body: JSON.stringify({ code, label }),
        });
        return response.status;
      },
      { code, label: process.env.LHCI_SESSION_LABEL || 'Lighthouse' },
    );
    if (status !== 204) throw new Error(`Lighthouse pairing failed: HTTP ${status}`);
    await page.reload();
    await page.waitForSelector('[data-card]', { timeout: 15000 });
    await page.waitForFunction(() => localStorage.getItem('today:snapshot') !== null);
    await page.waitForFunction(
      async () => (await navigator.serviceWorker.getRegistration())?.active?.state === 'activated',
    );
  } finally {
    await page.close();
  }
};
