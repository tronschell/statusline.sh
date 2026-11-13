-- Peppered SHA-256 of the publisher's IP, backing the one-publish-per-day limit.
--
-- STRICTLY ADDITIVE: existing rows stay NULL. Apply this migration BEFORE
-- deploying the Worker code that reads the new column.

ALTER TABLE designs ADD COLUMN publisher_hash TEXT;
CREATE INDEX idx_designs_publisher ON designs(publisher_hash, published_at);
