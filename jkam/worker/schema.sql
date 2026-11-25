-- JKam database (Cloudflare D1)
-- Peran: headadmin (pengelola sistem), owner (pelanggan paket), user (perekam di HP)

CREATE TABLE IF NOT EXISTS accounts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  role         TEXT NOT NULL CHECK (role IN ('headadmin','owner','user')),
  username     TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pass_hash    TEXT NOT NULL,
  pass_salt    TEXT NOT NULL,
  name         TEXT NOT NULL DEFAULT '',
  phone        TEXT NOT NULL DEFAULT '',
  owner_id     INTEGER REFERENCES accounts(id) ON DELETE CASCADE, -- hanya untuk role=user
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  last_seen    INTEGER,
  is_recording INTEGER NOT NULL DEFAULT 0,
  device_info  TEXT NOT NULL DEFAULT '',
  created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_acc_owner ON accounts(owner_id);
CREATE INDEX IF NOT EXISTS idx_acc_role ON accounts(role);

CREATE TABLE IF NOT EXISTS packages (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  max_users     INTEGER NOT NULL,
  storage_gb    INTEGER NOT NULL,
  duration_days INTEGER NOT NULL,
  price         INTEGER NOT NULL DEFAULT 0,   -- Rupiah
  description   TEXT NOT NULL DEFAULT '',
  active        INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS licenses (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id     INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  package_id   INTEGER NOT NULL REFERENCES packages(id),
  status       TEXT NOT NULL CHECK (status IN ('pending','active','rejected')),
  requested_at INTEGER NOT NULL,
  starts_at    INTEGER,
  expires_at   INTEGER,
  note         TEXT NOT NULL DEFAULT '',
  approved_by  INTEGER
);
CREATE INDEX IF NOT EXISTS idx_lic_owner ON licenses(owner_id, status);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sess_acc ON sessions(account_id);

CREATE TABLE IF NOT EXISTS recordings (
  id          TEXT PRIMARY KEY,
  owner_id    INTEGER NOT NULL,
  user_id     INTEGER NOT NULL,
  session_id  TEXT NOT NULL,
  seq         INTEGER NOT NULL,
  started_at  INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  size        INTEGER NOT NULL,
  mime        TEXT NOT NULL,
  r2_key      TEXT NOT NULL,
  enhanced    INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rec_owner ON recordings(owner_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_rec_user ON recordings(user_id, started_at DESC);

INSERT INTO packages (name, max_users, storage_gb, duration_days, price, description)
SELECT 'Basic', 3, 10, 30, 50000, '3 perekam, 10 GB'
WHERE NOT EXISTS (SELECT 1 FROM packages);
INSERT INTO packages (name, max_users, storage_gb, duration_days, price, description)
SELECT 'Pro', 10, 50, 30, 150000, '10 perekam, 50 GB'
WHERE (SELECT COUNT(*) FROM packages) = 1;
INSERT INTO packages (name, max_users, storage_gb, duration_days, price, description)
SELECT 'Bisnis', 50, 200, 30, 500000, '50 perekam, 200 GB'
WHERE (SELECT COUNT(*) FROM packages) = 2;

-- Perintah dari Owner/Head Admin ke HP user (mulai/stop rekam). Satu perintah terbaru per user.
CREATE TABLE IF NOT EXISTS commands (
  user_id    INTEGER PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  action     TEXT NOT NULL CHECK (action IN ('start','stop')),
  created_at INTEGER NOT NULL,
  acked      INTEGER NOT NULL DEFAULT 0
);

-- Token Firebase (FCM) per user untuk push instan perintah mulai/stop.
CREATE TABLE IF NOT EXISTS fcm_tokens (
  user_id    INTEGER PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  token      TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
