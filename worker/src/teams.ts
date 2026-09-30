/**
 * Team statuslines: one shared, versioned design per team, installed by every
 * member (or anyone the owner shares the link with) through a permanent,
 * auto-updating link.
 *
 * Model: the owner must be Pro (checked at creation and on every edit, see
 * library.writeBlocked). Members join free by opening an invite link — no Pro
 * needed to *use* or edit a team's design. The design itself is a `cloud_designs`
 * row with `team_id` set, edited through the /library endpoints.
 */

import { nanoid } from "nanoid";
import { validateDesign, ValidationError } from "@statusline/shared/schema";
import { isPro, randomToken, requireUser, type UserRow } from "./auth";
import { PLAN, type AccountEnv } from "./env";
import { privateJson, readJson } from "./http";
import { CLOUD_ID_LENGTH } from "./library";
import { LIMITS, sanitizePublishField } from "./sanitize";

interface TeamRow {
  id: string;
  name: string;
  owner_id: string;
  invite_token: string;
  created_at: number;
}

async function getMemberTeam(
  env: AccountEnv,
  teamId: string,
  user: UserRow,
): Promise<(TeamRow & { role: string }) | null> {
  return (await env.DB
    .prepare(
      `SELECT t.id, t.name, t.owner_id, t.invite_token, t.created_at, m.role
       FROM teams t JOIN team_members m ON m.team_id = t.id
       WHERE t.id = ? AND m.user_id = ?`,
    )
    .bind(teamId, user.id)
    .first()) as (TeamRow & { role: string }) | null;
}

async function teamPayload(env: AccountEnv, team: TeamRow, role: string, viewer: UserRow) {
  const design = (await env.DB
    .prepare("SELECT id, version, updated_at FROM cloud_designs WHERE team_id = ?")
    .bind(team.id)
    .first()) as { id: string; version: number; updated_at: number } | null;
  const members = await env.DB
    .prepare(
      `SELECT u.id, u.username, u.display_name, u.avatar_url, m.role, m.joined_at
       FROM team_members m JOIN users u ON u.id = m.user_id
       WHERE m.team_id = ? ORDER BY m.joined_at ASC`,
    )
    .bind(team.id)
    .all();
  const owner = role === "owner";
  return {
    id: team.id,
    name: team.name,
    role,
    owner_id: team.owner_id,
    created_at: team.created_at,
    design,
    members: members.results,
    // Only the owner can invite; only Pro owners can keep the team editable.
    invite_token: owner ? team.invite_token : null,
    owner_pro: owner ? isPro(viewer) : undefined,
  };
}

export async function handleListTeams(req: Request, env: AccountEnv): Promise<Response> {
  const user = await requireUser(env, req);
  if (user instanceof Response) return user;
  const res = await env.DB
    .prepare(
      `SELECT t.id, t.name, t.owner_id, t.invite_token, t.created_at, m.role,
              d.id AS design_id
       FROM teams t
       JOIN team_members m ON m.team_id = t.id
       LEFT JOIN cloud_designs d ON d.team_id = t.id
       WHERE m.user_id = ? ORDER BY t.created_at DESC`,
    )
    .bind(user.id)
    .all<TeamRow & { role: string; design_id: string | null }>();
  return privateJson({
    teams: res.results.map((t) => ({
      id: t.id,
      name: t.name,
      role: t.role,
      design_id: t.design_id,
      created_at: t.created_at,
    })),
  });
}

export async function handleCreateTeam(req: Request, env: AccountEnv): Promise<Response> {
  const user = await requireUser(env, req);
  if (user instanceof Response) return user;
  if (!isPro(user)) {
    return privateJson(
      { error: "pro_required", message: "Creating a team statusline requires Pro." },
      402,
    );
  }
  const body = await readJson(req);
  if (!body) return privateJson({ error: "invalid body" }, 400);

  const nameRes = sanitizePublishField(body.name ?? "", {
    maxLength: LIMITS.name,
    multiline: false,
    allowEmpty: false,
  });
  if (!nameRes.ok) return privateJson({ error: `name: ${nameRes.reason}` }, 422);

  let design;
  try {
    design = validateDesign(body.design);
  } catch (e) {
    const detail = e instanceof ValidationError || e instanceof Error ? e.message : "invalid design";
    return privateJson({ error: "invalid design", detail }, 422);
  }

  const owned = (await env.DB
    .prepare("SELECT COUNT(*) AS n FROM teams WHERE owner_id = ?")
    .bind(user.id)
    .first()) as { n: number } | null;
  if ((owned?.n ?? 0) >= PLAN.teamCap) {
    return privateJson({ error: "team_limit", message: `You can own up to ${PLAN.teamCap} teams.` }, 409);
  }

  const teamId = nanoid(12);
  const designId = nanoid(CLOUD_ID_LENGTH);
  const now = Date.now();
  const json = JSON.stringify({ ...design, name: nameRes.value });
  // One atomic batch so a team never exists without its design/owner row.
  await env.DB.batch([
    env.DB
      .prepare(
        "INSERT INTO teams (id, name, owner_id, invite_token, created_at) VALUES (?, ?, ?, ?, ?)",
      )
      .bind(teamId, nameRes.value, user.id, randomToken(18), now),
    env.DB
      .prepare(
        "INSERT INTO team_members (team_id, user_id, role, joined_at) VALUES (?, ?, 'owner', ?)",
      )
      .bind(teamId, user.id, now),
    env.DB
      .prepare(
        `INSERT INTO cloud_designs (id, owner_id, team_id, name, json, version, link_enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, 1, ?, ?)`,
      )
      .bind(designId, user.id, teamId, nameRes.value, json, now, now),
    env.DB
      .prepare(
        "INSERT INTO design_versions (design_id, version, json, author_id, created_at) VALUES (?, 1, ?, ?, ?)",
      )
      .bind(designId, json, user.id, now),
  ]);
  const team = (await getMemberTeam(env, teamId, user))!;
  return privateJson(await teamPayload(env, team, "owner", user), 201);
}

