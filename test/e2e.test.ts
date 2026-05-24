import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir, platform } from "node:os";
import { join } from "node:path";
// Import the pure template + compiler pieces directly rather than the handler
// (`renderInstaller`), because the handler module transitively imports
// `worker/src/designs.ts`, which references D1 globals from
// `@cloudflare/workers-types`. The root tsconfig doesn't include those types,
// so dragging the handler in would surface bogus typecheck errors. The
// composition below is byte-equivalent to `renderInstaller(req, design, "sh")`.
import { bashInstallerTemplate } from "../worker/src/install/bashTemplate";
import { compileToBash } from "@statusline/shared/compiler/bash";
import type { Design } from "@statusline/shared/types";

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

const HAS_BASH = (() => {
  try {
    return spawnSync("bash", ["--version"], { encoding: "utf8" }).status === 0;
  } catch {
    return false;
  }
})();

function renderBashInstaller(design: Design): string {
  // Direct-handler path — no Worker spin-up, no D1. The installer template is
  // pure (compile + interpolate), so feeding it a Design produces the same
  // bytes the Worker would serve from /i/:id.sh.
  return bashInstallerTemplate(compileToBash(design));
}

let tempHome: string;
beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), "sl-home-"));
});
afterEach(() => {
  try {
    rmSync(tempHome, { recursive: true, force: true });
  } catch {
    // best-effort cleanup
  }
});

describe("E2E install flow (bash)", () => {
  test.skipIf(!HAS_BASH)("end-to-end: design → install → statusline executes", async () => {
    const installer = renderBashInstaller(FIXTURE);
    expect(installer.length).toBeGreaterThan(100);
    expect(installer).toContain("#!/usr/bin/env bash");

    const installerPath = join(tempHome, "installer.sh");
    writeFileSync(installerPath, installer);

    // Pre-populate settings.json with an existing key to verify preservation
    const claudeDir = join(tempHome, ".claude");
    mkdirSync(claudeDir, { recursive: true });
    writeFileSync(
      join(claudeDir, "settings.json"),
      JSON.stringify({ model: "claude-opus-4-7", existing: "preserved" }),
    );

    // Run the installer against the temp HOME
    const result = spawnSync("bash", [installerPath], {
      env: { ...process.env, CLAUDE_CONFIG_DIR: claudeDir },
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
      env: { ...process.env, CLAUDE_CONFIG_DIR: claudeDir },
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
    const installer = renderBashInstaller(FIXTURE);

    const installerPath = join(tempHome, "installer.sh");
    writeFileSync(installerPath, installer);

    const claudeDir = join(tempHome, ".claude");
    const result = spawnSync("bash", [installerPath], {
      env: { ...process.env, CLAUDE_CONFIG_DIR: claudeDir },
      encoding: "utf8",
    });
    expect(result.status).toBe(0);

    const settings = JSON.parse(
      readFileSync(join(claudeDir, "settings.json"), "utf8"),
    );
    expect(settings.statusLine).toBeDefined();
    expect(settings.statusLine.type).toBe("command");
    expect(settings.statusLine.command).toContain("statusline.sh");
  });
});
