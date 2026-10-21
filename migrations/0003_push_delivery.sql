-- Claims count toward the daily cap even if a provider fails, preventing retry storms.
ALTER TABLE notifications ADD COLUMN delivery_status TEXT NOT NULL DEFAULT 'sent'
  CHECK (delivery_status IN ('reserved', 'sent', 'failed'));
ALTER TABLE notifications ADD COLUMN delivered_at INTEGER;
ALTER TABLE notifications ADD COLUMN copy_key TEXT;
ALTER TABLE notifications ADD COLUMN copy_index INTEGER;
