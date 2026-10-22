import { KeyRound } from 'lucide-preact';
import { useState } from 'preact/hooks';
import { MiniPlant } from '../components/LazyPlant';
import { buttons, labels, lines, pools, titles } from '../copy/es-MX';
import { paired, resetCursor, syncNow } from '../db/sync';
import { navigate } from '../state/ui';

function deviceLabel(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Android';
  if (/Mac/.test(ua)) return 'Mac';
  return 'Web';
}

export default function Pair() {
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: Event) => {
    e.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/auth/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Fichas': '1' },
        credentials: 'same-origin',
        body: JSON.stringify({ code, label: deviceLabel() }),
      });
      if (res.status === 204) {
        await resetCursor();
        paired.value = 'yes';
        navigate('/', true);
        await syncNow();
        return;
      }
      setErr(res.status === 429 ? lines.pairLimited : lines.pairWrong);
    } catch {
      setErr(pools['error.generic'][0]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main
      class="mx-auto flex min-h-dvh max-w-[420px] flex-col justify-center px-6"
      style="padding-top: var(--safe-top); padding-bottom: var(--safe-bottom)"
    >
      <div class="mb-4 flex items-end gap-1" aria-hidden="true">
        <MiniPlant stage="bloom" species="dalia" size={70} />
        <MiniPlant stage="bloom" species="girasol" size={56} />
        <MiniPlant stage="bud" species="cosmos" size={46} />
      </div>
      <h1 class="text-[40px] font-extrabold leading-[44px] tracking-tight">{titles.pair}</h1>
      <p class="muted mt-2">{lines.pairHelp}</p>
      <form class="mt-6 grid gap-3" onSubmit={submit}>
        <label class="kicker px-1" for="code">
          {labels.yourKey}
        </label>
        <div class="field-wrap">
          <input
            id="code"
            class="field"
            type="text"
            autoCapitalize="none"
            autoComplete="off"
            autoCorrect="off"
            spellcheck={false}
            enterKeyHint="go"
            value={code}
            onInput={(e) => setCode((e.currentTarget as HTMLInputElement).value)}
          />
          <span class="field-actions text-ink-3" aria-hidden="true">
            <span class="icon-btn">
              <KeyRound size={18} />
            </span>
          </span>
        </div>
        <button type="submit" class="btn btn-primary" disabled={busy || !code.trim()}>
          {buttons.enter}
        </button>
        {err && (
          <p class="secondary font-semibold" role="alert">
            {err}
          </p>
        )}
      </form>
    </main>
  );
}
