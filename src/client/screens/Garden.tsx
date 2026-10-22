import { Award, Bird, ChevronRight, Palette, Sparkles, Sprout, TreeDeciduous, Waves } from 'lucide-preact';
import { useEffect } from 'preact/hooks';
import { daysBetween } from '../../shared/domain/day';
import { fill } from '../../shared/domain/format';
import { type EcoKey, ecosystem } from '../../shared/game/ecosystem';
import { bloomed } from '../../shared/game/garden';
import { nextUnlock } from '../../shared/game/levels';
import { SPECIES } from '../../shared/game/species';
import { speciesText } from '../../shared/game/species-text';
import { STAMPS } from '../../shared/game/stamps';
import { GardenScene } from '../components/GardenScene';
import { Bee, Butterfly, Plant } from '../components/Plant';
import { ProgressBar, ScreenHeader, SectionTitle } from '../components/ui';
import { gameCopy } from '../copy/es-MX';
import { gardenCopy, unlockFallback, unlockNames } from '../copy/more';
import { getLocal, setLocal } from '../db/dexie';
import { progress } from '../game';
import { discovered, gardenDays } from '../garden-state';
import { achievements, activePlan, livePlans, today } from '../state/signals';
import { openSheet } from '../state/ui';

/** The next visitor's icon, drawn like the scene. */
function EcoIcon({ k }: { k: EcoKey }) {
  if (k === 'butterflies' || k === 'bees')
    return (
      <svg width="22" height="22" viewBox="-11 -11 22 22" aria-hidden="true">
        {k === 'bees' ? <Bee x={0} y={1} size={13} /> : <Butterfly x={0} y={0} size={17} />}
      </svg>
    );
  const Icon = k === 'tree' ? TreeDeciduous : k === 'birds' ? Bird : k === 'pond' ? Waves : Sparkles;
  return <Icon size={20} aria-hidden="true" />;
}

