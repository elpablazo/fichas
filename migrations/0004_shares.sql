-- Links for the nutritionist (docs/05-fichas-2.md §9): a read-only food journal for a date range, no login.
-- The token travels only in the link; the table keeps its hash. Revoked or expired links stop working.
CREATE TABLE shares (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  from_day TEXT NOT NULL,
  to_day TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  views INTEGER NOT NULL DEFAULT 0,
  last_viewed_at INTEGER
);
CREATE INDEX shares_created ON shares (created_at);
