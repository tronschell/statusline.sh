-- Running count of published designs, kept exact by triggers so the community
-- page reads one row instead of counting `designs`.
--
-- STRICTLY ADDITIVE: one new table and two triggers. Apply this migration
-- BEFORE deploying the Worker code that reads the new table.

CREATE TABLE design_total (
  id     INTEGER PRIMARY KEY CHECK (id = 1),
  total  INTEGER NOT NULL
);

CREATE TRIGGER designs_total_insert AFTER INSERT ON designs
BEGIN
  UPDATE design_total SET total = total + 1 WHERE id = 1;
END;

CREATE TRIGGER designs_total_delete AFTER DELETE ON designs
BEGIN
  UPDATE design_total SET total = total - 1 WHERE id = 1;
END;

-- Seeded after the triggers exist so a publish landing mid-migration is counted exactly once.
INSERT INTO design_total (id, total) SELECT 1, COUNT(*) FROM designs;
