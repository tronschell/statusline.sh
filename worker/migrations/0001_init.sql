CREATE TABLE designs (
  id            TEXT    PRIMARY KEY,
  json          TEXT    NOT NULL CHECK (length(json) BETWEEN 2 AND 32768),
  slug          TEXT    NOT NULL UNIQUE,
  name          TEXT    NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
  author_name   TEXT    NOT NULL CHECK (length(author_name) BETWEEN 1 AND 40),
  description   TEXT    NOT NULL DEFAULT '' CHECK (length(description) <= 200),
  forked_from   TEXT    REFERENCES designs(id),
  published_at  INTEGER NOT NULL,
  views         INTEGER NOT NULL DEFAULT 0 CHECK (views  >= 0),
  forks         INTEGER NOT NULL DEFAULT 0 CHECK (forks  >= 0)
);
CREATE INDEX idx_designs_recent  ON designs(published_at DESC, id ASC);
CREATE INDEX idx_designs_popular ON designs(forks DESC, views DESC, id ASC);

CREATE TABLE install_records (
  id          TEXT    PRIMARY KEY,
  json        TEXT    NOT NULL CHECK (length(json) BETWEEN 2 AND 32768),
  created_at  INTEGER NOT NULL
);
CREATE INDEX idx_install_records_created_at ON install_records(created_at);
