import { Database } from "bun:sqlite";
import { mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";

const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS designs (
  id TEXT PRIMARY KEY,
  json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  is_public INTEGER NOT NULL DEFAULT 0,
  slug TEXT UNIQUE,
  author_name TEXT,
  description TEXT,
  forks INTEGER NOT NULL DEFAULT 0,
  forked_from TEXT REFERENCES designs(id),
  published_at INTEGER
);
CREATE INDEX IF NOT EXISTS designs_public_recent ON designs(is_public, published_at DESC);
CREATE INDEX IF NOT EXISTS designs_public_popular ON designs(is_public, forks DESC, views DESC);
`;

const DEFAULT_PATH = "./data/statusline.db";

let cached: Database | null = null;
let overridePath: string | null = null;

function init(db: Database): Database {
  if (overridePath !== ":memory:") {
    db.exec("PRAGMA journal_mode = WAL;");
  }
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(MIGRATION_SQL);
  return db;
}

function open(target: string): Database {
  if (target === ":memory:") {
    return new Database(":memory:");
  }
  const dir = dirname(target);
  if (dir && dir !== "." && !existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return new Database(target, { create: true });
}

export function getDb(path?: string): Database {
  if (cached) return cached;
  const target = path ?? overridePath ?? DEFAULT_PATH;
  overridePath = target;
  const db = open(target);
  init(db);
  cached = db;
  return db;
}

export function setDbPathForTests(path: string): void {
  if (cached) {
    cached.close();
    cached = null;
  }
  overridePath = path;
}

export function resetDbForTests(): void {
  if (cached) {
    cached.close();
    cached = null;
  }
  overridePath = null;
}
