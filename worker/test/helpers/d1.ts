/**
 * A real SQLite-backed D1 shim (bun:sqlite) that applies every file in
 * worker/migrations in order. Unlike the regex-stub D1 used by the older
 * tests, this runs the actual SQL, so constraints, FKs, unique indexes and
 * multi-statement batches behave like production.
 */
import { Database } from "bun:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS = join(import.meta.dir, "../../migrations");

class Stmt {
  private args: unknown[] = [];
  constructor(private db: Database, readonly sql: string) {}
  bind(...args: unknown[]) {
    this.args = args;
    return this;
  }
  async first<T = unknown>(): Promise<T | null> {
    return (this.db.query(this.sql).get(...(this.args as never[])) as T | null) ?? null;
  }
  async all<T = unknown>() {
    const results = this.db.query(this.sql).all(...(this.args as never[])) as T[];
    return { results, success: true, meta: {} };
  }
  async run() {
    const r = this.db.query(this.sql).run(...(this.args as never[]));
    return { success: true, meta: { changes: r.changes } };
  }
}

export function makeD1(): D1Database & { raw: Database } {
  const db = new Database(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  for (const f of readdirSync(MIGRATIONS).filter((n) => n.endsWith(".sql")).sort()) {
    db.exec(readFileSync(join(MIGRATIONS, f), "utf8"));
  }
  return {
    raw: db,
    prepare: (sql: string) => new Stmt(db, sql),
    async batch(stmts: Stmt[]) {
      const out: unknown[] = [];
      db.exec("BEGIN");
      try {
        for (const s of stmts) out.push(await s.run());
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
      return out;
    },
  } as unknown as D1Database & { raw: Database };
}
