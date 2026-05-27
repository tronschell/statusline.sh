import { nanoid } from "nanoid";
import type { Design } from "@statusline/shared/types";

/**
 * Pure D1 data layer for the community feature. No HTTP concerns — handlers
 * compose on top of these functions. Designed to run inside a Cloudflare
 * Worker without `nodejs_compat`, so we only use Web Standard APIs
 * (TextEncoder/Decoder, btoa/atob) — no `Buffer`.
 */

export interface DbEnv {
  DB: D1Database;
}

export interface DesignRow {
  id: string;
  design: Design;
  slug: string;
  name: string;
  author_name: string;
  description: string;
  forked_from: string | null;
  published_at: number;
  views: number;
  forks: number;
  installs: number;
}

export interface CommunityCardSummary {
  id: string;
  design: Design;
  slug: string;
  name: string;
  author_name: string;
  description: string;
  forked_from: string | null;
  published_at: number;
  views: number;
  forks: number;
  installs: number;
}

export interface PublishInput {
  design: Design;
  name: string;
  author_name: string;
  description: string;
  forked_from?: string | null;
}

export interface ListOptions {
  sort?: "recent" | "popular";
  limit?: number;
  cursor?: string | null;
}

export interface ListResult {
  items: CommunityCardSummary[];
  nextCursor: string | null;
}

export interface CommunitySitemapEntry {
  slug: string;
  published_at: number;
}

export interface CommunitySeoRow {
  slug: string;
  name: string;
  author_name: string;
  description: string;
  published_at: number;
  views: number;
  forks: number;
  installs: number;
}

