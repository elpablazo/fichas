import { Bell, BellRing, ChevronDown, Moon, Pause, Play, Send } from 'lucide-preact';
import { useState } from 'preact/hooks';
import { appDay } from '../../shared/domain/day';
import { fill, shortDate, timeLabel } from '../../shared/domain/format';
import { baseTimes } from '../../shared/domain/slots';
import { setSetting } from '../actions';
import { notificationCopy } from '../copy/es-MX';
import { firstPullDone } from '../db/sync';
import { disableReminders, enableReminders, pushBusy, pushPermission, pushSupported, testPush } from '../notifications';
import { activePlan, dataReady, settings } from '../state/signals';
import { SwitchRow } from './ui';

export function NotificationSettings() {
  const preferences = settings.value.notifications;
  const [slots, setSlots] = useState(false);
  const plan = activePlan.value?.data;
  const update = (next: Partial<typeof preferences>) =>
    void setSetting('notifications', { ...settings.value.notifications, ...next });
  const paused = (preferences.paused_until ?? 0) > Date.now();
  return (
    <section class="card divide overflow-hidden" data-testid="notification-settings">
      <SwitchRow
        label={notificationCopy.master}
        on={preferences.enabled}
        icon={<Bell size={18} aria-hidden="true" />}
        disabled={pushBusy.value || !dataReady.value || (navigator.onLine && !firstPullDone.value)}
        onChange={(v) => {
          if (!pushBusy.value) void (v ? enableReminders() : disableReminders());
        }}
      />
      {!pushSupported.value && <p class="caption px-4 py-3">{notificationCopy.install}</p>}
      {pushSupported.value && pushPermission.value === 'denied' && (
        <p class="caption px-4 py-3">{notificationCopy.permissions}</p>
      )}
      {preferences.enabled && (
        <>
          <div class="px-4 py-3">
            <p class="mb-2 flex items-center gap-2 font-semibold">
              <Pause size={16} class="text-accent-ink" aria-hidden="true" />
              {paused
                ? fill(notificationCopy.paused, { date: shortDate(appDay(preferences.paused_until ?? Date.now())) })
                : notificationCopy.pause}
            </p>
            <div class="flex gap-2">
              {paused ? (
                <button
                  type="button"
                  class="btn btn-tonal btn-sm flex-1"
                  onClick={() => update({ paused_until: null })}
                >
                  <Play size={16} aria-hidden="true" />
                  {notificationCopy.resume}
                </button>
              ) : (
                [1, 3, 7].map((days) => (
                  <button
                    type="button"
                    class="btn btn-neutral btn-sm flex-1"
                    key={days}
                    onClick={() => update({ paused_until: Date.now() + days * 86400000 })}
                  >
                    {fill(notificationCopy.days, { n: days })}
                  </button>
                ))
              )}
            </div>
          </div>
          <div class="flex items-center gap-2 px-4 py-3">
            <Moon size={16} class="text-accent-ink" aria-hidden="true" />
            <span class="flex-1 font-semibold">{notificationCopy.quiet}</span>
            {preferences.quiet.map((value, i) => (
              <input
                type="time"
                key={i}
                value={value}
                class="field num min-h-11 w-[96px] px-2 text-center text-[15px]"
                aria-label={i ? notificationCopy.until : notificationCopy.from}
                onChange={(e) => {
                  if (!e.currentTarget.value) return;
                  const quiet: [string, string] = [...preferences.quiet];
                  quiet[i] = e.currentTarget.value;
                  update({ quiet });
                }}
              />
            ))}
          </div>
          <button type="button" class="row press" aria-expanded={slots} onClick={() => setSlots(!slots)}>
            <span class="row-icon">
              <BellRing size={18} aria-hidden="true" />
            </span>
            <span class="flex-1 font-semibold">{notificationCopy.meals}</span>
            <ChevronDown
              size={18}
              class={`text-ink-3 transition-transform ${slots ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>
          {slots &&
            plan?.slots.map((s, i) => (
              <SwitchRow
                key={s.key}
                label={`${s.label} · ${timeLabel(baseTimes(plan.slots)[i] ?? 0)}`}
                on={preferences.slots[s.key] !== false}
                onChange={(v) => update({ slots: { ...preferences.slots, [s.key]: v } })}
              />
            ))}
          <div class="px-4 py-3">
            <button
              type="button"
              class="btn btn-neutral btn-sm w-full"
              disabled={pushBusy.value}
              onClick={() => void testPush()}
            >
              <Send size={16} aria-hidden="true" />
              {notificationCopy.test}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
