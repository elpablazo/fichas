import { decideNudges } from '../../shared/domain/nudges';
import { loadNudgeState, sendNudge } from './push';

export async function runScheduler(env: Env) {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return;
  const now = Date.now();
  const { state, subscriptions } = await loadNudgeState(env, now);
  for (const nudge of decideNudges(state, now)) {
    const label = state.plan?.data.slots.find((s) => s.key === nudge.slot)?.label ?? '';
    await sendNudge(env, nudge, subscriptions, label);
  }
}
