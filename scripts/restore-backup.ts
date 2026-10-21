import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { restoreSql } from '../src/shared/restore';

const file = process.argv[2];
if (!file || process.argv.includes('--remote'))
  throw new Error('Usage: npm run backup:restore -- private/<backup>.json (fresh local database only).');
const { sql, counts } = restoreSql(JSON.parse(readFileSync(file, 'utf8')));
const scratch = resolve(`private/restore-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`);
mkdirSync(scratch, { recursive: true, mode: 0o700 });
const sqlPath = `${scratch}/restore.sql`;
writeFileSync(sqlPath, sql, { mode: 0o600 });
const cli = ['./node_modules/wrangler/bin/wrangler.js'];
execFileSync('node', [...cli, 'd1', 'migrations', 'apply', 'fichas-db', '--local', '--persist-to', scratch], {
  stdio: 'ignore',
});
execFileSync('node', [...cli, 'd1', 'execute', 'fichas-db', '--local', '--persist-to', scratch, '--file', sqlPath], {
  stdio: 'ignore',
});
const query = Object.keys(counts)
  .map((t) => `SELECT '${t}' AS name,COUNT(*) AS n FROM ${t}`)
  .join(';');
const result = JSON.parse(
  execFileSync(
    'node',
    [...cli, 'd1', 'execute', 'fichas-db', '--local', '--persist-to', scratch, '--command', query, '--json'],
    { encoding: 'utf8' },
  ),
);
const restored = result.flatMap((statement: { results: { name: string; n: number }[] }) => statement.results);
if (restored.length !== Object.keys(counts).length) throw new Error('Incomplete count verification.');
for (const row of restored) if (row.n !== counts[row.name]) throw new Error(`Count mismatch: ${row.name}`);
console.log(`Backup restored and counts verified in isolated local database: ${scratch}`);