export default function Garden() {
  const p = activePlan.value;
  const level = progress.value;
  // This season's plants (days with a meal), like the season's stamps.
  const flowers = [...gardenDays.value.values()].filter(
    (f) => f.n > 0 && (!p?.starts_on || f.day >= p.starts_on) && (!p?.ends_on || f.day <= p.ends_on),
  ).length;
  const eco = ecosystem(flowers);
  const found = discovered.value;
  const stamps = achievements.value.filter((a) => a.kind === 'stamp' && a.season === p?.season).length;
  const next = nextUnlock(level.level);
  const past = livePlans.value
    .filter((x) => x.ends_on && x.ends_on < today.value)
    .sort((a, b) => (b.season ?? 0) - (a.season ?? 0));
  const lastSeason = past[0]?.id;
  useEffect(() => {
    let disposed = false;
    if (lastSeason && p?.id)
      void getLocal(`recap:season:${lastSeason}`, false).then((seen) => {
        if (!seen && !disposed) {
          openSheet({ kind: 'season-recap', id: lastSeason });
          void setLocal(`recap:season:${lastSeason}`, true);
        }
      });
    return () => {
      disposed = true;
    };
  }, [lastSeason, p?.id]);
  const stats = [
    { icon: <Sprout size={18} aria-hidden="true" />, n: flowers, label: gardenCopy.flowers },
    { icon: <span aria-hidden="true">🌸</span>, n: `${found.size}/${SPECIES.length}`, label: gardenCopy.species },
    {
      icon: <Award size={18} aria-hidden="true" />,
      n: `${stamps}/${STAMPS.length}`,
      label: gardenCopy.stampsShort,
      open: true,
    },
  ];
  return (
    <main class="app-main anim-fade">
      <ScreenHeader
        title={gardenCopy.title}
        subtitle={
          p?.season && p.starts_on
            ? fill(gameCopy.seasonDay, { n: p.season, d: daysBetween(p.starts_on, today.value) + 1 })
            : undefined
        }
        right={
          <button
            type="button"
            class="icon-btn mt-1"
            aria-label={gameCopy.style}
            onClick={() => openSheet({ kind: 'style' })}
          >
            <Palette size={20} aria-hidden="true" />
          </button>
        }
      />

      {p && (
        <section class="card mb-4 p-2">
          <GardenScene key={p.id} plan={p} today={today.value} flowers={flowers} />
          {flowers === 0 ? (
            <p class="secondary muted px-3 pt-3 pb-1 text-center">{gardenCopy.empty}</p>
          ) : (
            <p class="secondary flex items-center gap-2.5 px-3 pt-2.5 pb-1 font-semibold" data-testid="eco-next">
              {eco.next ? (
                <>
                  <span class="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-2 text-accent-ink">
                    <EcoIcon k={eco.next.key} />
                  </span>
                  <span>
                    {fill(gardenCopy.eco[eco.next.key], { n: eco.next.at })}{' '}
                    <span class="muted">
                      {eco.next.at - flowers === 1
                        ? gardenCopy.ecoLeftOne
                        : fill(gardenCopy.ecoLeft, { n: eco.next.at - flowers })}
                    </span>
                  </span>
                </>
              ) : (
                gardenCopy.ecoDone
              )}
            </p>
          )}
        </section>
      )}

      <div class="mb-4 grid grid-cols-3 gap-2">
        {stats.map((s) => {
          const body = (
            <>
              <span class="text-accent-ink">{s.icon}</span>
              <span class="num title mt-1 leading-7">{s.n}</span>
              <span class="caption font-semibold">{s.label}</span>
            </>
          );
          return s.open ? (
            <button
              key={s.label}
              type="button"
              class="card press flex flex-col items-center px-2 py-3"
              onClick={() => openSheet({ kind: 'stamps' })}
            >
              {body}
            </button>
          ) : (
            <div key={s.label} class="card flex flex-col items-center px-2 py-3">
              {body}
            </div>
          );
        })}
      </div>

      <section class="card mb-2 p-4">
        <div class="mb-2 flex items-baseline justify-between">
          <h2 class="headline">{fill(gameCopy.level, { n: level.level })}</h2>
          <span class="caption num font-bold" data-testid="xp">
            {fill(gameCopy.xpOf, { n: level.xp, next: level.next })}
          </span>
        </div>
        <ProgressBar
          value={level.xp - level.from}
          max={level.next - level.from}
          label={fill(gameCopy.level, { n: level.level })}
        />
        <p class="caption mt-2">
          {fill(level.next - level.xp === 1 ? gameCopy.toNextOne : gameCopy.toNext, {
            n: level.next - level.xp,
            level: level.level + 1,
          })}
          {next && ` ${fill(gameCopy.next, { unlock: unlockNames[next.level] ?? unlockFallback })}`}
        </p>
      </section>

      <SectionTitle>
        {gardenCopy.herbarium}{' '}
        <span class="caption num">{fill(gardenCopy.discovered, { n: found.size, total: SPECIES.length })}</span>
      </SectionTitle>
      <div class="mb-2 grid grid-cols-3 gap-2" data-testid="herbarium">
        {SPECIES.map((sp) => {
          const got = found.has(sp.id);
          return (
            <button
              key={sp.id}
              type="button"
              disabled={!got}
              class="card press flex flex-col items-center px-1 pt-1 pb-2.5 text-center disabled:cursor-default"
              onClick={() => openSheet({ kind: 'species', id: sp.id })}
            >
              <Plant stage="bloom" species={sp.id} size={72} ground={false} class={got ? undefined : 'silhouette'} />
              <span class={`text-[13px] font-bold leading-4 ${got ? '' : 'text-ink-2'}`}>
                {got ? speciesText(sp.id).name : gardenCopy.locked}
              </span>
              {!got && (
                <span class="caption text-[11px] leading-4">
                  {sp.level === 0
                    ? gardenCopy.rare
                    : sp.level < 0
                      ? gardenCopy.seasonal
                      : fill(gardenCopy.fromLevel, { n: sp.level })}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {past.length > 0 && (
        <>
          <SectionTitle>{gardenCopy.seasons}</SectionTitle>
          <section class="card mb-4 divide overflow-hidden">
            {past.map((old) => (
              <button
                key={old.id}
                type="button"
                class="row press"
                onClick={() => openSheet({ kind: 'season-recap', id: old.id })}
              >
                <span class="row-icon">
                  <Plant stage="bloom" species={bestSpecies(old.starts_on, old.ends_on)} size={30} ground={false} />
                </span>
                <span class="flex-1 font-semibold">{fill(gameCopy.season, { n: old.season ?? 1 })}</span>
                <ChevronRight size={20} class="text-ink-3" aria-hidden="true" />
              </button>
            ))}
          </section>
        </>
      )}
    </main>
  );
}

/** The species that bloomed most in a date range (season thumbnails). */
function bestSpecies(from: string | null, to: string | null): string {
  const counts = new Map<string, number>();
  for (const f of gardenDays.value.values())
    if (bloomed(f) && (!from || f.day >= from) && (!to || f.day <= to))
      counts.set(f.species, (counts.get(f.species) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'margarita';
}
