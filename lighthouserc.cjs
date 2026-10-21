const { chromium } = require('@playwright/test');

const origin = process.env.LHCI_URL || 'http://localhost:4174';

module.exports = {
  ci: {
    collect: {
      url: [origin],
      ...(process.env.LHCI_URL
        ? {}
        : {
            startServerCommand: 'npm run preview -- --port 4174 --strictPort',
            startServerReadyPattern: 'Local:',
            startServerReadyTimeout: 60000,
          }),
      chromePath: chromium.executablePath(),
      puppeteerScript: './scripts/lighthouse-auth.cjs',
      puppeteerLaunchOptions: { headless: true },
      numberOfRuns: 3,
      settings: {
        onlyCategories: ['performance', 'accessibility', 'best-practices'],
        disableStorageReset: true,
        // Prevent deferred descriptions from calling AI during production audits.
        ...(process.env.LHCI_URL
          ? { blockedUrlPatterns: ['*://*/api/ai/*', '*://*/api/sync', '*://*/api/telemetry'] }
          : {}),
      },
    },
    assert: {
      // Every measured run must meet the roadmap, not only the best one.
      aggregationMethod: 'pessimistic',
      assertions: {
        'categories:performance': ['error', { minScore: 0.95 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.95 }],
        'label-content-name-mismatch': ['error', { minScore: 1 }],
      },
    },
    // Authenticated reports may contain the owner's plan. Keep every report local.
    upload: { target: 'filesystem', outputDir: '.lighthouseci/reports' },
  },
};
