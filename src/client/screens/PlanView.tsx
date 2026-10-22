import { ChevronDown, ChevronRight, Droplets, FileText, Footprints, NotebookPen, Search, Upload } from 'lucide-preact';
import { useState } from 'preact/hooks';
import { hhmmToAppMinutes } from '../../shared/domain/day';
import { fill, itemLabel, shortDate, timeLabel } from '../../shared/domain/format';
import { norm } from '../../shared/domain/text';
import { tokensFor } from '../../shared/domain/tokens';
import type { TypeKey, Units } from '../../shared/domain/types';
import { TYPE_KEYS } from '../../shared/domain/types';
import { Txt, TypeIcon } from '../components/Sprite';
import { TokenRow, tokensA11y } from '../components/Token';
import { ScreenHeader } from '../components/ui';
import { buttons, labels, lines, titles, typeLabels } from '../copy/es-MX';
import { swapLabels } from '../copy/more';
import { downloadPlanFile } from '../plans';
import { visibleNote } from '../sheets/TokenInfo';
import { balanceOn } from '../state/selectors';
import { activePlan, livePlans, planReadingEnabled } from '../state/signals';
import { navigate, showToast } from '../state/ui';

function unitsText(u: Units): string {
  return (Object.entries(u) as [TypeKey, number][])
    .map(([t, n]) => `${n === 1 ? '' : n}${typeLabels[t].emoji}`)
    .join(' + ');
}

