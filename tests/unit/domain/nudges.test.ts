import { describe, expect, it } from 'vitest';
import { addDays } from '../../../src/shared/domain/day';
import {
  backedOff,
  DEFAULT_NOTIFICATIONS,
  decideNudges,
  inQuietHours,
  type NotificationRecord,
  type NudgeState,
} from '../../../src/shared/domain/nudges';
import type { PlanRow } from '../../../src/shared/domain/types';
import { log, plan } from '../helpers';

const day = '2026-10-15';
const at = (time: string, d = day) => Date.parse(`${d}T${time}:00-06:00`);
const p: PlanRow = {
  id: 'plan-2026-10-08',
  season: 1,
  status: 'active',
  issued_on: '2026-10-08',
  starts_on: '2026-10-08',
  ends_on: null,
  data: { ...plan, slots: [{ ...plan.slots[2]!, time: '14:30' }] },
  source_keys: [],
  source_sha256: null,
  created_at: 1,
  confirmed_at: 1,
  updated_at: 1,
  rev: 1,
};
const state = (): NudgeState => ({
  plan: p,
  logs: [],
  notifications: [],
  preferences: { ...DEFAULT_NOTIFICATIONS, enabled: true, slots: {} },
  tz: 'America/Mexico_City',
  dayStart: 4,
  lastSeen: null,
  hasSubscription: true,
});
const notification = (d = day, extra: Partial<NotificationRecord> = {}): NotificationRecord => ({
  id: `slot:${d}:comida`,
  day: d,
  slot: 'comida',
  plan_id: p.id,
  kind: 'slot',
  sent_at: at('15:30', d),
  acted_at: null,
  delivery_status: 'sent',
  ...extra,
});

