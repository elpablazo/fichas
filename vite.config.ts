import { readFileSync } from 'node:fs';
import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { serviceWorker } from './scripts/vite-sw';

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [cloudflare(), tailwindcss(), serviceWorker()],
  oxc: { jsx: { runtime: 'automatic', importSource: 'preact' } },
  build: { target: 'es2022' },
  environments: {
    client: {
      build: {
        rollupOptions: {
          input: { index: 'index.html', sw: 'src/client/sw.ts' },
          output: {
            entryFileNames: (chunk) => (chunk.name === 'sw' ? 'sw.js' : 'assets/[name]-[hash].js'),
          },
        },
      },
    },
  },
});
