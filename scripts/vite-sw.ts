// Injects the precache manifest into the service worker at build time.
// Replaces vite-plugin-pwa (see docs/DECISIONS.md): the SW is built as an extra
// client entry (`sw.js`) and `self.__WB_MANIFEST` is swapped for the asset list.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Plugin } from 'vite';

const PUBLIC_PRECACHE = /\.(webmanifest|png|svg|woff2)$/;

function hash(data: string | Uint8Array): string {
  return createHash('sha256').update(data).digest('hex').slice(0, 16);
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

export function serviceWorker(): Plugin {
  return {
    name: 'fichas:sw-manifest',
    apply: 'build',
    applyToEnvironment: (env) => env.name === 'client',
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        const sw = bundle['sw.js'];
        if (sw?.type !== 'chunk') return;
        const entries: { url: string; revision: string | null }[] = [];
        for (const [file, out] of Object.entries(bundle)) {
          if (file === 'sw.js' || file.endsWith('.map')) continue;
          if (file === 'index.html') {
            const src = out.type === 'asset' ? out.source : out.code;
            entries.push({ url: '/', revision: hash(src) }); // served at '/' (assets redirect /index.html → /)
          } else if (file.startsWith('assets/')) {
            entries.push({ url: `/${file}`, revision: null }); // hashed names are their own revision
          }
        }
        const publicDir = this.environment.config.publicDir;
        if (publicDir) {
          for (const p of walk(publicDir)) {
            const rel = relative(publicDir, p).split('\\').join('/');
            if (PUBLIC_PRECACHE.test(rel)) entries.push({ url: `/${rel}`, revision: hash(readFileSync(p)) });
          }
        }
        entries.sort((a, b) => a.url.localeCompare(b.url));
        if (!sw.code.includes('self.__WB_MANIFEST')) this.error('sw.js must reference self.__WB_MANIFEST');
        sw.code = sw.code.replace('self.__WB_MANIFEST', JSON.stringify(entries));
      },
    },
  };
}
