-- Accounts, Pro subscriptions, cloud library, teams.
--
-- STRICTLY ADDITIVE: new tables plus nullable columns on `designs`. Nothing
-- here changes or drops existing data, so it is safe to apply while the
-- currently-deployed Worker keeps serving traffic. Apply this migration BEFORE
-- deploying the Worker code that reads the new columns.

CREATE TABLE users (
  id            TEXT    PRIMARY KEY,
  -- Public handle shown on the community pages (@username). Stored lowercase,
  -- 3-30 chars of a-z 0-9 _ -, validated in the Worker; UNIQUE makes it race-safe.
  username      TEXT    NOT NULL UNIQUE,
  -- Only ever set from a provider-verified address or a password sign-up.
  email         TEXT    UNIQUE,
  email_verified INTEGER NOT NULL DEFAULT 0 CHECK (email_verified IN (0, 1)),
  -- "pbkdf2$<iterations>$<salt>$<hash>"; NULL for OAuth-only accounts.
  password_hash TEXT,
  display_name  TEXT    NOT NULL CHECK (length(display_name) BETWEEN 1 AND 60),
  avatar_url    TEXT    NOT NULL DEFAULT '',
  donation_url  TEXT    CHECK (donation_url IS NULL OR length(donation_url) <= 300),
  -- Denormalised entitlement: epoch-ms until which the user counts as Pro.
  -- Recomputed from `subscriptions` by the webhook; 0 = never / lapsed.
  pro_until     INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL
);

-- Linked sign-in providers ('github' | 'google'). One user can have several.
CREATE TABLE identities (
  provider     TEXT    NOT NULL CHECK (provider IN ('github', 'google')),
  provider_id  TEXT    NOT NULL,
  user_id      TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   INTEGER NOT NULL,
  PRIMARY KEY (provider, provider_id)
);
CREATE INDEX idx_identities_user ON identities(user_id);

-- Single-use password-reset tokens (only the SHA-256 is stored, 1h lifetime).
CREATE TABLE password_resets (
  token_hash  TEXT    PRIMARY KEY,
  user_id     TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL
);
CREATE INDEX idx_password_resets_user ON password_resets(user_id);

-- Session tokens are random 32-byte values; only their SHA-256 is stored.
CREATE TABLE sessions (
  token_hash  TEXT    PRIMARY KEY,
  user_id     TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL
);
CREATE INDEX idx_sessions_user    ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- Single-use OAuth `state` values (10 minute lifetime, reaped by cron).
CREATE TABLE oauth_states (
  state       TEXT    PRIMARY KEY,
  provider    TEXT    NOT NULL DEFAULT 'github',
  return_to   TEXT    NOT NULL,
  created_at  INTEGER NOT NULL
);

-- Lemon Squeezy subscriptions, keyed by their subscription id. `ls_updated_at`
-- lets the webhook ignore out-of-order / replayed events.
CREATE TABLE subscriptions (
  id             TEXT    PRIMARY KEY,
  user_id        TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_id    TEXT    NOT NULL DEFAULT '',
  status         TEXT    NOT NULL,
  renews_at      INTEGER,
  ends_at        INTEGER,
  ls_updated_at  INTEGER NOT NULL DEFAULT 0,
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);
CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);

-- Published community designs can now be owned (NULL = anonymous, as before).
ALTER TABLE designs ADD COLUMN owner_id    TEXT REFERENCES users(id);
ALTER TABLE designs ADD COLUMN featured_at INTEGER;
CREATE INDEX idx_designs_owner    ON designs(owner_id);
CREATE INDEX idx_designs_featured ON designs(featured_at DESC) WHERE featured_at IS NOT NULL;

CREATE TABLE teams (
  id            TEXT    PRIMARY KEY,
  name          TEXT    NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
  owner_id      TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invite_token  TEXT    NOT NULL UNIQUE,
  created_at    INTEGER NOT NULL
);
CREATE INDEX idx_teams_owner ON teams(owner_id);

CREATE TABLE team_members (
  team_id    TEXT    NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id    TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT    NOT NULL CHECK (role IN ('owner', 'editor')),
  joined_at  INTEGER NOT NULL,
  PRIMARY KEY (team_id, user_id)
);
CREATE INDEX idx_team_members_user ON team_members(user_id);

-- Private, mutable, owner-scoped designs (the "cloud library" and team
-- designs). Deliberately NOT part of `designs`, which every public/SEO/sitemap
-- query assumes is fully public. `id` doubles as the permanent install id.
CREATE TABLE cloud_designs (
  id            TEXT    PRIMARY KEY,
  owner_id      TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id       TEXT    REFERENCES teams(id) ON DELETE CASCADE,
  name          TEXT    NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
  json          TEXT    NOT NULL CHECK (length(json) BETWEEN 2 AND 32768),
  version       INTEGER NOT NULL DEFAULT 1,
  link_enabled  INTEGER NOT NULL DEFAULT 0 CHECK (link_enabled IN (0, 1)),
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);
CREATE INDEX idx_cloud_designs_owner ON cloud_designs(owner_id, updated_at DESC);
CREATE UNIQUE INDEX idx_cloud_designs_team ON cloud_designs(team_id) WHERE team_id IS NOT NULL;

CREATE TABLE design_versions (
  design_id   TEXT    NOT NULL REFERENCES cloud_designs(id) ON DELETE CASCADE,
  version     INTEGER NOT NULL,
  json        TEXT    NOT NULL,
  author_id   TEXT,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (design_id, version)
);
