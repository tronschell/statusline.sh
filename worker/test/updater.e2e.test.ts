/**
 * Real end-to-end for permanent links: the actual Worker (sqlite D1) behind a
 * real HTTP server, the real installer script piped into real bash, then the
 * installed script's background updater pulling a newer version.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync, utimesSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import worker, { registerRoutes, type Env } from "../src/index";
import { _clearRoutes } from "../src/router";
import { makeD1 } from "./helpers/d1";

const HAS_BASH = spawnSync("bash", ["--version"]).status === 0 && spawnSync("curl", ["--version"]).status === 0;

const design = (text: string) => ({
  version: 1,
  name: "Live",
  elements: [{ id: "e1", type: "static", text, style: {} }],
});

let server: ReturnType<typeof Bun.serve>;
let base = "";
let corrupt = false;
let home: string;
const ctx = { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext;

beforeAll(() => {
  _clearRoutes();
  registerRoutes();
  const env = { DB: makeD1(), ALLOWED_ORIGINS: "http://localhost:3001", TURNSTILE_SITE_KEY: "x", TURNSTILE_SECRET_KEY: "x", DEV_AUTH: "1" } as unknown as Env;
  server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch(req) {
      // A broken/hijacked update endpoint must never replace a working script.
      if (corrupt && new URL(req.url).pathname.startsWith("/u/")) return new Response("<html>oops</html>");
      return worker.fetch(req, env, ctx);
    },
  });
  base = `http://127.0.0.1:${server.port}`;
  home = mkdtempSync(join(tmpdir(), "sl-upd-"));
});
afterAll(() => {
  server.stop(true);
  rmSync(home, { recursive: true, force: true });
});

async function j(method: string, path: string, token?: string, body?: unknown) {
  const res = await fetch(base + path, {
    method,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return (await res.json()) as any;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn: () => boolean, ms = 6000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (fn()) return true;
    await sleep(100);
  }
  return fn();
}

describe.skipIf(!HAS_BASH)("permanent link: install, auto-update, safety", () => {
  test("install -> update on edit -> opt-out -> bad response ignored -> offline still renders", async () => {
    const { token } = await j("POST", "/auth/dev", undefined, { username: "e2e-user", pro: true });
    const created = await j("POST", "/library", token, { design: design("v1-text"), name: "Live" });
    const id = created.id as string;
    const claudeDir = join(home, ".claude");

    // Install exactly as a user would: fetch the script and run it.
    const installer = await (await fetch(`${base}/i/${id}.sh`)).text();
    writeFileSync(join(home, "install.sh"), installer);
    const inst = spawnSync("bash", [join(home, "install.sh")], { env: { ...process.env, CLAUDE_CONFIG_DIR: claudeDir }, encoding: "utf8" });
    expect(inst.status).toBe(0);

    const script = join(claudeDir, "statusline.sh");
    const stamp = `${script}.update-check`;
    const render = (extraEnv: Record<string, string> = {}) =>
      spawnSync("bash", [script], { input: "{}", env: { ...process.env, ...extraEnv }, encoding: "utf8", timeout: 20000 });
    const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");
    const age = () => utimesSync(stamp, new Date(0), new Date(0)); // pretend the last check was long ago

    expect(readFileSync(script, "utf8")).toContain("statusline.sh auto-update");
    let out = render();
    expect(out.status).toBe(0);
    expect(strip(out.stdout)).toContain("v1-text");

    // Rendering must not wait on the network: with the stamp fresh there is no check at all.
    expect(existsSync(stamp)).toBe(true);
    const t0 = Date.now();
    render();
    expect(Date.now() - t0).toBeLessThan(3000);

    // Edit on the server, force the check to be due, render (which kicks the background updater).
    await j("PUT", `/library/${id}`, token, { design: design("v2-text"), expected_version: 1 });
    age();
    render();
    expect(await waitFor(() => readFileSync(script, "utf8").includes("v2-text"))).toBe(true);
    expect(strip(render().stdout)).toContain("v2-text");
    expect(statSync(script).mode & 0o111).not.toBe(0); // still executable after the atomic swap
    expect(readFileSync(script, "utf8")).toContain("statusline.sh auto-update"); // and still self-updating

    // Opt-out is honoured.
    await j("PUT", `/library/${id}`, token, { design: design("v3-text"), expected_version: 2 });
    age();
    render({ STATUSLINE_NO_UPDATE: "1" });
    await sleep(1500);
    expect(readFileSync(script, "utf8")).not.toContain("v3-text");

    // A non-statusline response (captive portal, error page, hijack) is never installed.
    corrupt = true;
    age();
    render();
    await sleep(1500);
    expect(readFileSync(script, "utf8")).not.toContain("oops");
    expect(strip(render().stdout)).toContain("v2-text");
    corrupt = false;

    // Server unreachable: the statusline still renders and exits 0.
    server.stop(true);
    age();
    out = render();
    expect(out.status).toBe(0);
    expect(strip(out.stdout)).toContain("v2-text");
    // temp files from the updater don't pile up next to the script (let the background job finish)
    await sleep(1500);
    const leftovers = spawnSync("bash", ["-c", `ls ${claudeDir} | grep -c 'statusline.sh\\.[A-Za-z0-9]\\{6\\}$' || true`], { encoding: "utf8" });
    expect(leftovers.stdout.trim()).toBe("0");
  }, 60000);
});
