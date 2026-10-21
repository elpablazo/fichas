-- Confirmed nutrition plans and historical log allocations never change during season transitions.
CREATE TRIGGER plans_immutable BEFORE UPDATE ON plans
WHEN OLD.confirmed_at IS NOT NULL AND (
  NEW.data != OLD.data OR NEW.confirmed_at IS NOT OLD.confirmed_at OR
  NEW.starts_on IS NOT OLD.starts_on OR NEW.season IS NOT OLD.season
)
BEGIN SELECT RAISE(ABORT, 'confirmed_plan_immutable'); END;

CREATE TRIGGER log_snapshot_immutable BEFORE UPDATE ON logs
WHEN NEW.plan_id != OLD.plan_id OR NEW.target != OLD.target OR NEW.day != OLD.day OR NEW.slot != OLD.slot
BEGIN SELECT RAISE(ABORT, 'log_snapshot_immutable'); END;

CREATE TABLE plan_confirm_guards (
  id TEXT PRIMARY KEY,
  valid INTEGER NOT NULL CHECK(valid = 1)
);
