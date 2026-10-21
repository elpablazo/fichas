// Reward evaluation (lazy-loaded off the startup path): XP, levels, stamps, garden discoveries, surprises, comebacks.
// Rewards are persisted separately from editable logs: earned progress never rolls off or decreases.
import { addDays } from '../shared/domain/day';
import { isOccasion } from '../shared/domain/status';
import type { AchievementRow, LogRow } from '../shared/domain/types';
import { bloomed, flowerModel } from '../shared/game/garden';
import { levelProgress } from '../shared/game/levels';
import { isRare, SPECIES_BY_ID } from '../shared/game/species';
import { earnedStamps, STAMPS } from '../shared/game/stamps';
import { calendarKey, isComeback, surpriseLogs } from '../shared/game/surprise';
import { unlockFallback, unlockNames } from './copy/more';
import { pick } from './copy/pick';
import { db, getLocal, setLocal } from './db/dexie';
import { writeRows } from './db/outbox';
import type { Moment } from './game';
import { levelBefore } from './state/selectors';
import { planForDay, settings, today } from './state/signals';

function unlockName(level: number): string {
  return unlockNames[level] ?? unlockFallback;
}

/** Evaluates and persists every reward earned so far; moments only for what happened since `boot`. */
export async function evaluateRewards(boot: number, push: (m: Moment) => void): Promise<void> {
  const moments = { push };
  const [all, known, allPlans, allMenus, allRecipes] = await Promise.all([
    db.logs.toArray(),
    db.achievements.toArray(),
    db.plans.toArray(),
    db.menus.toArray(),
    db.recipes.toArray(),
  ]);
  const live = all.filter((l) => !l.deleted_at);
  const ids = new Set(known.map((a) => a.id));
  const earned: AchievementRow[] = [];
  const make = (
    kind: AchievementRow['kind'],
    key: string,
    season: number | null,
    at: number,
    text?: string,
    emoji = '✨',
    extra: Partial<Moment> = {},
  ) => {
    const id = `${kind}:${key}:${season ?? 'life'}`;
    if (ids.has(id)) return false;
    ids.add(id);
    earned.push({ id, kind, key, season, earned_at: at, seen_at: Date.now(), updated_at: Date.now(), rev: 0 });
    if (text)
      moments.push({
        text,
        emoji,
        kind: kind === 'stamp' ? 'stamp' : kind === 'level' ? 'level' : kind === 'surprise' ? 'surprise' : 'species',
        ...extra,
      });
    return true;
  };
  for (const l of live.filter(isOccasion)) make('unlock', `xp_${l.id}`, null, l.created_at);
  const xp = known.concat(earned).filter((a) => a.kind === 'unlock' && a.key.startsWith('xp_')).length;
  const level = levelProgress(xp).level;
  const recent = live.filter(
    (l) => isOccasion(l) && l.created_at >= boot && l.day === today.value && l.source !== 'backfill',
  );
  const hadProgress = known.some((a) => a.key.startsWith('xp_'));
  for (let n = 2; n <= level; n++) {
    make(
      'level',
      String(n),
      null,
      Date.now(),
      hadProgress && recent.length && n === level ? pick('level.up', { n, unlock: unlockName(n) }) : undefined,
    );
  }
  for (const p of allPlans.filter((p) => p.season !== null && p.status !== 'draft' && p.status !== 'discarded')) {
    for (const key of earnedStamps(p, live, allMenus, allRecipes, settings.value.tz, settings.value.day_start_hour)) {
      const stamp = STAMPS.find((s) => s.key === key);
      const show =
        recent.some((l) => l.plan_id === p.id) ||
        allMenus.some(
          (m) =>
            m.accepted_at &&
            m.accepted_at >= boot &&
            m.day === addDays(today.value, 1) &&
            m.day >= (p.starts_on ?? '') &&
            (!p.ends_on || m.day <= p.ends_on),
        );
      make(
        'stamp',
        key,
        p.season,
        Date.now(),
        show ? pick('stamp.earned', { name: stamp?.name ?? key }) : undefined,
        stamp?.emoji,
      );
    }
  }
  // Garden: every bloomed day discovers its species for the herbarium (kept even if logs change later).
  const byDay = new Map<string, LogRow[]>();
  for (const l of live) byDay.set(l.day, [...(byDay.get(l.day) ?? []), l]);
  const closedDay = settings.value.last_closed_day;
  for (const [d, dayLogs] of byDay) {
    const p = planForDay(allPlans, d);
    if (!p || d > today.value) continue;
    const m = flowerModel(p.data, dayLogs, d, today.value, {
      level: levelBefore(d),
      closed: d < today.value || closedDay === d,
    });
    if (!bloomed(m)) continue;
    const sp = SPECIES_BY_ID.get(m.species);
    if (!sp) continue;
    const fresh = recent.some((l) => l.day === d) || (d === today.value && closedDay === d);
    const isNew = make(
      'unlock',
      `species_${sp.id}`,
      null,
      Date.now(),
      fresh ? pick(isRare(sp) ? 'species.rare' : 'species.new', { name: sp.name }) : undefined,
      '🌸',
      { kind: 'species', species: sp.id, fact: sp.fact, rare: isRare(sp) },
    );
    if (!isNew && fresh && d === today.value && !(await getLocal(`bloom:${d}`, false))) {
      await setLocal(`bloom:${d}`, true);
      moments.push({
        text: pick('species.bloom', { name: sp.name }),
        emoji: '🌸',
        kind: 'bloom',
        species: sp.id,
        rare: isRare(sp),
      });
    } else if (isNew && d === today.value) await setLocal(`bloom:${d}`, true);
  }
  const priorSurprises = new Set(
    known.filter((a) => a.kind === 'surprise' && a.key.startsWith('meal_')).map((a) => a.key.slice(5)),
  );
  const surpriseHistory = all
    .filter((l) => !l.deleted_at || priorSurprises.has(l.id))
    .map((l) => (priorSurprises.has(l.id) ? { ...l, deleted_at: null } : l));
  for (const l of surpriseLogs(surpriseHistory, priorSurprises)) {
    make(
      'surprise',
      `meal_${l.id}`,
      null,
      l.created_at,
      recent.some((r) => r.id === l.id) ? pick('surprise', { total: xp }) : undefined,
    );
  }
  for (const l of recent) {
    if (
      isComeback(l, live) &&
      !live.some((r) => r.id !== l.id && r.day === l.day && isOccasion(r) && r.created_at < l.created_at) &&
      !(await getLocal(`comeback:${l.day}`, false))
    ) {
      await setLocal(`comeback:${l.day}`, true);
      moments.push({ text: pick('comeback'), emoji: '👋', kind: 'comeback' });
    }
  }
  const holiday = calendarKey(today.value);
  if (holiday)
    make(
      'surprise',
      holiday,
      null,
      Date.now(),
      !ids.has(`surprise:${holiday}:life`) ? pick('surprise', { total: xp }) : undefined,
      '🌸',
    );
  await writeRows(earned.map((row) => ({ table: 'achievements', row })));
}
