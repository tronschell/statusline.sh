/**
 * Cloud library: private, mutable, owner-scoped designs with permanent
 * (auto-updating) install links, version history, and publish-to-community.
 *
 * Team designs live in the same table (`team_id` set) and are reached through
 * the same endpoints; access is owner OR team member. Nothing in here is ever
 * returned by a public/SEO/community query.
 */

import { nanoid } from "nanoid";
import type { Design } from "@statusline/shared/types";
import { validateDesign, ValidationError } from "@statusline/shared/schema";
import { getUserById, isPro, requireUser, type UserRow } from "./auth";
import { PLAN, type AccountEnv } from "./env";
import { privateJson, readJson } from "./http";
import { publishDesign } from "./designs";
import { LIMITS, sanitizePublishField } from "./sanitize";

/**
 * Cloud ids are 12 chars; anonymous/published ids are 10. The installer uses
 * the length to skip the cloud lookup entirely for legacy ids, so requests for
 * pre-existing links never run any new SQL.
 */
export const CLOUD_ID_LENGTH = 12;

export interface CloudRow {
  id: string;
  owner_id: string;
  team_id: string | null;
  name: string;
  json: string;
  version: number;
  link_enabled: number;
  created_at: number;
  updated_at: number;
}

const CLOUD_COLS =
  "id, owner_id, team_id, name, json, version, link_enabled, created_at, updated_at";

