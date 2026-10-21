import { useMemo } from 'preact/hooks';
import { seasonReport } from '../../shared/domain/story';
import { SeasonSummary } from '../components/SeasonSummary';
import { gardenLogs } from '../game';
import { achievements, livePlans, today, weighins } from '../state/signals';
import { closeSheet } from '../state/ui';

export default function SeasonRecap({ id, mode = 'recap' }: { id: string; mode?: 'recap' | 'report' }) {
  const plan = livePlans.value.find((p) => p.id === id);
  const logs = gardenLogs.value,
    weights = weighins.value,
    earned = achievements.value,
    day = today.value;
  const report = useMemo(
    () => (plan ? seasonReport(plan, logs, weights, earned, day) : null),
    [plan, logs, weights, earned, day],
  );
  return plan && report ? (
    <SeasonSummary plan={plan} logs={logs} report={report} kind={mode} onClose={closeSheet} />
  ) : null;
}
