import {
  BookOpen,
  ChevronRight,
  FileText,
  Minus,
  Plus,
  Settings as SettingsIcon,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-preact';
import { useMemo, useState } from 'preact/hooks';
import { eatingSummary } from '../../shared/domain/eating';
import { fill, shortDate } from '../../shared/domain/format';
import { seasonReport } from '../../shared/domain/story';
import { analyzeWeight, trendAt } from '../../shared/domain/weight';
import { DayRings } from '../components/DayRings';
import { ScreenHeader, SectionTitle, Segmented } from '../components/ui';
import { weekStart } from '../components/WeekStrip';
import { type Range, WeightChart } from '../components/WeightChart';
import { buttons, titles } from '../copy/es-MX';
import { eatingCopy, storyCopy, weightCopy } from '../copy/more';
import { gardenLogs } from '../game';
import { achievements, activePlan, planForDay, plans, settings, today, weighins } from '../state/signals';
import { navigate, openSheet } from '../state/ui';

const kg1 = (n: number) => n.toFixed(1);
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(1)}`;

/** This week as rings: how much of each day's plan was covered. Opens "Tu alimentación". */
function EatingCard() {
  const day = today.value;
  const from = weekStart(day);
  const s = useMemo(
    () =>
      eatingSummary({
        from,
        to: day,
        today: day,
        logs: gardenLogs.value,
        planOf: (d) => planForDay(plans.value, d)?.data ?? null,
        tz: settings.value.tz,
        dayStartHour: settings.value.day_start_hour,
      }),
    [from, day, gardenLogs.value, plans.value, settings.value.tz, settings.value.day_start_hour],
  );
  const line =
    s.full > 0
      ? `${s.full} ${s.full === 1 ? eatingCopy.fullOne : eatingCopy.full} ${eatingCopy.thisWeek}`
      : eatingCopy.fullNone;
  return (
    <button
      type="button"
      class="card press mb-4 block w-full p-4 text-left"
      data-testid="eating-card"
      aria-label={`${eatingCopy.title}. ${line}`}
      onClick={() => openSheet({ kind: 'eating' })}
    >
      <span class="flex items-center justify-between gap-3">
        <span class="kicker">{eatingCopy.title}</span>
        <ChevronRight size={20} class="text-ink-3" aria-hidden="true" />
      </span>
      <span class="headline mt-0.5 block">{line}</span>
      <span class="mt-3 block">
        <DayRings days={s.days} today={day} size={36} />
      </span>
    </button>
  );
}

export default function Progress() {
  const [range, setRange] = useState<Range>('m3');
  const [all, setAll] = useState(false);
  const p = activePlan.value;
  const day = today.value;
  const rows = weighins.value.filter((w) => !w.deleted_at && w.day <= day);
  const a = useMemo(() => analyzeWeight(rows), [weighins.value, day]);
  const logs = gardenLogs.value;
  const report = useMemo(
    () => (p ? seasonReport(p, logs, weighins.value, achievements.value, day) : null),
    [p, logs, weighins.value, achievements.value, day],
  );
  const counted = report?.slots.reduce((s, x) => s + x.counted, 0) ?? 0;
  const on = report?.slots.reduce((s, x) => s + x.on, 0) ?? 0;
  const since = p?.starts_on ? trendAt(a.trend, p.starts_on) : null;
  const sinceDelta =
    since !== null && a.current !== null && a.points[0] && a.points[0].day <= (p?.starts_on ?? '')
      ? a.current - since
      : null;
  const left = Math.max(1, 4 - a.samples);
  const signalText =
    a.signal === 'none'
      ? weightCopy.none
      : a.signal === 'few'
        ? a.samples > 0 && a.samples < 4
          ? fill(weightCopy.fewLeft, { n: left })
          : weightCopy.few
        : a.signal === 'losing'
          ? fill(weightCopy.losing, { rate: kg1(Math.abs(a.rate ?? 0)) })
          : a.signal === 'gaining'
            ? fill(weightCopy.gaining, { rate: kg1(Math.abs(a.rate ?? 0)) })
            : a.signal === 'steady'
              ? weightCopy.steady
              : weightCopy.unclear;
  const SignalIcon =
    a.signal === 'losing'
      ? TrendingDown
      : a.signal === 'gaining'
        ? TrendingUp
        : a.signal === 'steady'
          ? Minus
          : Sparkles;
  const history = [...rows].sort((x, y) => y.day.localeCompare(x.day) || y.created_at - x.created_at);
  return (
    <main class="app-main anim-fade">
      <ScreenHeader
        title={titles.progress}
        right={
          <button
            type="button"
            class="icon-btn mt-1"
            aria-label={titles.settings}
            onClick={() => navigate('/progreso/ajustes')}
          >
            <SettingsIcon size={20} aria-hidden="true" />
          </button>
        }
      />

      {p && <EatingCard />}

      <section class="card mb-4 p-4" data-testid="weight-section">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="kicker">{a.current !== null ? weightCopy.trend : weightCopy.title}</p>
            {a.current !== null ? (
              <p class="mt-0.5 flex items-baseline gap-1.5">
                <span class="text-[46px] font-extrabold leading-[50px] tracking-tight">{kg1(a.current)}</span>
                <span class="headline text-ink-2">{storyCopy.kg}</span>
              </p>
            ) : (
              <p class="secondary muted mt-1 max-w-[24ch]">{weightCopy.none}</p>
            )}
            {a.latest && (
              <p class="caption num">
                {fill(weightCopy.last, { kg: kg1(a.latest.kg), date: shortDate(a.latest.day) })}
              </p>
            )}
          </div>
          <button
            type="button"
            class="btn btn-primary btn-sm min-h-11 shrink-0 gap-1.5 px-3.5"
            data-testid="weight-open"
            onClick={() => openSheet({ kind: 'weighin' })}
          >
            <Plus size={18} strokeWidth={2.6} aria-hidden="true" />
            {weightCopy.add}
          </button>
        </div>
        {a.points.length > 1 && (
          <>
            <div class="mt-4 mb-2">
              <Segmented
                label={weightCopy.title}
                value={range}
                onChange={setRange}
                options={[
                  { value: 'm1', label: weightCopy.ranges.m1 },
                  { value: 'm3', label: weightCopy.ranges.m3 },
                  { value: 'all', label: weightCopy.ranges.all },
                ]}
              />
            </div>
            <WeightChart a={a} range={range} />
          </>
        )}
      </section>

      <section class="card mb-4 p-4" data-testid="plan-signal">
        <h2 class="headline mb-2">{weightCopy.works}</h2>
        <div class="flex items-start gap-3">
          <span class="row-icon mt-0.5">
            <SignalIcon size={19} aria-hidden="true" />
          </span>
          <div class="min-w-0 flex-1">
            <p class="font-semibold">{signalText}</p>
            {a.fast && <p class="secondary muted mt-0.5">{weightCopy.fast}</p>}
            {a.signal === 'gaining' && <p class="secondary muted mt-0.5">{weightCopy.talk}</p>}
          </div>
        </div>
        {a.rate !== null && (
          <div class="mt-3 grid grid-cols-2 gap-2">
            <div class="well px-3 py-2.5">
              <p class="caption font-semibold">{weightCopy.rate}</p>
              <p class="num title">{signed(a.rate)}</p>
              <p class="caption">{weightCopy.perWeek}</p>
            </div>
            <div class="well px-3 py-2.5">
              <p class="caption font-semibold">{weightCopy.projected}</p>
              <p class="num title">~{kg1(a.projection.at(-1)?.kg ?? a.current ?? 0)}</p>
              <p class="caption">{weightCopy.inFour}</p>
            </div>
          </div>
        )}
        {sinceDelta !== null && Math.abs(sinceDelta) >= 0.05 && (
          <p class="secondary mt-3 font-semibold">{fill(weightCopy.since, { delta: signed(sinceDelta) })}</p>
        )}
        <p class="caption mt-2">{weightCopy.noise}</p>
        {report && (
          <div class="mt-3 grid grid-cols-3 gap-2 border-line border-t pt-3 text-center">
            <div>
              <p class="num title">{report.fullDays}</p>
              <p class="caption leading-4">{weightCopy.daysTwo}</p>
            </div>
            <div>
              <p class="num title">{report.meals}</p>
              <p class="caption leading-4">{weightCopy.meals}</p>
            </div>
            <div>
              <p class="num title">{counted ? `${Math.round((on / counted) * 100)}%` : '—'}</p>
              <p class="caption leading-4">{weightCopy.onPlan}</p>
            </div>
          </div>
        )}
      </section>

      {p && (
        <section class="card mb-4 grid grid-cols-2 gap-2 p-2">
          <button
            type="button"
            class="btn btn-neutral min-h-14"
            onClick={() => p && openSheet({ kind: 'season-recap', id: p.id, mode: 'recap' })}
          >
            <Sparkles size={18} aria-hidden="true" />
            {buttons.recap}
          </button>
          <button
            type="button"
            class="btn btn-neutral min-h-14"
            data-testid="nutri-export"
            onClick={() => openSheet({ kind: 'export-meals' })}
          >
            <FileText size={18} aria-hidden="true" />
            {storyCopy.report}
          </button>
        </section>
      )}

      {history.length > 0 && (
        <>
          <SectionTitle>{weightCopy.history}</SectionTitle>
          <section class="card mb-4 divide overflow-hidden" data-testid="weight-history">
            {(all ? history : history.slice(0, 6)).map((w) => (
              <button
                key={w.id}
                type="button"
                class="row press"
                onClick={() => openSheet({ kind: 'weighin', id: w.id })}
              >
                <span class="min-w-0 flex-1">
                  <span class="num font-bold">
                    {kg1(w.kg)} {storyCopy.kg}
                  </span>
                  <span class="caption block">
                    {shortDate(w.day)} · {w.source === 'nutritionist' ? storyCopy.nutritionist : storyCopy.home}
                  </span>
                </span>
                <ChevronRight size={18} class="text-ink-3" aria-hidden="true" />
              </button>
            ))}
            {!all && history.length > 6 && (
              <button
                type="button"
                class="row press justify-center font-bold text-accent-ink"
                onClick={() => setAll(true)}
              >
                {buttons.seeAll}
              </button>
            )}
          </section>
        </>
      )}

      <section class="card mb-4 divide overflow-hidden">
        <button type="button" class="row press" onClick={() => navigate('/progreso/plan')}>
          <span class="row-icon">
            <BookOpen size={19} aria-hidden="true" />
          </span>
          <span class="flex-1 font-semibold">{titles.myPlan}</span>
          <ChevronRight size={20} class="text-ink-3" aria-hidden="true" />
        </button>
        <button type="button" class="row press" onClick={() => navigate('/progreso/ajustes')}>
          <span class="row-icon">
            <SettingsIcon size={19} aria-hidden="true" />
          </span>
          <span class="flex-1 font-semibold">{titles.settings}</span>
          <ChevronRight size={20} class="text-ink-3" aria-hidden="true" />
        </button>
      </section>
    </main>
  );
}
