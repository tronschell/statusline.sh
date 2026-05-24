import type { BunRequest } from "bun";
import { compileToBash } from "../compiler/bash";
import { compileToPS } from "../compiler/powershell";
import { ValidationError } from "../shared/schema";
import {
  forkDesign,
  getCommunityBySlug,
  getDesignById,
  insertDesign,
  listCommunity,
  publishDesign,
  unpublishDesign,
  updateDesignJson,
  type DesignRow,
} from "./designs";
import { bashInstallerTemplate } from "./install/bashTemplate";
import { psInstallerTemplate } from "./install/psTemplate";
import { LIMITS, sanitizePublishField } from "./sanitize";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function notFound(message = "not found"): Response {
  return json({ error: message }, 404);
}

function badRequest(message: string, path?: string): Response {
  return json({ error: message, path }, 400);
}

async function readJson(req: Request): Promise<unknown> {
  const text = await req.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new SyntaxError(`invalid JSON body: ${(e as Error).message}`);
  }
}

function rowToPublicDesign(r: DesignRow) {
  return {
    id: r.id,
    design: r.design,
    created_at: r.created_at,
    updated_at: r.updated_at,
    views: r.views,
    is_public: r.is_public,
    slug: r.slug,
    author_name: r.author_name,
    description: r.description,
    forks: r.forks,
    forked_from: r.forked_from,
    published_at: r.published_at,
  };
}

async function loadTemplates(): Promise<unknown> {
  try {
    const mod = (await import("../shared/templates.ts")) as {
      TEMPLATES?: unknown;
      default?: unknown;
    };
    return mod.TEMPLATES ?? mod.default ?? [];
  } catch {
    return [];
  }
}

export const routes = {
  "/api/designs": {
    async POST(req: BunRequest) {
      try {
        const body = await readJson(req);
        const { id } = insertDesign(body);
        return json({ id }, 201);
      } catch (e) {
        if (e instanceof ValidationError) {
          return badRequest(e.message, e.path);
        }
        if (e instanceof SyntaxError) return badRequest(e.message);
        throw e;
      }
    },
  },

  "/api/designs/:id": {
    async GET(req: BunRequest<"/api/designs/:id">) {
      const row = getDesignById(req.params.id, true);
      if (!row) return notFound("design not found");
      return json(rowToPublicDesign(row));
    },
    async PUT(req: BunRequest<"/api/designs/:id">) {
      try {
        const body = await readJson(req);
        const ok = updateDesignJson(req.params.id, body);
        if (!ok) return notFound("design not found");
        return json({ ok: true });
      } catch (e) {
        if (e instanceof ValidationError) {
          return badRequest(e.message, e.path);
        }
        if (e instanceof SyntaxError) return badRequest(e.message);
        throw e;
      }
    },
  },

  "/api/designs/:id/publish": {
    async POST(req: BunRequest<"/api/designs/:id/publish">) {
      try {
        const body = (await readJson(req)) as {
          author_name?: unknown;
          description?: unknown;
          name?: unknown;
        };
        if (
          typeof body.author_name !== "string" ||
          typeof body.description !== "string" ||
          typeof body.name !== "string"
        ) {
          return badRequest("author_name, description, name required as strings");
        }

        const name = sanitizePublishField(body.name, {
          maxLength: LIMITS.name,
        });
        if (!name.ok) return badRequest(`name: ${name.reason}`, "name");

        const author = sanitizePublishField(body.author_name, {
          maxLength: LIMITS.author,
        });
        if (!author.ok)
          return badRequest(`author_name: ${author.reason}`, "author_name");

        const description = sanitizePublishField(body.description, {
          maxLength: LIMITS.description,
          multiline: true,
          allowEmpty: true,
        });
        if (!description.ok)
          return badRequest(`description: ${description.reason}`, "description");

        const res = publishDesign(req.params.id, {
          author_name: author.value,
          description: description.value,
          name: name.value,
        });
        if (!res) return notFound("design not found");
        return json(res);
      } catch (e) {
        if (e instanceof SyntaxError) return badRequest(e.message);
        throw e;
      }
    },
  },

  "/api/designs/:id/unpublish": {
    async POST(req: BunRequest<"/api/designs/:id/unpublish">) {
      const ok = unpublishDesign(req.params.id);
      if (!ok) return notFound("design not found");
      return json({ ok: true });
    },
  },

  "/api/designs/:id/fork": {
    async POST(req: BunRequest<"/api/designs/:id/fork">) {
      const res = forkDesign(req.params.id);
      if (!res) return notFound("design not found");
      return json(res, 201);
    },
  },

  "/api/community": {
    async GET(req: BunRequest) {
      const url = new URL(req.url);
      const sortRaw = url.searchParams.get("sort");
      const sort: "recent" | "popular" =
        sortRaw === "popular" ? "popular" : "recent";
      const limitRaw = url.searchParams.get("limit");
      const limit = limitRaw ? parseInt(limitRaw, 10) : 24;
      const cursor = url.searchParams.get("cursor");
      const result = listCommunity({
        sort,
        limit: Number.isFinite(limit) ? limit : 24,
        cursor,
      });
      return json(result);
    },
  },

  "/api/community/:slug": {
    async GET(req: BunRequest<"/api/community/:slug">) {
      const row = getCommunityBySlug(req.params.slug);
      if (!row) return notFound("community design not found");
      return json(rowToPublicDesign(row));
    },
  },

  "/api/templates": {
    async GET(_req: BunRequest) {
      const templates = await loadTemplates();
      return json(templates);
    },
  },

  "/i/:file": {
    async GET(req: BunRequest<"/i/:file">) {
      const file = req.params.file;
      const shMatch = /^([A-Za-z0-9_-]+)\.sh$/.exec(file);
      const psMatch = /^([A-Za-z0-9_-]+)\.ps1$/.exec(file);
      if (shMatch) {
        const row = getDesignById(shMatch[1]!, false);
        if (!row) return notFound("design not found");
        const installer = bashInstallerTemplate(compileToBash(row.design));
        return new Response(installer, {
          status: 200,
          headers: { "content-type": "text/x-shellscript; charset=utf-8" },
        });
      }
      if (psMatch) {
        const row = getDesignById(psMatch[1]!, false);
        if (!row) return notFound("design not found");
        const installer = psInstallerTemplate(compileToPS(row.design));
        return new Response(installer, {
          status: 200,
          headers: { "content-type": "text/plain; charset=utf-8" },
        });
      }
      return notFound("unknown installer file");
    },
  },
} as const;

export type Routes = typeof routes;
