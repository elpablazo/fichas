import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: { name: 'unit', include: ['tests/unit/**/*.test.ts'], environment: 'node' },
      },
      {
        plugins: [
          cloudflareTest(async () => ({
            wrangler: { configPath: './wrangler.jsonc' },
            miniflare: {
              bindings: {
                TEST_MIGRATIONS: await readD1Migrations('./migrations'),
                OWNER_PAIRING_CODE: 'mango nopal tortilla pepino limon cacao',
                OPENROUTER_API_KEY: 'test-key',
                OPENROUTER_BASE_URL: 'https://mock.openrouter.test/api/v1',
                MODEL_FAST: 'test/fast',
                MODEL_PLAN_A: 'test/plan-a',
                MODEL_PLAN_B: 'test/plan-b',
                MODEL_VISION: 'test/vision',
                BACKUPS_ENABLED: 'true',
              },
            },
          })),
        ],
        test: {
          name: 'worker',
          include: ['tests/worker/**/*.test.ts'],
          setupFiles: ['./tests/worker/setup.ts'],
        },
      },
    ],
  },
});
