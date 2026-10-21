import {
  BookOpen,
  ChevronRight,
  Download,
  LogOut,
  Palette,
  Salad,
  Scale,
  Smartphone,
  Vibrate,
  Volume2,
} from 'lucide-preact';
import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { SessionInfo } from '../../shared/api';
import { appDay } from '../../shared/domain/day';
import { fill, shortDate } from '../../shared/domain/format';
import { setSetting } from '../actions';
import { Diagnostics } from '../components/Diagnostics';
import { NotificationSettings } from '../components/NotificationSettings';
import { ScreenHeader, SwitchRow } from '../components/ui';
import { buttons, gameCopy, labels, lines, titles } from '../copy/es-MX';
import { exportCopy, settingsCopy } from '../copy/more';
import { api, paired } from '../db/sync';
import { balanceOn } from '../state/selectors';
import { settings } from '../state/signals';
import { navigate, openSheet } from '../state/ui';

/** Kept for older imports: a switch row. */
export function Toggle(props: { label: string; on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return <SwitchRow {...props} />;
}

function Group({ title, children }: { title: string; children: ComponentChildren }) {
  return (
    <>
      <h2 class="kicker mt-5 mb-2 px-1">{title}</h2>
      <section class="card divide overflow-hidden">{children}</section>
    </>
  );
}

export default function Settings() {
  const s = settings.value;
  const [sessions, setSessions] = useState<SessionInfo[] | null>(null);
  const load = async () => {
    try {
      const res = await api('/api/auth/sessions');
      if (res.ok) setSessions(((await res.json()) as { sessions: SessionInfo[] }).sessions);
    } catch {
      setSessions(null);
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const revoke = async (id: string) => {
    await api(`/api/auth/sessions/${id}/revoke`, { method: 'POST' });
    void load();
  };
  const logout = async () => {
    await api('/api/auth/logout', { method: 'POST' });
    paired.value = 'no';
  };

  return (
    <main class="app-main anim-fade">
      <ScreenHeader title={titles.settings} back="/progreso" />

      <Group title={settingsCopy.experience}>
        <SwitchRow
          label={labels.sound}
          on={s.sound}
          icon={<Volume2 size={18} aria-hidden="true" />}
          onChange={(v) => setSetting('sound', v)}
        />
        <SwitchRow
          label={labels.haptics}
          on={s.haptics}
          icon={<Vibrate size={18} aria-hidden="true" />}
          onChange={(v) => setSetting('haptics', v)}
        />
        <SwitchRow
          label={settingsCopy.balance}
          help={settingsCopy.balanceHelp}
          on={balanceOn.value}
          icon={<Scale size={18} aria-hidden="true" />}
          onChange={(v) => setSetting('rebalance', v ? 'allowed' : 'not_allowed')}
        />
        <button type="button" class="row press" onClick={() => openSheet({ kind: 'style' })}>
          <span class="row-icon">
            <Palette size={18} aria-hidden="true" />
          </span>
          <span class="flex-1 font-semibold">{gameCopy.style}</span>
          <ChevronRight size={20} class="text-ink-3" aria-hidden="true" />
        </button>
      </Group>

      <h2 class="kicker mt-5 mb-2 px-1">{settingsCopy.reminders}</h2>
      <NotificationSettings />

      <Group title={settingsCopy.plan}>
        <button type="button" class="row press" onClick={() => navigate('/progreso/plan')}>
          <span class="row-icon">
            <BookOpen size={18} aria-hidden="true" />
          </span>
          <span class="flex-1 font-semibold">{titles.myPlan}</span>
          <ChevronRight size={20} class="text-ink-3" aria-hidden="true" />
        </button>
      </Group>

      <Group title={settingsCopy.data}>
        <button
          type="button"
          class="row press"
          data-testid="export-meals"
          onClick={() => openSheet({ kind: 'export-meals' })}
        >
          <span class="row-icon">
            <Salad size={18} aria-hidden="true" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block font-semibold">{exportCopy.row}</span>
            <span class="caption block">{exportCopy.rowHelp}</span>
          </span>
          <ChevronRight size={20} class="text-ink-3" aria-hidden="true" />
        </button>
        <a class="row press" href="/api/export" download>
          <span class="row-icon">
            <Download size={18} aria-hidden="true" />
          </span>
          <span class="flex-1 font-semibold">{exportCopy.backup}</span>
        </a>
      </Group>

      {sessions && (
        <Group title={titles.devices}>
          {sessions.map((x) => (
            <div key={x.id} class="row">
              <span class="row-icon">
                <Smartphone size={18} aria-hidden="true" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block font-semibold">{x.current ? lines.thisDevice : x.label || 'Web'}</span>
                <span class="caption block">{fill(lines.lastSeen, { date: shortDate(appDay(x.last_seen_at)) })}</span>
              </span>
              {!x.current && (
                <button type="button" class="btn btn-neutral btn-sm" onClick={() => revoke(x.id)}>
                  {buttons.revoke}
                </button>
              )}
            </div>
          ))}
        </Group>
      )}

      <div class="mt-5">
        <Diagnostics />
      </div>

      <button type="button" class="btn btn-ghost mt-2 w-full" style="color: var(--destructive)" onClick={logout}>
        <LogOut size={18} aria-hidden="true" />
        {buttons.logout}
      </button>
      <p class="caption mt-2 text-center">{fill(lines.version, { v: __APP_VERSION__ })}</p>
    </main>
  );
}