export default function PlanView({ planId }: { planId?: string }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<TypeKey | null>(null);
  const plan = planId ? livePlans.value.find((p) => p.id === planId) : activePlan.value;
  if (!plan) return null;
  const d = plan.data;
  const query = norm(q);
  const others = livePlans.value.filter((p) => p.id !== plan.id).sort((a, b) => (b.season ?? 0) - (a.season ?? 0));
  return (
    <main class="app-main anim-fade">
      <ScreenHeader
        title={titles.myPlan}
        back={planId ? '/progreso/plan' : '/progreso'}
        subtitle={
          plan.season && plan.starts_on
            ? fill(lines.seasonSince, { n: plan.season, date: shortDate(plan.starts_on) })
            : undefined
        }
      />
      <div class="mb-4 grid gap-2">
        {planReadingEnabled.value && !planId && (
          <button
            type="button"
            class="btn btn-primary w-full"
            data-testid="new-plan"
            onClick={() => navigate('/progreso/plan/nuevo')}
          >
            <Upload size={19} aria-hidden="true" />
            {buttons.uploadPlan}
          </button>
        )}
        {plan.source_keys.map((key, n) => (
          <button
            key={key}
            type="button"
            class="btn btn-neutral w-full"
            onClick={() => {
              void downloadPlanFile(plan.id, n).catch(() => showToast(lines.planOffline));
            }}
          >
            <FileText size={18} aria-hidden="true" />
            {buttons.original}
            {plan.source_keys.length > 1 ? ` ${n + 1}` : ''}
          </button>
        ))}
      </div>

      <h2 class="kicker mb-2 px-1">{titles.slots}</h2>
      <section class="card mb-5 divide px-4" aria-label={titles.slots}>
        {d.slots.map((s) => (
          <div key={s.key} class="py-3">
            <div class="flex items-baseline justify-between">
              <span class="font-bold">{s.label}</span>
              {s.time && <span class="caption num">{timeLabel(hhmmToAppMinutes(s.time))}</span>}
            </div>
            <TokenRow class="mt-2" tokens={tokensFor(s.target, {})} size={20} label={tokensA11y(s.target, {})} />
            {s.example && (
              <p class="secondary muted mt-2">
                <span class="caption font-bold">{labels.examples}: </span>
                {s.example.items.map((i) => i.text).join(' · ')}
              </p>
            )}
          </div>
        ))}
      </section>

      <h2 class="kicker mb-2 px-1">{titles.equivalents}</h2>
      <section class="card mb-5 px-4 pt-3 pb-1">
        <div class="field-wrap mb-2">
          <input
            class="field"
            type="search"
            placeholder={lines.searchFoods}
            aria-label={lines.searchFoods}
            value={q}
            onInput={(e) => setQ((e.currentTarget as HTMLInputElement).value)}
          />
          <span class="field-actions" aria-hidden="true">
            <span class="icon-btn">
              <Search size={18} />
            </span>
          </span>
        </div>
        <div class="divide">
          {TYPE_KEYS.map((t) => {
            const list = d.equivalents.filter(
              (e) => e.type === t && (!query || norm(`${e.food} ${e.aliases.join(' ')}`).includes(query)),
            );
            if (!list.length) return null;
            const expanded = open === t || query.length > 0;
            return (
              <div key={t}>
                <button
                  type="button"
                  class="press flex min-h-12 w-full items-center gap-3 text-left"
                  aria-expanded={expanded}
                  onClick={() => setOpen(open === t ? null : t)}
                >
                  <span class={`tok tok-1 t-${t}`} style="--s:28px" aria-hidden="true">
                    <TypeIcon type={t} class="e" />
                  </span>
                  <span class="flex-1 font-semibold">{typeLabels[t].group}</span>
                  <span class="caption num">{list.length}</span>
                  <ChevronDown
                    size={18}
                    class={`text-ink-3 transition-transform ${expanded ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                  />
                </button>
                {expanded && (
                  <ul class="pb-2 pl-10">
                    {list.map((e) => (
                      <li key={e.id} class="secondary py-1">
                        {itemLabel(e.food, e.qty, e.unit, false)}
                        {visibleNote(e) && <span class="caption"> · {visibleNote(e)}</span>}
                        {e.flag === 'check_portion' && <span class="caption block">{lines.checkPortion}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <h2 class="kicker mb-2 px-1">{titles.freeFoods}</h2>
      <section class="card mb-5 p-4">
        <div class="flex flex-wrap gap-1.5">
          {d.free_foods.map((f) => (
            <span key={f} class="badge">
              {f}
            </span>
          ))}
        </div>
      </section>

      <h2 class="kicker mb-2 px-1">{titles.notes}</h2>
      <section class="card mb-5 divide px-4">
        {d.issued_on && (
          <p class="secondary py-3">
            {labels.planFields.issued_on}: <b>{shortDate(d.issued_on)}</b>
          </p>
        )}
        {d.next_appointment && (
          <p class="secondary py-3">
            {labels.planFields.next_appointment}: <b>{shortDate(d.next_appointment)}</b>
          </p>
        )}
        {d.fluids_ml && (
          <p class="secondary flex items-center gap-2 py-3">
            <Droplets size={17} class="text-accent-ink" aria-hidden="true" />
            {fill(lines.fluids, { n: d.fluids_ml / 1000 })}
          </p>
        )}
        {d.exercise && (
          <p class="secondary flex items-center gap-2 py-3">
            <Footprints size={17} class="text-accent-ink" aria-hidden="true" />
            {fill(lines.exercise, { text: d.exercise })}
          </p>
        )}
        {d.notes.map((n) => (
          <p key={n} class="secondary flex items-center gap-2 py-3">
            <NotebookPen size={17} class="text-accent-ink" aria-hidden="true" />
            {n}
          </p>
        ))}
      </section>

      <h2 class="kicker mb-2 px-1">{titles.rules}</h2>
      <section class="card mb-5 divide px-4">
        {d.swaps.map((r, i) => (
          <div key={i} class="flex items-baseline justify-between gap-2 py-3">
            <span class="secondary">
              <Txt>{fill(swapLabels[r.kind], { from: unitsText({ [r.from]: 1 }), to: unitsText(r.to) })}</Txt>
            </span>
            <span class={`badge shrink-0 ${r.confirmed ? 'leaf' : ''}`}>
              {r.confirmed ? lines.swapConfirmed : lines.swapPending}
            </span>
          </div>
        ))}
        <p class="secondary py-3">
          {(planId ? d.rules.rebalance_within_day === 'allowed' : balanceOn.value)
            ? lines.rebalanceAllowed
            : lines.rebalanceUnknown}
        </p>
      </section>

      {others.length > 0 && (
        <>
          <h2 class="kicker mb-2 px-1">{titles.previousPlans}</h2>
          <section class="card mb-5 divide overflow-hidden">
            {others.map((p) => (
              <button key={p.id} type="button" class="row press" onClick={() => navigate(`/progreso/plan/${p.id}`)}>
                <span class="flex-1 font-semibold">
                  {fill(lines.seasonSince, { n: p.season ?? 0, date: shortDate(p.starts_on ?? '') })}
                </span>
                <ChevronRight size={20} class="text-ink-3" aria-hidden="true" />
              </button>
            ))}
          </section>
        </>
      )}
    </main>
  );
}