function shape(r: CloudRow) {
  return {
    id: r.id,
    team_id: r.team_id,
    name: r.name,
    design: JSON.parse(r.json) as Design,
    version: r.version,
    link_enabled: r.link_enabled === 1,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

function proRequired(message: string): Response {
  return privateJson({ error: "pro_required", message }, 402);
}

function parseDesign(raw: unknown): Design | Response {
  try {
    return validateDesign(raw);
  } catch (e) {
    const detail = e instanceof ValidationError || e instanceof Error ? e.message : "invalid design";
    return privateJson({ error: "invalid design", detail }, 422);
  }
}

function cleanName(raw: unknown, fallback: string): string | Response {
  const r = sanitizePublishField(typeof raw === "string" && raw.trim() ? raw : fallback, {
    maxLength: LIMITS.name,
    multiline: false,
    allowEmpty: false,
  });
  return r.ok ? r.value : privateJson({ error: `name: ${r.reason}` }, 422);
}

/** Row plus whether `user` may see it (owner or team member). */
export async function getAccessibleDesign(
  env: AccountEnv,
  id: string,
  user: UserRow,
): Promise<CloudRow | null> {
  const row = (await env.DB
    .prepare(`SELECT ${CLOUD_COLS} FROM cloud_designs WHERE id = ?`)
    .bind(id)
    .first()) as CloudRow | null;
  if (!row) return null;
  if (row.owner_id === user.id) return row;
  if (row.team_id) {
    const m = await env.DB
      .prepare("SELECT 1 AS ok FROM team_members WHERE team_id = ? AND user_id = ?")
      .bind(row.team_id, user.id)
      .first();
    if (m) return row;
  }
  return null;
}

/**
 * Edits to a design whose link is live (personal permanent link or any team
 * design) require the *owner's* Pro. Reads and the already-published link keep
 * working when Pro lapses — a lapse must never break an installed statusline.
 */
async function writeBlocked(env: AccountEnv, row: CloudRow): Promise<Response | null> {
  if (!row.link_enabled && !row.team_id) return null;
  const owner = await getUserById(env, row.owner_id);
  if (owner && isPro(owner)) return null;
  return proRequired(
    row.team_id
      ? "The team owner's Pro plan has lapsed. Renew Pro to keep editing this team statusline."
      : "Renew Pro to keep editing a design with a permanent link, or turn the link off.",
  );
}

async function addVersion(
  env: AccountEnv,
  designId: string,
  version: number,
  json: string,
  authorId: string,
): Promise<void> {
  await env.DB
    .prepare(
      "INSERT INTO design_versions (design_id, version, json, author_id, created_at) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(designId, version, json, authorId, Date.now())
    .run();
  await env.DB
    .prepare("DELETE FROM design_versions WHERE design_id = ? AND version <= ?")
    .bind(designId, version - PLAN.versionsKept)
    .run();
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export async function handleListLibrary(req: Request, env: AccountEnv): Promise<Response> {
  const user = await requireUser(env, req);
  if (user instanceof Response) return user;
  const res = await env.DB
    .prepare(
      `SELECT ${CLOUD_COLS} FROM cloud_designs
       WHERE owner_id = ? AND team_id IS NULL
       ORDER BY updated_at DESC LIMIT ?`,
    )
    .bind(user.id, PLAN.proLibraryCap)
    .all<CloudRow>();
  const pro = isPro(user);
  return privateJson({
    items: res.results.map(shape),
    cap: pro ? PLAN.proLibraryCap : PLAN.freeLibraryCap,
    pro,
  });
}

export async function handleCreateLibrary(req: Request, env: AccountEnv): Promise<Response> {
  const user = await requireUser(env, req);
  if (user instanceof Response) return user;
  const body = await readJson(req);
  if (!body) return privateJson({ error: "invalid body" }, 400);

  const design = parseDesign(body.design);
  if (design instanceof Response) return design;
  const name = cleanName(body.name, design.name || "Untitled");
  if (name instanceof Response) return name;

  const pro = isPro(user);
  const cap = pro ? PLAN.proLibraryCap : PLAN.freeLibraryCap;
  const count = (await env.DB
    .prepare("SELECT COUNT(*) AS n FROM cloud_designs WHERE owner_id = ? AND team_id IS NULL")
    .bind(user.id)
    .first()) as { n: number } | null;
  if ((count?.n ?? 0) >= cap) {
    return pro
      ? privateJson({ error: "library_full", message: `Library limit is ${cap} designs.` }, 409)
      : proRequired(`Free accounts can save ${PLAN.freeLibraryCap} designs. Upgrade to Pro for more.`);
  }

  const id = nanoid(CLOUD_ID_LENGTH);
  const now = Date.now();
  const json = JSON.stringify({ ...design, name });
  await env.DB
    .prepare(
      `INSERT INTO cloud_designs (id, owner_id, name, json, version, link_enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?, ?)`,
    )
    // Pro members get their permanent link automatically.
    .bind(id, user.id, name, json, pro ? 1 : 0, now, now)
    .run();
  await addVersion(env, id, 1, json, user.id);
  const row = (await getAccessibleDesign(env, id, user))!;
  return privateJson(shape(row), 201);
}

export async function handleGetLibrary(
  req: Request,
  env: AccountEnv,
  id: string,
): Promise<Response> {
  const user = await requireUser(env, req);
  if (user instanceof Response) return user;
  const row = await getAccessibleDesign(env, id, user);
  if (!row) return privateJson({ error: "not found" }, 404);
  return privateJson(shape(row));
}

export async function handleUpdateLibrary(
  req: Request,
  env: AccountEnv,
  id: string,
): Promise<Response> {
  const user = await requireUser(env, req);
  if (user instanceof Response) return user;
  const row = await getAccessibleDesign(env, id, user);
  if (!row) return privateJson({ error: "not found" }, 404);
  const body = await readJson(req);
  if (!body) return privateJson({ error: "invalid body" }, 400);

  const blocked = await writeBlocked(env, row);
  if (blocked) return blocked;

  // Optimistic concurrency so two editors (or two tabs) don't silently
  // overwrite each other.
  if (body.expected_version !== undefined && body.expected_version !== row.version) {
    return privateJson(
      { error: "version_conflict", current_version: row.version, message: "Someone else saved a newer version." },
      409,
    );
  }

  const design = parseDesign(body.design);
  if (design instanceof Response) return design;
  const name = cleanName(body.name, row.name);
  if (name instanceof Response) return name;

  const next = row.version + 1;
  const json = JSON.stringify({ ...design, name });
  await env.DB
    .prepare(
      "UPDATE cloud_designs SET name = ?, json = ?, version = ?, updated_at = ? WHERE id = ?",
    )
    .bind(name, json, next, Date.now(), id)
    .run();
  await addVersion(env, id, next, json, user.id);
  const updated = (await getAccessibleDesign(env, id, user))!;
  return privateJson(shape(updated));
}

export async function handleDeleteLibrary(
  req: Request,
  env: AccountEnv,
  id: string,
): Promise<Response> {
  const user = await requireUser(env, req);
  if (user instanceof Response) return user;
  const row = await getAccessibleDesign(env, id, user);
  if (!row || row.owner_id !== user.id) return privateJson({ error: "not found" }, 404);
  // Team designs go away with their team; deleting one directly would orphan it.
  if (row.team_id) return privateJson({ error: "delete the team instead" }, 409);
  await env.DB.prepare("DELETE FROM cloud_designs WHERE id = ?").bind(id).run();
  return privateJson({ ok: true });
}

export async function handleSetLink(
  req: Request,
  env: AccountEnv,
  id: string,
): Promise<Response> {
  const user = await requireUser(env, req);
  if (user instanceof Response) return user;
  const row = await getAccessibleDesign(env, id, user);
  if (!row || row.owner_id !== user.id) return privateJson({ error: "not found" }, 404);
  if (row.team_id) return privateJson({ error: "team links are always on" }, 409);
  const body = await readJson(req);
  if (typeof body?.enabled !== "boolean") return privateJson({ error: "enabled must be boolean" }, 422);
  if (body.enabled && !isPro(user)) {
    return proRequired("Permanent auto-updating install links are part of Pro.");
  }
  await env.DB
    .prepare("UPDATE cloud_designs SET link_enabled = ? WHERE id = ?")
    .bind(body.enabled ? 1 : 0, id)
    .run();
  return privateJson(shape({ ...row, link_enabled: body.enabled ? 1 : 0 }));
}

export async function handleListVersions(
  req: Request,
  env: AccountEnv,
  id: string,
): Promise<Response> {
  const user = await requireUser(env, req);
  if (user instanceof Response) return user;
  const row = await getAccessibleDesign(env, id, user);
  if (!row) return privateJson({ error: "not found" }, 404);
  const res = await env.DB
    .prepare(
      `SELECT v.version, v.created_at, u.username AS author_username
       FROM design_versions v LEFT JOIN users u ON u.id = v.author_id
       WHERE v.design_id = ? ORDER BY v.version DESC LIMIT ?`,
    )
    .bind(id, PLAN.versionsKept)
    .all<{ version: number; created_at: number; author_username: string | null }>();
  return privateJson({ current: row.version, versions: res.results });
}

export async function handleRestoreVersion(
  req: Request,
  env: AccountEnv,
  id: string,
): Promise<Response> {
  const user = await requireUser(env, req);
  if (user instanceof Response) return user;
  const row = await getAccessibleDesign(env, id, user);
  if (!row) return privateJson({ error: "not found" }, 404);
  const body = await readJson(req);
  if (typeof body?.version !== "number") return privateJson({ error: "version required" }, 422);
  const blocked = await writeBlocked(env, row);
  if (blocked) return blocked;

  const old = (await env.DB
    .prepare("SELECT json FROM design_versions WHERE design_id = ? AND version = ?")
    .bind(id, body.version)
    .first()) as { json: string } | null;
  if (!old) return privateJson({ error: "version not found" }, 404);

  const next = row.version + 1;
  await env.DB
    .prepare("UPDATE cloud_designs SET json = ?, version = ?, updated_at = ? WHERE id = ?")
    .bind(old.json, next, Date.now(), id)
    .run();
  await addVersion(env, id, next, old.json, user.id);
  const updated = (await getAccessibleDesign(env, id, user))!;
  return privateJson(shape(updated));
}

export async function handlePublishFromLibrary(
  req: Request,
  env: AccountEnv,
  id: string,
): Promise<Response> {
  const user = await requireUser(env, req);
  if (user instanceof Response) return user;
  const row = await getAccessibleDesign(env, id, user);
  // Team designs are private to the team; only personal ones can go public.
  if (!row || row.owner_id !== user.id || row.team_id) {
    return privateJson({ error: "not found" }, 404);
  }
  const body = (await readJson(req)) ?? {};
  const name = cleanName(body.name, row.name);
  if (name instanceof Response) return name;
  const desc = sanitizePublishField(body.description ?? "", {
    maxLength: LIMITS.description,
    multiline: true,
    allowEmpty: true,
  });
  if (!desc.ok) return privateJson({ error: `description: ${desc.reason}` }, 422);

  const { id: designId, slug } = await publishDesign(env, {
    design: JSON.parse(row.json) as Design,
    name,
    author_name: user.display_name.slice(0, LIMITS.author),
    description: desc.value,
    owner_id: user.id,
  });
  return privateJson({ id: designId, slug });
}
