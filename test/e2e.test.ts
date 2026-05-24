import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { serve } from "bun";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir, platform } from "node:os";
import { join } from "node:path";
import { resetDbForTests, setDbPathForTests } from "../src/server/db";
import { routes } from "../src/server/routes";
import type { Design } from "../src/shared/types";

const FIXTURE: Design = {
  version: 1,
  name: "E2E Statusline",
  elements: [
    { id: "1", type: "model", style: { bold: true, fg: { kind: "ansi16", index: 12 } } },
    { id: "2", type: "separator", text: " | ", style: {} },
    { id: "3", type: "cwd", mode: "basename", style: { fg: { kind: "ansi16", index: 14 } } },
    {
      id: "4",
      type: "contextBar",
      width: 10,
      filledChar: "#",
      emptyChar: ".",
      style: { fg: { kind: "ansi16", index: 10 } },
    },
  ],
};

let server: ReturnType<typeof serve>;
let base: string;

beforeAll(() => {
  setDbPathForTests(":memory:");
  server = serve({
    port: 0,
    routes,
    development: false,
    fetch() {
      return new Response("nf", { status: 404 });
    },
  });
  base = `http://localhost:${server.port}`;
});

afterAll(() => {
  server.stop(true);
  resetDbForTests();
});

beforeEach(() => {
  setDbPathForTests(":memory:");
});

const HAS_BASH = (() => {
  try {
    return spawnSync("bash", ["--version"], { encoding: "utf8" }).status === 0;
  } catch {
    return false;
  }
})();

async function postDesign(d: Design): Promise<string> {
  const res = await fetch(`${base}/api/designs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(d),
  });
  if (!res.ok) throw new Error(`POST failed: ${res.status}`);
  const { id } = (await res.json()) as { id: string };
  return id;
}

describe("E2E install flow (bash)", () => {
  test.skipIf(!HAS_BASH)("end-to-end: design → install → statusline executes", async () => {
    const id = await postDesign(FIXTURE);

    // Fetch the install script
    const installRes = await fetch(`${base}/i/${id}.sh`);
    expect(installRes.status).toBe(200);
    const installer = await installRes.text();

    // Prepare a clean temp HOME
    const tempHome = mkdtempSync(join(tmpdir(), "sl-home-"));
    const installerPath = join(tempHome, "installer.sh");
    await Bun.write(installerPath, installer);

    // Pre-populate settings.json with an existing key to verify preservation
    const claudeDir = join(tempHome, ".claude");
    await Bun.write(
      join(claudeDir, "settings.json"),
      JSON.stringify({ model: "claude-opus-4-7", existing: "preserved" }),
    );

    // Run the installer against the temp HOME
    const result = spawnSync("bash", [installerPath], {
      env: { ...process.env, CLAUDE_CONFIG_DIR: join(tempHome, ".claude") },
      encoding: "utf8",
    });
    if (result.status !== 0 || result.stderr) {
      console.error("INSTALLER STDOUT:", result.stdout);
      console.error("INSTALLER STDERR:", result.stderr);
      console.error("INSTALLER STATUS:", result.status);
    }
    expect(result.status).toBe(0);

    // statusline.sh exists
    const statuslinePath = join(claudeDir, "statusline.sh");
    const slContent = readFileSync(statuslinePath, "utf8");
    expect(slContent).toContain("#!/usr/bin/env bash");
    expect(slContent).toContain("__field");
    // On non-Windows: chmod +x set
    if (platform() !== "win32") {
      const mode = statSync(statuslinePath).mode;
      expect((mode & 0o111) !== 0).toBe(true);
    }

    // settings.json updated, existing keys preserved
    const settings = JSON.parse(
      readFileSync(join(claudeDir, "settings.json"), "utf8"),
    );
    expect(settings.model).toBe("claude-opus-4-7");
    expect(settings.existing).toBe("preserved");
    expect(settings.statusLine).toBeDefined();
    expect(settings.statusLine.type).toBe("command");
    expect(settings.statusLine.command).toContain("statusline.sh");

    // A timestamped backup of settings exists
    const { readdirSync } = await import("node:fs");
    const backups = readdirSync(claudeDir).filter((f) =>
      f.startsWith("settings.json.bak."),
    );
    expect(backups.length).toBeGreaterThan(0);

    // Finally: run the statusline against a mock stdin and verify it produces output
    const mockStdin = JSON.stringify({
      model: { display_name: "Opus 4.7" },
      workspace: { current_dir: "/Users/dev/projects/statusline-maker" },
      context_window: { used_percentage: 30 },
    });
    const slResult = spawnSync("bash", [statuslinePath], {
      input: mockStdin,
      env: { ...process.env, CLAUDE_CONFIG_DIR: join(tempHome, ".claude") },
      encoding: "utf8",
    });
    expect(slResult.status).toBe(0);
    // strip ANSI for assertion
    const stripped = slResult.stdout.replace(/\x1b\[[0-9;]*m/g, "");
    expect(stripped).toContain("Opus 4.7");
    expect(stripped).toContain("statusline-maker");
    expect(stripped).toContain("###");
  });

  test.skipIf(!HAS_BASH)("installer creates settings.json from nothing if missing", async () => {
    const id = await postDesign(FIXTURE);
    const installer = await (await fetch(`${base}/i/${id}.sh`)).text();

    const tempHome = mkdtempSync(join(tmpdir(), "sl-home-empty-"));
    const installerPath = join(tempHome, "installer.sh");
    await Bun.write(installerPath, installer);

    const result = spawnSync("bash", [installerPath], {
      env: { ...process.env, CLAUDE_CONFIG_DIR: join(tempHome, ".claude") },
      encoding: "utf8",
    });
    expect(result.status).toBe(0);

    const settings = JSON.parse(
      readFileSync(join(tempHome, ".claude", "settings.json"), "utf8"),
    );
    expect(settings.statusLine).toBeDefined();
  });
});
