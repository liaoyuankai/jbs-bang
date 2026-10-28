// Schema lives in a TS string so it ships inside the Next standalone bundle.
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS subjects (
  id         TEXT PRIMARY KEY,
  type       TEXT NOT NULL CHECK (type IN ('shop','dm','player')),
  name       TEXT NOT NULL,
  city       TEXT NOT NULL,
  shop_name  TEXT,
  aliases    TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_subjects_city_type ON subjects (city, type);
CREATE INDEX IF NOT EXISTS idx_subjects_name ON subjects (name);

CREATE TABLE IF NOT EXISTS entries (
  id             TEXT PRIMARY KEY,
  subject_id     TEXT NOT NULL REFERENCES subjects(id),
  list           TEXT NOT NULL CHECK (list IN ('red','black')),
  category       TEXT NOT NULL,
  body           TEXT NOT NULL,
  body_hash      TEXT NOT NULL,
  occurred_at    TEXT,
  evidence_count INTEGER NOT NULL DEFAULT 0,
  vid            TEXT NOT NULL,
  ip_hash        TEXT NOT NULL,
  status         TEXT NOT NULL CHECK (status IN ('pending','published','rejected','removed')),
  source         TEXT NOT NULL DEFAULT 'web' CHECK (source IN ('web','import')),
  verified       INTEGER NOT NULL DEFAULT 0,
  removed_reason TEXT,
  removed_at     TEXT,
  reviewed_at    TEXT,
  created_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_entries_subject ON entries (subject_id, status);
CREATE INDEX IF NOT EXISTS idx_entries_status_created ON entries (status, created_at);

CREATE TABLE IF NOT EXISTS comments (
  id             TEXT PRIMARY KEY,
  entry_id       TEXT REFERENCES entries(id),
  subject_id     TEXT NOT NULL REFERENCES subjects(id),
  kind           TEXT NOT NULL CHECK (kind IN ('comment','response')),
  body           TEXT NOT NULL,
  vid            TEXT NOT NULL,
  ip_hash        TEXT NOT NULL,
  status         TEXT NOT NULL CHECK (status IN ('pending','published','rejected','removed')),
  removed_reason TEXT,
  removed_at     TEXT,
  created_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_comments_entry ON comments (entry_id, status);
CREATE INDEX IF NOT EXISTS idx_comments_subject ON comments (subject_id, kind, status);

CREATE TABLE IF NOT EXISTS endorsements (
  entry_id   TEXT NOT NULL REFERENCES entries(id),
  vid        TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (entry_id, vid)
);

CREATE TABLE IF NOT EXISTS events (
  seq        INTEGER PRIMARY KEY AUTOINCREMENT,
  kind       TEXT NOT NULL,
  ref_id     TEXT NOT NULL,
  payload    TEXT NOT NULL,
  prev_hash  TEXT NOT NULL,
  hash       TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
  id          TEXT PRIMARY KEY,
  target_kind TEXT NOT NULL CHECK (target_kind IN ('entry','comment')),
  target_id   TEXT NOT NULL,
  reason      TEXT NOT NULL,
  detail      TEXT,
  vid         TEXT NOT NULL,
  ip_hash     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','handled')),
  created_at  TEXT NOT NULL,
  handled_at  TEXT,
  UNIQUE (target_kind, target_id, vid)
);
CREATE INDEX IF NOT EXISTS idx_reports_open ON reports (status, created_at);

CREATE TABLE IF NOT EXISTS rate_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_hash    TEXT NOT NULL,
  kind       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate_events ON rate_events (ip_hash, kind, created_at);
`;
