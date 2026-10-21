// Fresh local D1/R2 for an E2E run: wipe .wrangler/state, migrate, seed. (No server may be running.)
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';

rmSync('.wrangler/state', { recursive: true, force: true });
const wrangler = ['./node_modules/wrangler/bin/wrangler.js'];
execFileSync('node', [...wrangler, 'd1', 'migrations', 'apply', 'fichas-db', '--local'], { stdio: 'ignore' });
execFileSync('npx', ['tsx', 'scripts/seed-plan.ts', '--local'], { stdio: 'ignore' });
console.log('e2e: local D1 reset, migrated and seeded');
