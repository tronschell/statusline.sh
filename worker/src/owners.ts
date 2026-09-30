/**
 * Owner-derived community features: verified badge, featured slots, donation
 * link, "my published designs".
 *
 * "Verified" and "featured" are computed from the owner's *live* entitlement
 * (`users.pro_until`) at read time, never stored, so they disappear the moment
 * a subscription lapses.
 *
 * Enrichment is a separate, failure-tolerant query on purpose: the community
 * list/detail endpoints keep their exact existing SQL and response shape, and
 * if this query fails (e.g. the accounts migration isn't applied yet) they
 * degrade to today's behaviour instead of erroring.
 */

import type { Design } from "@statusline/shared/types";
import { requireUser, validateUsername } from "./auth";
import { PLAN, type AccountEnv } from "./env";
import { jsonResponse, privateJson, readJson } from "./http";
import type { CommunityCardSummary, DbEnv } from "./designs";

export interface OwnerInfo {
  username: string;
  display_name: string;
  avatar_url: string;
  verified: boolean;
  donation_url: string | null;
}

interface OwnerRow {
  id: string;
  featured_at: number | null;
  username: string;
  display_name: string;
  avatar_url: string;
  donation_url: string | null;
  pro_until: number;
}

export type WithOwner<T> = T & { owner?: OwnerInfo; featured?: boolean };

export async function attachOwners<T extends { id: string }>(
  env: DbEnv,
  items: T[],
): Promise<WithOwner<T>[]> {
  if (items.length === 0) return items;
  try {
    const marks = items.map(() => "?").join(",");
    const res = await env.DB
      .prepare(
        `SELECT d.id, d.featured_at, u.username, u.display_name, u.avatar_url, u.donation_url, u.pro_until
         FROM designs d JOIN users u ON u.id = d.owner_id
         WHERE d.id IN (${marks})`,
      )
      .bind(...items.map((i) => i.id))
      .all<OwnerRow>();
    if (!res.results || res.results.length === 0) return items;
    const byId = new Map(res.results.map((r) => [r.id, r]));
    const now = Date.now();
    return items.map((item) => {
      const r = byId.get(item.id);
      if (!r) return item;
      const verified = r.pro_until > now;
      const out: WithOwner<T> = {
        ...item,
        owner: {
          username: r.username,
          display_name: r.display_name,
          avatar_url: r.avatar_url,
          verified,
          donation_url: r.donation_url,
        },
      };
      if (verified && r.featured_at !== null) out.featured = true;
      return out;
    });
  } catch (e) {
    console.warn("owner enrichment skipped", e);
    return items;
  }
}

const FEATURED_LIMIT = 6;

interface FeaturedRaw {
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

/** Featured designs of currently-Pro owners, newest feature first. */
export async function listFeatured(env: DbEnv): Promise<WithOwner<CommunityCardSummary>[]> {
  const res = await env.DB
    .prepare(
      `SELECT d.id, d.json, d.slug, d.name, d.author_name, d.description, d.forked_from,
              d.published_at, d.views, d.forks, d.installs
       FROM designs d JOIN users u ON u.id = d.owner_id
       WHERE d.featured_at IS NOT NULL AND u.pro_until > ?
       ORDER BY d.featured_at DESC, d.id ASC
       LIMIT ?`,
    )
    .bind(Date.now(), FEATURED_LIMIT)
    .all<FeaturedRaw>();
  return attachOwners(env, res.results.map(toCard));
}

function toCard(r: FeaturedRaw): CommunityCardSummary {
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

/** Public profile: `GET /users/:username` — the @handle page on the community. */
export async function handlePublicProfile(env: DbEnv, rawName: string): Promise<Response> {
  const name = validateUsername(rawName);
  if (!name.ok) return jsonResponse({ error: "not found" }, 404);
  const u = (await env.DB
    .prepare(
      `SELECT id, username, display_name, avatar_url, donation_url, pro_until, created_at
       FROM users WHERE username = ?`,
    )
    .bind(name.value)
    .first()) as {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string;
    donation_url: string | null;
    pro_until: number;
    created_at: number;
  } | null;
  if (!u) return jsonResponse({ error: "not found" }, 404);
  const res = await env.DB
    .prepare(
      `SELECT id, json, slug, name, author_name, description, forked_from, published_at, views, forks, installs
       FROM designs WHERE owner_id = ? ORDER BY published_at DESC, id ASC LIMIT 48`,
    )
    .bind(u.id)
    .all<FeaturedRaw>();
  return jsonResponse(
    {
      user: {
        username: u.username,
        display_name: u.display_name,
        avatar_url: u.avatar_url,
        donation_url: u.donation_url,
        verified: u.pro_until > Date.now(),
        joined_at: u.created_at,
      },
      designs: await attachOwners(env, res.results.map(toCard)),
    },
    200,
    { "cache-control": "public, s-maxage=60" },
  );
}

export async function handleMyDesigns(req: Request, env: AccountEnv): Promise<Response> {
  const user = await requireUser(env, req);
  if (user instanceof Response) return user;
  const res = await env.DB
    .prepare(
      `SELECT id, slug, name, published_at, views, forks, installs, featured_at
       FROM designs WHERE owner_id = ? ORDER BY published_at DESC LIMIT 100`,
    )
    .bind(user.id)
    .all<{
      id: string;
      slug: string;
      name: string;
      published_at: number;
      views: number;
      forks: number;
      installs: number;
      featured_at: number | null;
    }>();
  const featuredCount = res.results.filter((r) => r.featured_at !== null).length;
  return privateJson({
    items: res.results.map(({ featured_at, ...rest }) => ({ ...rest, featured: featured_at !== null })),
    featured_count: featuredCount,
    featured_cap: PLAN.featuredCap,
  });
}

export async function handleSetFeatured(
  req: Request,
  env: AccountEnv,
  designId: string,
): Promise<Response> {
  const user = await requireUser(env, req);
  if (user instanceof Response) return user;
  const body = await readJson(req);
  if (typeof body?.featured !== "boolean") {
    return privateJson({ error: "featured must be boolean" }, 422);
  }
  const row = (await env.DB
    .prepare("SELECT id, featured_at FROM designs WHERE id = ? AND owner_id = ?")
    .bind(designId, user.id)
    .first()) as { id: string; featured_at: number | null } | null;
  if (!row) return privateJson({ error: "not found" }, 404);

  if (!body.featured) {
    await env.DB.prepare("UPDATE designs SET featured_at = NULL WHERE id = ?").bind(designId).run();
    return privateJson({ ok: true, featured: false });
  }
  if (user.pro_until <= Date.now()) {
    return privateJson(
      { error: "pro_required", message: "Featured slots are part of Pro." },
      402,
    );
  }
  if (row.featured_at === null) {
    const n = (await env.DB
      .prepare("SELECT COUNT(*) AS n FROM designs WHERE owner_id = ? AND featured_at IS NOT NULL")
      .bind(user.id)
      .first()) as { n: number } | null;
    if ((n?.n ?? 0) >= PLAN.featuredCap) {
      return privateJson(
        { error: "featured_limit", message: `You can feature up to ${PLAN.featuredCap} designs.` },
        409,
      );
    }
    await env.DB.prepare("UPDATE designs SET featured_at = ? WHERE id = ?").bind(Date.now(), designId).run();
  }
  return privateJson({ ok: true, featured: true });
}
