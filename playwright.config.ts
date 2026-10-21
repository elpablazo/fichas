import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
export const AUTH_FILE = '.playwright/auth.json';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    serviceWorkers: 'block',
    timezoneId: 'America/Mexico_City',
    locale: 'es-MX',
  },
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'iphone',
      testMatch: /\.spec\.ts/,
      use: { ...devices['iPhone 13'], storageState: AUTH_FILE },
      dependencies: ['setup'],
    },
    {
      name: 'pixel',
      testMatch: /\.spec\.ts/,
      use: { ...devices['Pixel 7'], storageState: AUTH_FILE },
      dependencies: ['setup'],
    },
  ],
});
