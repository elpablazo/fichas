// Export the meals eaten (dishes and portions, not exchange units) for a date range, to send to the nutritionist.
import { Copy, Download, Share2 } from 'lucide-preact';
import { useEffect, useState } from 'preact/hooks';
import { addDays } from '../../shared/domain/day';
import { exportMeals, type MealsExport } from '../../shared/domain/export-meals';
import { fill } from '../../shared/domain/format';
import { Sheet } from '../components/Sheet';
import { exportCopy } from '../copy/more';
import { db } from '../db/dexie';
import { plans, settings, today } from '../state/signals';
import { closeSheet, showToast } from '../state/ui';

const PRESETS = [
  { days: 7, label: exportCopy.last7 },
  { days: 15, label: exportCopy.last15 },
  { days: 30, label: exportCopy.last30 },
];

export default function ExportMeals() {
  const [from, setFrom] = useState(addDays(today.value, -6));
  const [to, setTo] = useState(today.value);
  const [out, setOut] = useState<MealsExport | null>(null);
  const valid = from <= to;

  useEffect(() => {
    if (!valid) {
      setOut(null);
      return;
    }
    let live = true;
    void db.logs
      .where('day')
      .between(from, to, true, true)
      .toArray()
      .then((logs) => {
        if (live)
          setOut(
            exportMeals({
              logs,
              plans: plans.value,
              from,
              to,
              tz: settings.value.tz,
              dayStartHour: settings.value.day_start_hour,
            }),
          );
      });
    return () => {
      live = false;
    };
  }, [from, to, valid]);

  const ready = valid && out !== null && out.meals > 0;
  const fileName = fill(exportCopy.fileName, { from, to });

  const save = () => {
    if (!out) return;
    const url = URL.createObjectURL(new Blob([out.text], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };
  const share = async () => {
    if (!out) return;
    try {
      if (navigator.share) await navigator.share({ title: exportCopy.title, text: out.text });
      else save();
    } catch {
      // Cancelled share sheets are not errors.
    }
  };
  const copy = async () => {
    if (!out) return;
    try {
      await navigator.clipboard.writeText(out.text);
      showToast(exportCopy.copied);
    } catch {
      save();
    }
  };

  return (
    <Sheet
      label={exportCopy.title}
      onClose={closeSheet}
      header={<h2 class="title">{exportCopy.title}</h2>}
      footer={
        <button
          type="button"
          class="btn btn-primary w-full"
          data-testid="export-share"
          disabled={!ready}
          onClick={() => void share()}
        >
          <Share2 size={18} aria-hidden="true" />
          {exportCopy.share}
        </button>
      }
    >
      <div class="mb-3 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.days}
            type="button"
            class="chip"
            aria-pressed={to === today.value && from === addDays(today.value, 1 - p.days)}
            onClick={() => {
              setTo(today.value);
              setFrom(addDays(today.value, 1 - p.days));
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div class="mb-4 grid grid-cols-2 gap-3">
        <label class="block">
          <span class="kicker mb-1 block px-1">{exportCopy.from}</span>
          <input
            type="date"
            class="field w-full"
            data-testid="export-from"
            max={to}
            value={from}
            onChange={(e) => e.currentTarget.value && setFrom(e.currentTarget.value)}
          />
        </label>
        <label class="block">
          <span class="kicker mb-1 block px-1">{exportCopy.to}</span>
          <input
            type="date"
            class="field w-full"
            data-testid="export-to"
            min={from}
            max={today.value}
            value={to}
            onChange={(e) => e.currentTarget.value && setTo(e.currentTarget.value)}
          />
        </label>
      </div>

      <p class="caption mb-2 px-1" data-testid="export-summary">
        {!out || out.meals === 0
          ? exportCopy.empty
          : out.meals === 1 && out.days === 1
            ? exportCopy.summaryOne
            : fill(exportCopy.summary, { meals: out.meals, days: out.days })}
      </p>
      {ready && out && (
        <>
          <pre class="well max-h-[38dvh] overflow-auto whitespace-pre-wrap p-3 text-[14px] leading-snug">
            {out.text}
          </pre>
          <div class="mt-3 flex gap-2">
            <button type="button" class="btn btn-neutral btn-sm flex-1" onClick={() => void copy()}>
              <Copy size={17} aria-hidden="true" />
              {exportCopy.copy}
            </button>
            <button type="button" class="btn btn-neutral btn-sm flex-1" onClick={save}>
              <Download size={17} aria-hidden="true" />
              {exportCopy.save}
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}
