// "Para tu nutri": a link to a read-only journal of what was eaten and when (no fichas), for a date range.
// Links can be copied again from this device and revoked from any. The plain-text list stays as a fallback.
import { ChevronDown, Copy, Download, ExternalLink, Link2, Share2, Trash2 } from 'lucide-preact';
import { useEffect, useState } from 'preact/hooks';
import { addDays } from '../../shared/domain/day';
import { exportMeals, type MealsExport } from '../../shared/domain/export-meals';
import { fill, shortDate } from '../../shared/domain/format';
import { Sheet } from '../components/Sheet';
import { exportCopy } from '../copy/more';
import { db, getLocal, setLocal } from '../db/dexie';
import { api } from '../db/sync';
import { plans, settings, today } from '../state/signals';
import { closeSheet, showToast } from '../state/ui';

const PRESETS = [
  { days: 7, label: exportCopy.last7 },
  { days: 15, label: exportCopy.last15 },
  { days: 30, label: exportCopy.last30 },
];

interface Share {
  id: string;
  from: string;
  to: string;
  created_at: number;
  expires_at: number;
  views: number;
}

const shortDay = (ms: number) => shortDate(new Date(ms).toISOString().slice(0, 10));
const rangeText = (s: { from: string; to: string }) =>
  s.from === s.to ? shortDate(s.from) : `${shortDate(s.from)} – ${shortDate(s.to)}`;

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function ExportMeals() {
  const [from, setFrom] = useState(addDays(today.value, -6));
  const [to, setTo] = useState(today.value);
  const [out, setOut] = useState<MealsExport | null>(null);
  const [asText, setAsText] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [links, setLinks] = useState<Share[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [fresh, setFresh] = useState<string | null>(null);
  const valid = from <= to;

  const refresh = async () => {
    try {
      const r = await api('/api/shares');
      if (!r.ok) return;
      const list = ((await r.json()) as { shares: Share[] }).shares;
      setLinks(list);
      const known = await Promise.all(list.map(async (s) => [s.id, await getLocal(`share:${s.id}`, '')] as const));
      setUrls(Object.fromEntries(known.filter(([, u]) => u)));
    } catch {
      // Offline: the list simply isn't shown.
    }
  };
  useEffect(() => void refresh(), []);

  useEffect(() => {
    if (!valid || !asText) return;
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
  }, [from, to, valid, asText]);

  const create = async () => {
    if (busy || !valid) return;
    setError(null);
    if (!navigator.onLine) return setError(exportCopy.offline);
    setBusy(true);
    try {
      const r = await api('/api/shares', { method: 'POST', body: JSON.stringify({ from, to }) });
      if (!r.ok) throw new Error(String(r.status));
      const s = (await r.json()) as Share & { token: string };
      const url = `${location.origin}/n/${s.token}`;
      await setLocal(`share:${s.id}`, url);
      setUrls((u) => ({ ...u, [s.id]: url }));
      setLinks((l) => [s, ...l]);
      setFresh(s.id);
      if (await copyText(url)) showToast(exportCopy.linkReady);
    } catch {
      setError(exportCopy.failed);
    } finally {
      setBusy(false);
    }
  };
  const revoke = async (s: Share) => {
    try {
      const r = await api(`/api/shares/${s.id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error(String(r.status));
      setLinks((l) => l.filter((x) => x.id !== s.id));
      showToast(exportCopy.revoked);
    } catch {
      showToast(exportCopy.failed);
    }
  };
  const share = async (url: string) => {
    try {
      if (navigator.share) await navigator.share({ title: exportCopy.shareTitle, url });
      else if (await copyText(url)) showToast(exportCopy.copied);
    } catch {
      // A cancelled share sheet is not an error.
    }
  };
  const saveText = () => {
    if (!out) return;
    const url = URL.createObjectURL(new Blob([out.text], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = fill(exportCopy.fileName, { from, to });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  return (
    <Sheet label={exportCopy.nutriTitle} onClose={closeSheet} header={<h2 class="title">{exportCopy.nutriTitle}</h2>}>
      <p class="secondary muted mb-3 px-1">{exportCopy.linkIntro}</p>
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
      <button
        type="button"
        class="btn btn-primary w-full"
        data-testid="share-create"
        disabled={busy || !valid}
        onClick={() => void create()}
      >
        <Link2 size={19} aria-hidden="true" />
        {busy ? exportCopy.creating : exportCopy.create}
      </button>
      {error && (
        <p class="secondary mt-2 px-1 font-semibold" role="status">
          {error}
        </p>
      )}

      {links.length > 0 && (
        <>
          <h3 class="kicker mt-5 mb-2 px-1">{exportCopy.active}</h3>
          <ul class="grid gap-2.5" data-testid="share-list">
            {links.map((s) => {
              const url = urls[s.id];
              return (
                <li key={s.id} class={`logged ${fresh === s.id ? 'anim-rise' : ''}`} data-testid="share-row">
                  <div class="flex items-start gap-3">
                    <span class="row-icon">
                      <Link2 size={18} aria-hidden="true" />
                    </span>
                    <span class="min-w-0 flex-1">
                      <span class="block font-bold">{rangeText(s)}</span>
                      <span class="caption block">
                        {fill(exportCopy.expires, { date: shortDay(s.expires_at) })} ·{' '}
                        {s.views === 0
                          ? exportCopy.viewsNone
                          : s.views === 1
                            ? exportCopy.viewsOne
                            : fill(exportCopy.views, { n: s.views })}
                      </span>
                    </span>
                    <button
                      type="button"
                      class="icon-btn ghost -mr-1 text-ink-2"
                      aria-label={`${exportCopy.revoke}: ${rangeText(s)}`}
                      onClick={() => void revoke(s)}
                    >
                      <Trash2 size={18} aria-hidden="true" />
                    </button>
                  </div>
                  {url && (
                    <div class="mt-3 mb-1.5 flex gap-2">
                      <button
                        type="button"
                        class="btn btn-neutral btn-sm flex-1"
                        onClick={() => void copyText(url).then((ok) => ok && showToast(exportCopy.copied))}
                      >
                        <Copy size={16} aria-hidden="true" />
                        {exportCopy.copyLink}
                      </button>
                      <button type="button" class="btn btn-tonal btn-sm flex-1" onClick={() => void share(url)}>
                        <Share2 size={16} aria-hidden="true" />
                        {exportCopy.shareLink}
                      </button>
                      <a
                        class="btn btn-neutral btn-sm"
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={exportCopy.openLink}
                      >
                        <ExternalLink size={16} aria-hidden="true" />
                      </a>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      <button
        type="button"
        class="press mt-5 flex min-h-11 w-full items-center justify-between rounded-2xl px-1 font-bold text-ink-2"
        aria-expanded={asText}
        data-testid="export-text-toggle"
        onClick={() => setAsText(!asText)}
      >
        {exportCopy.asText}
        <ChevronDown size={18} class={`transition-transform ${asText ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {asText && (
        <div class="anim-rise">
          <p class="caption mb-2 px-1" data-testid="export-summary">
            {!out || out.meals === 0
              ? exportCopy.empty
              : out.meals === 1 && out.days === 1
                ? exportCopy.summaryOne
                : fill(exportCopy.summary, { meals: out.meals, days: out.days })}
          </p>
          {out && out.meals > 0 && (
            <>
              <pre class="well max-h-[38dvh] overflow-auto whitespace-pre-wrap p-3 text-[14px] leading-snug">
                {out.text}
              </pre>
              <div class="mt-3 flex gap-2">
                <button
                  type="button"
                  class="btn btn-neutral btn-sm flex-1"
                  data-testid="export-copy"
                  onClick={() => void copyText(out.text).then((ok) => (ok ? showToast(exportCopy.copied) : saveText()))}
                >
                  <Copy size={17} aria-hidden="true" />
                  {exportCopy.copy}
                </button>
                <button type="button" class="btn btn-neutral btn-sm flex-1" onClick={saveText}>
                  <Download size={17} aria-hidden="true" />
                  {exportCopy.save}
                </button>
                <button
                  type="button"
                  class="btn btn-neutral btn-sm flex-1"
                  data-testid="export-share"
                  onClick={() =>
                    void (navigator.share
                      ? navigator.share({ title: exportCopy.title, text: out.text }).catch(() => {})
                      : saveText())
                  }
                >
                  <Share2 size={17} aria-hidden="true" />
                  {exportCopy.share}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}
