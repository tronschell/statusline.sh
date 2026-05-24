import { nanoid } from "nanoid";
import { validateDesign, ValidationError } from "../shared/schema";
import type { CommunityCardSummary, Design } from "../shared/types";
import { getDb } from "./db";

export interface DesignRow {
  id: string;
  design: Design;
  created_at: number;
  updated_at: number;
  views: number;
  is_public: boolean;
  slug: string | null;
  author_name: string | null;
  description: string | null;
  forks: number;
  forked_from: string | null;
  published_at: number | null;
}

interface RawRow {
  id: string;
  json: string;
  created_at: number;
  updated_at: number;
  views: number;
  is_public: number;
  slug: string | null;
  author_name: string | null;
  description: string | null;
  forks: number;
  forked_from: string | null;
  published_at: number | null;
}

function rowToDesignRow(r: RawRow): DesignRow {
  return {
    id: r.id,
    design: JSON.parse(r.json) as Design,
    created_at: r.created_at,
    updated_at: r.updated_at,
    views: r.views,
    is_public: r.is_public === 1,
    slug: r.slug,
    author_name: r.author_name,
    description: r.description,
    forks: r.forks,
    forked_from: r.forked_from,
    published_at: r.published_at,
  };
}

function rowToCommunitySummary(r: RawRow): CommunityCardSummary {
  return {
    id: r.id,
    slug: r.slug!,
    name: (JSON.parse(r.json) as Design).name,
    author_name: r.author_name,
    description: r.description,
    forks: r.forks,
    views: r.views,
    published_at: r.published_at!,
    forked_from: r.forked_from,
    design: JSON.parse(r.json) as Design,
  };
}

export function kebabCase(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase()
    .replace(/^-+|-+$/g, "") || "design";
}

export function insertDesign(input: unknown): { id: string } {
  const design = validateDesign(input);
  const id = nanoid(10);
  const now = Date.now();
  const db = getDb();
  const stmt = db.prepare(
    "INSERT INTO designs (id, json, created_at, updated_at) VALUES (?, ?, ?, ?)",
  );
  stmt.run(id, JSON.stringify(design), now, now);
  return { id };
}

export function getDesignById(id: string, bumpViews = false): DesignRow | null {
  const db = getDb();
  if (bumpViews) {
    db.prepare("UPDATE designs SET views = views + 1 WHERE id = ?").run(id);
  }
  const r = db
    .prepare(
      "SELECT id, json, created_at, updated_at, views, is_public, slug, author_name, description, forks, forked_from, published_at FROM designs WHERE id = ?",
    )
    .get(id) as RawRow | null;
  return r ? rowToDesignRow(r) : null;
}

export function updateDesignJson(id: string, input: unknown): boolean {
  const design = validateDesign(input);
  const db = getDb();
  const now = Date.now();
  const res = db
    .prepare("UPDATE designs SET json = ?, updated_at = ? WHERE id = ?")
    .run(JSON.stringify(design), now, id);
  return res.changes > 0;
}

export interface PublishInput {
  author_name: string;
  description: string;
  name: string;
}

export function publishDesign(
  id: string,
  input: PublishInput,
): { slug: string } | null {
  const db = getDb();
  const existing = db
    .prepare("SELECT json FROM designs WHERE id = ?")
    .get(id) as { json: string } | null;
  if (!existing) return null;

  const design = JSON.parse(existing.json) as Design;
  design.name = input.name;

  const now = Date.now();
  const slug = `${kebabCase(input.name)}-${id.slice(0, 4)}`;

  db.prepare(
    `UPDATE designs SET
       json = ?, is_public = 1, slug = ?, author_name = ?, description = ?,
       published_at = ?, updated_at = ?
     WHERE id = ?`,
  ).run(
    JSON.stringify(design),
    slug,
    input.author_name,
    input.description,
    now,
    now,
    id,
  );
  return { slug };
}

export function unpublishDesign(id: string): boolean {
  const db = getDb();
  const res = db
    .prepare(
      "UPDATE designs SET is_public = 0, slug = NULL, published_at = NULL, updated_at = ? WHERE id = ?",
    )
    .run(Date.now(), id);
  return res.changes > 0;
}