describe('M6 scheduler scenario table', () => {
  const cases: [string, (s: NudgeState) => void, string, number][] = [
    ['eligible', () => {}, '15:15', 1],
    ['before start', () => {}, '15:14', 0],
    ['inside window', () => {}, '16:44', 1],
    ['exclusive end', () => {}, '16:45', 0],
    [
      'no subscription',
      (s) => {
        s.hasSubscription = false;
      },
      '15:30',
      0,
    ],
    [
      'master off',
      (s) => {
        s.preferences.enabled = false;
      },
      '15:30',
      0,
    ],
    [
      'paused',
      (s) => {
        s.preferences.paused_until = at('17:00');
      },
      '15:30',
      0,
    ],
    [
      'pause expires',
      (s) => {
        s.preferences.paused_until = at('15:30');
      },
      '15:30',
      1,
    ],
    [
      'same-day quiet',
      (s) => {
        s.preferences.quiet = ['15:00', '17:00'];
      },
      '15:30',
      0,
    ],
    [
      'quiet end',
      (s) => {
        s.preferences.quiet = ['14:00', '15:30'];
      },
      '15:30',
      1,
    ],
    [
      'slot off',
      (s) => {
        s.preferences.slots.comida = false;
      },
      '15:30',
      0,
    ],
    [
      'one notification capacity',
      (s) => {
        s.notifications = [notification(day, { kind: 'test', slot: null })];
      },
      '15:30',
      1,
    ],
    [
      'daily cap',
      (s) => {
        s.notifications = [notification(), notification(day, { id: 'test', kind: 'test' })];
      },
      '15:30',
      0,
    ],
    [
      'failed counts toward cap',
      (s) => {
        s.notifications = [
          notification(day, { delivery_status: 'failed' }),
          notification(day, { id: 'x', delivery_status: 'reserved' }),
        ];
      },
      '15:30',
      0,
    ],
    [
      'prior-day not cap',
      (s) => {
        s.notifications = [notification(addDays(day, -1))];
      },
      '15:30',
      1,
    ],
    [
      'duplicate slot',
      (s) => {
        s.notifications = [notification()];
      },
      '15:30',
      0,
    ],
    [
      'active owner',
      (s) => {
        s.lastSeen = at('15:01');
      },
      '15:30',
      0,
    ],
    [
      '30-minute inactivity boundary',
      (s) => {
        s.lastSeen = at('15:00');
      },
      '15:30',
      1,
    ],
    [
      'meal resolves',
      (s) => {
        s.logs = [log(day, 'comida', [], { kind: 'meal' })];
      },
      '15:30',
      0,
    ],
    [
      'skip resolves',
      (s) => {
        s.logs = [log(day, 'comida', [], { kind: 'skip' })];
      },
      '15:30',
      0,
    ],
    [
      'free does not resolve',
      (s) => {
        s.logs = [log(day, 'comida', [], { kind: 'free' })];
      },
      '15:30',
      1,
    ],
    [
      'deleted meal does not resolve',
      (s) => {
        s.logs = [log(day, 'comida', [], { deleted_at: 1 })];
      },
      '15:30',
      1,
    ],
    [
      'other slot independent',
      (s) => {
        s.logs = [log(day, 'cena', [])];
      },
      '15:30',
      1,
    ],
    [
      'no plan',
      (s) => {
        s.plan = null;
      },
      '15:30',
      0,
    ],
    [
      'future plan',
      (s) => {
        s.plan = { ...p, starts_on: '2026-10-16' };
      },
      '15:30',
      0,
    ],
    [
      'ended plan',
      (s) => {
        s.plan = { ...p, ends_on: '2026-10-14' };
      },
      '15:30',
      0,
    ],
    [
      '14-day renewal noon',
      (s) => {
        s.plan = { ...p, issued_on: '2026-10-01' };
      },
      '12:00',
      1,
    ],
    ['no premature renewal', () => {}, '12:00', 0],
    [
      'renewal only noon window',
      (s) => {
        s.plan = { ...p, issued_on: '2026-10-01' };
      },
      '12:15',
      0,
    ],
    [
      'renewal duplicate',
      (s) => {
        s.plan = { ...p, issued_on: '2026-10-01' };
        s.notifications = [notification(day, { id: `plan:${p.id}:14`, kind: 'plan' })];
      },
      '12:00',
      0,
    ],
    [
      '21-day second renewal',
      (s) => {
        s.plan = { ...p, issued_on: '2026-09-24' };
        s.notifications = [notification(addDays(day, -7), { id: `plan:${p.id}:14`, kind: 'plan' })];
      },
      '12:00',
      1,
    ],
    [
      'late renewals not together',
      (s) => {
        s.plan = { ...p, issued_on: '2026-09-01' };
      },
      '12:00',
      1,
    ],
  ];
  it.each(cases)('%s', (_name, modify, time, count) => {
    const s = state();
    modify(s);
    const nudges = decideNudges(s, at(time));
    expect(nudges).toHaveLength(count);
    if (nudges[0]?.kind === 'slot') expect(nudges[0].url).toBe('/?slot=comida&src=push');
  });
  it('uses timezone, overnight quiet boundaries and app day rollover', () => {
    expect(inQuietHours(at('22:30'), state().tz, ['22:30', '09:00'])).toBe(true);
    expect(inQuietHours(at('08:59'), state().tz, ['22:30', '09:00'])).toBe(true);
    expect(inQuietHours(at('09:00'), state().tz, ['22:30', '09:00'])).toBe(false);
    const s = state();
    s.preferences.quiet = ['03:00', '03:00'];
    s.plan = { ...p, data: { ...p.data, slots: [{ ...p.data.slots[0]!, time: '23:30' }] } };
    expect(decideNudges(s, at('00:30', addDays(day, 1)))[0]?.day).toBe(day);
  });
  it('learns median meal time with three samples', () => {
    const s = state();
    s.logs = [1, 2, 3].map((n) => log(addDays(day, -n), 'comida', [], { eaten_at: at('15:30', addDays(day, -n)) }));
    expect(decideNudges(s, at('15:15'))).toHaveLength(0);
    expect(decideNudges(s, at('16:15'))).toHaveLength(1);
  });
  it('three ignored nudges back off seven days; timely log resets, late/free/deleted do not', () => {
    const ns = [3, 2, 1].map((n) => notification(addDays(day, -n)));
    expect(backedOff('comida', ns.slice(0, 2), [], at('15:30'))).toBe(false);
    expect(backedOff('comida', ns, [], at('15:30'))).toBe(true);
    expect(backedOff('comida', ns, [], ns[2]!.sent_at + 3 * 3600000 + 7 * 86400000)).toBe(false);
    const timely = log(ns[1]!.day, 'comida', [], { eaten_at: ns[1]!.sent_at + 3600000 });
    expect(backedOff('comida', ns, [timely], at('15:30'))).toBe(false);
    expect(backedOff('comida', ns, [{ ...timely, kind: 'free' }], at('15:30'))).toBe(true);
    expect(backedOff('comida', ns, [{ ...timely, deleted_at: 1 }], at('15:30'))).toBe(true);
    expect(
      backedOff(
        'comida',
        ns.map((n) => ({ ...n, delivery_status: 'failed' })),
        [],
        at('15:30'),
      ),
    ).toBe(false);
  });
});
