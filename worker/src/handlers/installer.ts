import type { Design } from "@statusline/shared/types";
import { compileToBash } from "@statusline/shared/compiler/bash";
import { compileToPS } from "@statusline/shared/compiler/powershell";
import { bashInstallerTemplate } from "../install/bashTemplate";
import { psInstallerTemplate } from "../install/psTemplate";
import { getInstallTarget, incrementInstalls, type DbEnv } from "../designs";

export type InstallerEnv = DbEnv;

/**
 * Pure render step — no DB. The compiled-and-templated installer body for a
 * given Design + extension. Split out so tests can exercise the template
 * wiring without stubbing D1.
 *
 * Note: the underlying templates don't currently accept any options — the
 * `STATUSLINE_SELFHEAL=1` opt-in is read at install-time from the user's
 * env, not at template-generation time. The `selfheal` query param is
 * therefore accepted (for forward-compat / parity with the request shape)
 * but does not change the rendered output today.
 */
export function renderInstaller(
  _req: Request,
  design: Design,
  ext: string,
): Response | null {
  if (ext === "ps1") {
    const compiled = compileToPS(design);
    const body = psInstallerTemplate(compiled);
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "public, max-age=3600",
      },
    });
  }
  if (ext === "sh") {
    const compiled = compileToBash(design);
    const body = bashInstallerTemplate(compiled);
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "text/x-shellscript; charset=utf-8",
        "cache-control": "public, max-age=3600",
      },
    });
  }
  return null;
}

export async function handleInstaller(
  req: Request,
  env: InstallerEnv,
  ctx: ExecutionContext,
  params: { id: string; ext: string },
): Promise<Response> {
  const target = await getInstallTarget(env, params.id);
  if (!target) {
    return new Response("not found", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  const res = renderInstaller(req, target.design, params.ext);
  if (!res) {
    return new Response("unknown installer extension", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  // Bump the per-design install counter for published community designs only.
  // Anonymous one-time drafts in `install_records` get no counter (they're
  // ephemeral). `?preview=1` opts out — the InstallDrawer inspector uses it
  // when fetching the script body for display so opening the inspector
  // doesn't inflate install counts.
  if (target.source === "designs") {
    const url = new URL(req.url);
    if (url.searchParams.get("preview") !== "1") {
      ctx.waitUntil(
        incrementInstalls(env, params.id).catch((e) => {
          console.warn("installs increment failed", e);
        }),
      );
    }
  }

  return res;
}