export function forkDesign(srcId: string): { id: string } | null {
  const db = getDb();
  const src = db
    .prepare("SELECT json FROM designs WHERE id = ?")
    .get(srcId) as { json: string } | null;
  if (!src) return null;

  const design = JSON.parse(src.json) as Design;
  const newId = nanoid(10);
  const now = Date.now();

  const txn = db.transaction(() => {
    db.prepare(
      "INSERT INTO designs (id, json, created_at, updated_at, forked_from) VALUES (?, ?, ?, ?, ?)",
    ).run(newId, JSON.stringify(design), now, now, srcId);
    db.prepare("UPDATE designs SET forks = forks + 1 WHERE id = ?").run(srcId);
  });
  txn();
  return { id: newId };
}

export interface CommunityListOpts {
  sort?: "recent" | "popular";
  limit?: number;
  cursor?: string | null;
}

export interface CommunityListResult {
  items: CommunityCardSummary[];
  nextCursor: string | null;
}

interface RecentCursor {
  pub: number;
  id: string;
}

interface PopularCursor {
  forks: number;
  views: number;
  id: string;
}

function decodeCursor<T>(cursor: string | null | undefined): T | null {
  if (!cursor) return null;
  try {
    return JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    ) as T;
  } catch {
    return null;
  }
}

function encodeCursor(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj), "utf8").toString("base64url");
}

export function listCommunity(opts: CommunityListOpts = {}): CommunityListResult {
  const db = getDb();
  const sort = opts.sort ?? "recent";
  const limit = Math.min(Math.max(opts.limit ?? 24, 1), 50);

  let rows: RawRow[];
  if (sort === "popular") {
    const cur = decodeCursor<PopularCursor>(opts.cursor);
    if (cur) {
      rows = db
        .prepare(
          `SELECT id, json, created_at, updated_at, views, is_public, slug, author_name, description, forks, forked_from, published_at
           FROM designs
           WHERE is_public = 1
             AND (forks < ?
                  OR (forks = ? AND views < ?)
                  OR (forks = ? AND views = ? AND id > ?))
           ORDER BY forks DESC, views DESC, id ASC
           LIMIT ?`,
        )
        .all(cur.forks, cur.forks, cur.views, cur.forks, cur.views, cur.id, limit + 1) as RawRow[];
    } else {
      rows = db
        .prepare(
          `SELECT id, json, created_at, updated_at, views, is_public, slug, author_name, description, forks, forked_from, published_at
           FROM designs
           WHERE is_public = 1
           ORDER BY forks DESC, views DESC, id ASC
           LIMIT ?`,
        )
        .all(limit + 1) as RawRow[];
    }
  } else {
    const cur = decodeCursor<RecentCursor>(opts.cursor);
    if (cur) {
      rows = db
        .prepare(
          `SELECT id, json, created_at, updated_at, views, is_public, slug, author_name, description, forks, forked_from, published_at
           FROM designs
           WHERE is_public = 1
             AND (published_at < ?
                  OR (published_at = ? AND id > ?))
           ORDER BY published_at DESC, id ASC
           LIMIT ?`,
        )
        .all(cur.pub, cur.pub, cur.id, limit + 1) as RawRow[];
    } else {
      rows = db
        .prepare(
          `SELECT id, json, created_at, updated_at, views, is_public, slug, author_name, description, forks, forked_from, published_at
           FROM designs
           WHERE is_public = 1
           ORDER BY published_at DESC, id ASC
           LIMIT ?`,
        )
        .all(limit + 1) as RawRow[];
    }
  }

  let nextCursor: string | null = null;
  if (rows.length > limit) {
    const last = rows[limit - 1]!;
    if (sort === "popular") {
      nextCursor = encodeCursor({
        forks: last.forks,
        views: last.views,
        id: last.id,
      } satisfies PopularCursor);
    } else {
      nextCursor = encodeCursor({
        pub: last.published_at!,
        id: last.id,
      } satisfies RecentCursor);
    }
    rows = rows.slice(0, limit);
  }

  return {
    items: rows.map(rowToCommunitySummary),
    nextCursor,
  };
}

export function getCommunityBySlug(slug: string): DesignRow | null {
  const db = getDb();
  db.prepare("UPDATE designs SET views = views + 1 WHERE slug = ? AND is_public = 1").run(
    slug,
  );
  const r = db
    .prepare(
      "SELECT id, json, created_at, updated_at, views, is_public, slug, author_name, description, forks, forked_from, published_at FROM designs WHERE slug = ? AND is_public = 1",
    )
    .get(slug) as RawRow | null;
  return r ? rowToDesignRow(r) : null;
}

export { ValidationError };
