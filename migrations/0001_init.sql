-- Fichas D1 schema v1 (docs/02-technical-roadmap.md §6.1).
CREATE TABLE meta (key TEXT PRIMARY KEY, value INTEGER NOT NULL);
INSERT INTO meta (key, value) VALUES ('rev', 0);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,          -- sha256(token) hex
  label TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  revoked_at INTEGER
);

CREATE TABLE auth_attempts (ip TEXT NOT NULL, at INTEGER NOT NULL);
CREATE INDEX auth_attempts_ip_at ON auth_attempts (ip, at);

CREATE TABLE plans (
  id TEXT PRIMARY KEY,
  season INTEGER,                           -- set on confirm
  status TEXT NOT NULL CHECK (status IN ('draft','active','archived','discarded')),
  issued_on TEXT,
  starts_on TEXT,
  ends_on TEXT,
  data TEXT NOT NULL,                       -- PlanV1 JSON ('{}' while a draft is parsing); immutable after confirm
  source_keys TEXT NOT NULL DEFAULT '[]',   -- KV keys of original files
  source_sha256 TEXT,
  parse_report TEXT NOT NULL DEFAULT '{}',  -- models, timings, disagreements, warnings
  created_at INTEGER NOT NULL,
  confirmed_at INTEGER,
  updated_at INTEGER NOT NULL,
  rev INTEGER NOT NULL
);
CREATE UNIQUE INDEX plans_one_active ON plans (status) WHERE status = 'active';
CREATE INDEX plans_rev ON plans (rev);

CREATE TABLE logs (
  id TEXT PRIMARY KEY,                      -- client UUID
  plan_id TEXT NOT NULL,
  day TEXT NOT NULL,
  slot TEXT NOT NULL,                       -- slot key or 'extra'
  kind TEXT NOT NULL CHECK (kind IN ('meal','skip','free')),
  title TEXT NOT NULL DEFAULT '',
  items TEXT NOT NULL DEFAULT '[]',         -- LogItem[]
  raw_units TEXT NOT NULL DEFAULT '{}',     -- before swaps
  units TEXT NOT NULL DEFAULT '{}',         -- after swaps (normalized against target)
  target TEXT NOT NULL DEFAULT '{}',        -- snapshot of slot target at log time
  status TEXT NOT NULL CHECK (status IN ('on','over','under','mixed','extra','skip','free')),
  source TEXT NOT NULL CHECK (source IN ('suggestion','recent','describe','compose','pantry','menu','backfill','photo','push')),
  recipe_id TEXT,
  eaten_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  rev INTEGER NOT NULL
);
CREATE INDEX logs_day ON logs (day);
CREATE INDEX logs_rev ON logs (rev);
CREATE INDEX logs_plan ON logs (plan_id);

CREATE TABLE recipes (                      -- "Tus platos"
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  items TEXT NOT NULL,                      -- LogItem[] (real-food quantities, last version eaten)
  fingerprint TEXT NOT NULL,                -- sorted equivalent ids / normalized labels
  slot_counts TEXT NOT NULL DEFAULT '{}',   -- {slotKey: n}
  times INTEGER NOT NULL DEFAULT 0,
  last_used_at INTEGER,
  favorite INTEGER NOT NULL DEFAULT 0,
  hidden INTEGER NOT NULL DEFAULT 0,
  origin TEXT NOT NULL DEFAULT 'log' CHECK (origin IN ('log','seed','ai')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  rev INTEGER NOT NULL
);
CREATE UNIQUE INDEX recipes_fp ON recipes (fingerprint) WHERE deleted_at IS NULL;
CREATE INDEX recipes_rev ON recipes (rev);

CREATE TABLE pantry (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  equivalent_ids TEXT NOT NULL DEFAULT '[]',
  state TEXT NOT NULL CHECK (state IN ('have','out')),
  on_list INTEGER NOT NULL DEFAULT 0,       -- shopping list flag
  staple INTEGER NOT NULL DEFAULT 0,        -- assumed available unless 'out' (aceite, sal…)
  checked_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  rev INTEGER NOT NULL
);
CREATE INDEX pantry_rev ON pantry (rev);

CREATE TABLE menus (                        -- planned meals ("Mañana")
  id TEXT PRIMARY KEY,                      -- `${day}:${slot}`
  day TEXT NOT NULL,
  slot TEXT NOT NULL,
  title TEXT NOT NULL,
  items TEXT NOT NULL,
  recipe_id TEXT,
  accepted_at INTEGER,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  rev INTEGER NOT NULL
);
CREATE INDEX menus_day ON menus (day);
CREATE INDEX menus_rev ON menus (rev);

CREATE TABLE weighins (
  id TEXT PRIMARY KEY,
  day TEXT NOT NULL,
  kg REAL NOT NULL CHECK (kg > 20 AND kg < 400),
  source TEXT NOT NULL CHECK (source IN ('nutritionist','home')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  rev INTEGER NOT NULL
);
CREATE INDEX weighins_rev ON weighins (rev);

CREATE TABLE achievements (
  id TEXT PRIMARY KEY,                      -- `${kind}:${key}:${season ?? 'life'}`
  kind TEXT NOT NULL CHECK (kind IN ('stamp','level','unlock','surprise')),
  key TEXT NOT NULL,
  season INTEGER,
  earned_at INTEGER NOT NULL,
  seen_at INTEGER,
  updated_at INTEGER NOT NULL,
  rev INTEGER NOT NULL
);
CREATE INDEX achievements_rev ON achievements (rev);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,                      -- JSON
  updated_at INTEGER NOT NULL,
  rev INTEGER NOT NULL
);

CREATE TABLE push_subscriptions (
  id TEXT PRIMARY KEY,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  session_id TEXT,
  created_at INTEGER NOT NULL,
  last_ok_at INTEGER,
  fail_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('slot','plan','test')),
  day TEXT NOT NULL,
  slot TEXT,
  plan_id TEXT,
  sent_at INTEGER NOT NULL,
  acted_at INTEGER                          -- set when a log for that slot arrives within 3 h
);
CREATE INDEX notifications_day ON notifications (day);

CREATE TABLE ai_cache (
  key TEXT PRIMARY KEY,                     -- sha256(job|model|prompt_version|plan_id|normalized input)
  job TEXT NOT NULL,
  model TEXT NOT NULL,
  output TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  hits INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE ai_usage (day TEXT PRIMARY KEY, calls INTEGER NOT NULL DEFAULT 0);

CREATE TABLE client_errors (id TEXT PRIMARY KEY, at INTEGER NOT NULL, message TEXT NOT NULL, stack TEXT, ctx TEXT);
CREATE TABLE ux_events (id TEXT PRIMARY KEY, at INTEGER NOT NULL, name TEXT NOT NULL, ms INTEGER, taps INTEGER, ctx TEXT);
