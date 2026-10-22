-- The day recap (docs/05-fichas-2.md §10) is a new notification kind. SQLite can't change a CHECK constraint, so the
-- table is rebuilt with the same columns, defaults and index.
CREATE TABLE notifications_next (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('slot','plan','test','recap')),
  day TEXT NOT NULL,
  slot TEXT,
  plan_id TEXT,
  sent_at INTEGER NOT NULL,
  acted_at INTEGER,
  delivery_status TEXT NOT NULL DEFAULT 'sent' CHECK (delivery_status IN ('reserved', 'sent', 'failed')),
  delivered_at INTEGER,
  copy_key TEXT,
  copy_index INTEGER
);
INSERT INTO notifications_next (id, kind, day, slot, plan_id, sent_at, acted_at, delivery_status, delivered_at, copy_key, copy_index)
  SELECT id, kind, day, slot, plan_id, sent_at, acted_at, delivery_status, delivered_at, copy_key, copy_index FROM notifications;
DROP TABLE notifications;
ALTER TABLE notifications_next RENAME TO notifications;
CREATE INDEX notifications_day ON notifications (day);
