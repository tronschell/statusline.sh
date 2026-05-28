CREATE TABLE view_rollup_state (
  id              INTEGER PRIMARY KEY CHECK (id = 1),
  last_rollup_at  INTEGER NOT NULL
);
INSERT INTO view_rollup_state (id, last_rollup_at) VALUES (1, 0);
