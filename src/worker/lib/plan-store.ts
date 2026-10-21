import { diffPlans } from '../../shared/domain/diff';
import type { PlanReport } from '../../shared/domain/plan-ingestion';
import type { PlanData } from '../../shared/domain/types';

export interface StoredPlan {
  id: string;
  status: string;
  data: string;
  parse_report: string;
  source_keys: string;
  source_sha256: string | null;
  season: number | null;
  starts_on: string | null;
  confirmed_at: number | null;
}
export const getPlan = (db: D1Database, id: string) =>
  db.prepare('SELECT * FROM plans WHERE id=?').bind(id).first<StoredPlan>();
export const reportOf = (row: StoredPlan): PlanReport => JSON.parse(row.parse_report);

export async function draftView(db: D1Database, row: StoredPlan) {
  const report = reportOf(row);
  const active = await db.prepare("SELECT data FROM plans WHERE status='active'").first<{ data: string }>();
  const plan = report.state === 'ready' ? (JSON.parse(row.data) as PlanData) : undefined;
  return {
    draft_id: row.id,
    status: row.status,
    plan,
    report,
    diff: plan ? diffPlans(active ? (JSON.parse(active.data) as PlanData) : null, plan) : undefined,
  };
}