export async function handleGetTeam(
  req: Request,
  env: AccountEnv,
  teamId: string,
): Promise<Response> {
  const user = await requireUser(env, req);
  if (user instanceof Response) return user;
  const team = await getMemberTeam(env, teamId, user);
  if (!team) return privateJson({ error: "not found" }, 404);
  return privateJson(await teamPayload(env, team, team.role, user));
}

export async function handleJoinTeam(req: Request, env: AccountEnv): Promise<Response> {
  const user = await requireUser(env, req);
  if (user instanceof Response) return user;
  const body = await readJson(req);
  const token = typeof body?.token === "string" ? body.token : "";
  const team = token
    ? ((await env.DB
        .prepare("SELECT id, name, owner_id, invite_token, created_at FROM teams WHERE invite_token = ?")
        .bind(token)
        .first()) as TeamRow | null)
    : null;
  if (!team) return privateJson({ error: "invalid or expired invite" }, 404);

  const already = await getMemberTeam(env, team.id, user);
  if (already) return privateJson({ team_id: team.id, already_member: true });

  const count = (await env.DB
    .prepare("SELECT COUNT(*) AS n FROM team_members WHERE team_id = ?")
    .bind(team.id)
    .first()) as { n: number } | null;
  if ((count?.n ?? 0) >= PLAN.teamMemberCap) {
    return privateJson({ error: "team_full", message: "This team is full." }, 409);
  }
  await env.DB
    .prepare("INSERT INTO team_members (team_id, user_id, role, joined_at) VALUES (?, ?, 'editor', ?)")
    .bind(team.id, user.id, Date.now())
    .run();
  return privateJson({ team_id: team.id, already_member: false });
}

export async function handleRotateInvite(
  req: Request,
  env: AccountEnv,
  teamId: string,
): Promise<Response> {
  const user = await requireUser(env, req);
  if (user instanceof Response) return user;
  const team = await getMemberTeam(env, teamId, user);
  if (!team || team.owner_id !== user.id) return privateJson({ error: "not found" }, 404);
  const token = randomToken(18);
  await env.DB.prepare("UPDATE teams SET invite_token = ? WHERE id = ?").bind(token, teamId).run();
  return privateJson({ invite_token: token });
}

export async function handleRemoveMember(
  req: Request,
  env: AccountEnv,
  teamId: string,
  memberId: string,
): Promise<Response> {
  const user = await requireUser(env, req);
  if (user instanceof Response) return user;
  const team = await getMemberTeam(env, teamId, user);
  if (!team) return privateJson({ error: "not found" }, 404);
  // Owners can remove anyone but themselves; members can remove only themselves (leave).
  const isOwner = team.owner_id === user.id;
  if (memberId === team.owner_id) {
    return privateJson({ error: "the owner can't leave; delete the team instead" }, 409);
  }
  if (!isOwner && memberId !== user.id) return privateJson({ error: "not found" }, 404);
  await env.DB
    .prepare("DELETE FROM team_members WHERE team_id = ? AND user_id = ?")
    .bind(teamId, memberId)
    .run();
  return privateJson({ ok: true });
}

export async function handleDeleteTeam(
  req: Request,
  env: AccountEnv,
  teamId: string,
): Promise<Response> {
  const user = await requireUser(env, req);
  if (user instanceof Response) return user;
  const team = await getMemberTeam(env, teamId, user);
  if (!team || team.owner_id !== user.id) return privateJson({ error: "not found" }, 404);
  // FK cascades remove members, the team design and its versions.
  await env.DB.prepare("DELETE FROM teams WHERE id = ?").bind(teamId).run();
  return privateJson({ ok: true });
}