interface RawDesignRow {
  id: string;
  json: string;
  slug: string;
  name: string;
  author_name: string;
  description: string;
  forked_from: string | null;
  published_at: number;
  views: number;
  forks: number;
  installs: number;
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

const DESIGN_COLS =
  "id, json, slug, name, author_name, description, forked_from, published_at, views, forks, installs";

function rowToDesignRow(r: RawDesignRow): DesignRow {
  return {
    id: r.id,
    design: JSON.parse(r.json) as Design,
    slug: r.slug,
    name: r.name,
    author_name: r.author_name,
    description: r.description,
    forked_from: r.forked_from,
    published_at: r.published_at,
    views: r.views,
    forks: r.forks,
    installs: r.installs,
  };
}

export function kebabCase(s: string): string {
  return (
    s
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .toLowerCase()
      .replace(/^-+|-+$/g, "") || "design"
  );
}

export function encodeCursor(obj: unknown): string {
  const s = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeCursor(s: string): unknown | null {
  try {
    let b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

function isUniqueViolation(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /UNIQUE|constraint/i.test(msg);
}

async function tryInsertDesign(
  env: DbEnv,
  id: string,
  slug: string,
  input: PublishInput,
  publishedAt: number,
): Promise<void> {
  // Persist the name on the design payload so /community renders match the
  // submitted card name even if the design was originally drafted with a
  // different `name` field.
  const designToStore: Design = { ...input.design, name: input.name };
  await env.DB
    .prepare(
      `INSERT INTO designs (id, json, slug, name, author_name, description, forked_from, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      JSON.stringify(designToStore),
      slug,
      input.name,
      input.author_name,
      input.description,
      input.forked_from ?? null,
      publishedAt,
    )
    .run();
}

export async function publishDesign(
  env: DbEnv,
  input: PublishInput,
): Promise<{ id: string; slug: string }> {
  const kebab = kebabCase(input.name);
  const publishedAt = Date.now();

  // Attempt 1
  let id = nanoid(10);
  let slug = `${kebab}-${id.slice(0, 4)}`;
  try {
    await tryInsertDesign(env, id, slug, input, publishedAt);
    return { id, slug };
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
  }

  // Attempt 2 — fresh nanoid (different first 4 chars)
  id = nanoid(10);
  slug = `${kebab}-${id.slice(0, 4)}`;
  try {
    await tryInsertDesign(env, id, slug, input, publishedAt);
    return { id, slug };
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new Error("SLUG_COLLISION");
    }
    throw err;
  }
}

export async function getCommunityBySlug(
  env: DbEnv,
  slug: string,
): Promise<DesignRow | null> {
  const r = (await env.DB
    .prepare(`SELECT ${DESIGN_COLS} FROM designs WHERE slug = ?`)
    .bind(slug)
    .first()) as RawDesignRow | null;
  return r ? rowToDesignRow(r) : null;
}

export async function listCommunity(
  env: DbEnv,
  opts: ListOptions,
): Promise<ListResult> {
  const sort = opts.sort ?? "recent";
  const limit = Math.min(Math.max(opts.limit ?? 24, 1), 50);
  const cursorStr = opts.cursor ?? null;

  let rows: RawDesignRow[];

  if (sort === "popular") {
    const cur = cursorStr
      ? (decodeCursor(cursorStr) as PopularCursor | null)
      : null;
    if (
      cur &&
      typeof cur.forks === "number" &&
      typeof cur.views === "number" &&
      typeof cur.id === "string"
    ) {
      const res = await env.DB
        .prepare(
          `SELECT ${DESIGN_COLS}
           FROM designs
           WHERE forks < ?
              OR (forks = ? AND views < ?)
              OR (forks = ? AND views = ? AND id > ?)
           ORDER BY forks DESC, views DESC, id ASC
           LIMIT ?`,
        )
        .bind(cur.forks, cur.forks, cur.views, cur.forks, cur.views, cur.id, limit + 1)
        .all<RawDesignRow>();
      rows = res.results;
    } else {
      const res = await env.DB
        .prepare(
          `SELECT ${DESIGN_COLS}
           FROM designs
           ORDER BY forks DESC, views DESC, id ASC
           LIMIT ?`,
        )
        .bind(limit + 1)
        .all<RawDesignRow>();
      rows = res.results;
    }
  } else {
    const cur = cursorStr
      ? (decodeCursor(cursorStr) as RecentCursor | null)
      : null;
    if (cur && typeof cur.pub === "number" && typeof cur.id === "string") {
      const res = await env.DB
        .prepare(
          `SELECT ${DESIGN_COLS}
           FROM designs
           WHERE published_at < ?
              OR (published_at = ? AND id > ?)
           ORDER BY published_at DESC, id ASC
           LIMIT ?`,
        )
        .bind(cur.pub, cur.pub, cur.id, limit + 1)
        .all<RawDesignRow>();
      rows = res.results;
    } else {
      const res = await env.DB
        .prepare(
          `SELECT ${DESIGN_COLS}
           FROM designs
           ORDER BY published_at DESC, id ASC
           LIMIT ?`,
        )
        .bind(limit + 1)
        .all<RawDesignRow>();
      rows = res.results;
    }
  }

  let nextCursor: string | null = null;
  if (rows.length > limit) {
    const last = rows[limit - 1];
    if (last) {
      if (sort === "popular") {
        nextCursor = encodeCursor({
          forks: last.forks,
          views: last.views,
          id: last.id,
        } satisfies PopularCursor);
      } else {
        nextCursor = encodeCursor({
          pub: last.published_at,
          id: last.id,
        } satisfies RecentCursor);
      }
    }
    rows = rows.slice(0, limit);
  }

  const items: CommunityCardSummary[] = rows.map((r) => {
    const row = rowToDesignRow(r);
    return {
      id: row.id,
      design: row.design,
      slug: row.slug,
      name: row.name,
      author_name: row.author_name,
      description: row.description,
      forked_from: row.forked_from,
      published_at: row.published_at,
      views: row.views,
      forks: row.forks,
      installs: row.installs,
    };
  });

  return { items, nextCursor };
}

export async function listCommunitySitemapEntries(
  env: DbEnv,
): Promise<CommunitySitemapEntry[]> {
  const res = await env.DB
    .prepare(
      `SELECT slug, published_at
       FROM designs
       ORDER BY published_at DESC, id ASC`,
    )
    .all<CommunitySitemapEntry>();
  return res.results;
}

export async function getCommunitySeoBySlug(
  env: DbEnv,
  slug: string,
): Promise<CommunitySeoRow | null> {
  return (await env.DB
    .prepare(
      `SELECT slug, name, author_name, description, published_at, views, forks, installs
       FROM designs
       WHERE slug = ?`,
    )
    .bind(slug)
    .first()) as CommunitySeoRow | null;
}

export async function forkBump(
  env: DbEnv,
  slug: string,
): Promise<{ ok: true } | null> {
  const res = await env.DB
    .prepare("UPDATE designs SET forks = forks + 1 WHERE slug = ?")
    .bind(slug)
    .run();
  if (!res.meta || res.meta.changes === 0) return null;
  return { ok: true };
}

export async function incrementInstalls(
  env: DbEnv,
  id: string,
): Promise<void> {
  await env.DB
    .prepare("UPDATE designs SET installs = installs + 1 WHERE id = ?")
    .bind(id)
    .run();
}

export async function insertInstallRecord(
  env: DbEnv,
  design: Design,
): Promise<{ id: string }> {
  const id = nanoid(10);
  await env.DB
    .prepare(
      "INSERT INTO install_records (id, json, created_at) VALUES (?, ?, ?)",
    )
    .bind(id, JSON.stringify(design), Date.now())
    .run();
  return { id };
}

export async function getInstallTarget(
  env: DbEnv,
  id: string,
): Promise<{ design: Design; source: "designs" | "install_records" } | null> {
  const designRow = (await env.DB
    .prepare("SELECT json FROM designs WHERE id = ?")
    .bind(id)
    .first()) as { json: string } | null;
  if (designRow) {
    return { design: JSON.parse(designRow.json) as Design, source: "designs" };
  }
  const installRow = (await env.DB
    .prepare("SELECT json FROM install_records WHERE id = ?")
    .bind(id)
    .first()) as { json: string } | null;
  if (installRow) {
    return {
      design: JSON.parse(installRow.json) as Design,
      source: "install_records",
    };
  }
  return null;
}

export async function reapInstallRecords(
  env: DbEnv,
  olderThanMs?: number,
): Promise<{ deleted: number }> {
  const ttl = olderThanMs ?? 7 * 24 * 60 * 60 * 1000;
  const threshold = Date.now() - ttl;
  const res = await env.DB
    .prepare("DELETE FROM install_records WHERE created_at < ?")
    .bind(threshold)
    .run();
  return { deleted: res.meta?.changes ?? 0 };
}

export async function rollupViews(
  env: DbEnv,
  updates: Map<string, number>,
): Promise<void> {
  if (updates.size === 0) return;
  const stmts: D1PreparedStatement[] = [];
  for (const [slug, delta] of updates) {
    if (delta === 0) continue;
    stmts.push(
      env.DB
        .prepare("UPDATE designs SET views = views + ? WHERE slug = ?")
        .bind(delta, slug),
    );
  }
  if (stmts.length === 0) return;
  await env.DB.batch(stmts);
}
