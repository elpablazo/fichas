import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CHANGELOG, newer, releasesSince } from '../../src/client/changelog';

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
const wrangler = readFileSync('wrangler.jsonc', 'utf8');

describe('changelog', () => {
  it('its newest release is the version being built (CLAUDE.md: every visible change adds a line)', () => {
    expect(CHANGELOG[0]?.version).toBe(pkg.version);
    expect(wrangler).toContain(`"APP_VERSION": "${pkg.version}"`);
    expect(CHANGELOG[0]?.items.length).toBeGreaterThan(0);
  });

  it('is ordered newest first with unique versions', () => {
    for (let i = 1; i < CHANGELOG.length; i++)
      expect(newer(CHANGELOG[i - 1]!.version, CHANGELOG[i]!.version)).toBe(true);
  });

  it('shows what is new since the last version a device saw', () => {
    expect(releasesSince('1.2.0').map((r) => r.version)).toEqual(['2.0.0']);
    expect(releasesSince('2.0.0')).toEqual([]);
    // A device that used the app before versions were recorded sees the latest release only.
    expect(releasesSince(null).map((r) => r.version)).toEqual([CHANGELOG[0]!.version]);
    expect(newer('2.10.0', '2.9.1')).toBe(true);
    expect(newer('2.0.0', '2.0.0')).toBe(false);
  });
});
