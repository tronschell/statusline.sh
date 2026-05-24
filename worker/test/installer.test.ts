import { describe, expect, test } from "bun:test";
import type { Design } from "@statusline/shared/types";
import {
  handleInstaller,
  renderInstaller,
  type InstallerEnv,
} from "../src/handlers/installer";

function makeDesign(): Design {
  return {
    version: 1,
    name: "Test Design",
    elements: [
      {
        id: "e1",
        type: "static",
        text: "hello",
        style: { fg: { kind: "ansi16", index: 2 } },
      },
      {
        id: "e2",
        type: "model",
        style: { fg: { kind: "ansi16", index: 6 } },
        prefix: " | ",
      },
    ],
  };
}

// Minimal in-memory D1 stub. We only model the two queries `getInstallTarget`
// runs: `SELECT json FROM designs WHERE id = ?` and the install_records
// fallback. Everything else throws so a regression doesn't silently pass.
function makeD1Env(rows: Map<string, string>): InstallerEnv {
  const prepare = (sql: string) => ({
    bind: (id: string) => ({
      async first(): Promise<{ json: string } | null> {
        if (sql.includes("FROM designs WHERE id = ?")) {
          const j = rows.get("designs:" + id);
          return j ? { json: j } : null;
        }
        if (sql.includes("FROM install_records WHERE id = ?")) {
          const j = rows.get("install_records:" + id);
          return j ? { json: j } : null;
        }
        throw new Error("unexpected SQL: " + sql);
      },
    }),
  });
  return {
    DB: {
      prepare,
    } as unknown as D1Database,
  };
}

describe("renderInstaller (bash)", () => {
  const design = makeDesign();
  const req = new Request("https://example.com/i/abc.sh");
  const res = renderInstaller(req, design, "sh");

  test("returns 200", () => {
    expect(res).not.toBeNull();
    expect(res!.status).toBe(200);
  });

  test("content-type is text/x-shellscript; charset=utf-8", () => {
    expect(res!.headers.get("content-type")).toBe(
      "text/x-shellscript; charset=utf-8",
    );
  });

  test("cache-control includes max-age=3600", () => {
    const cc = res!.headers.get("cache-control") ?? "";
    expect(cc).toContain("max-age=3600");
  });

  test("body contains the heredoc marker STATUSLINE_EOF", async () => {
    const body = await res!.clone().text();
    expect(body).toContain("<<'STATUSLINE_EOF'");
    expect(body).toContain("\nSTATUSLINE_EOF\n");
  });

  test("body contains a recognisable compiled-bash snippet", async () => {
    const body = await res!.clone().text();
    // BASH_HEADER from packages/shared/src/compiler/bash.ts
    expect(body).toContain("#!/usr/bin/env bash");
    expect(body).toContain('INPUT="$(cat)"');
    // The "hello" static text from our design should land in the compiled
    // script.
    expect(body).toContain("hello");
  });
});

describe("renderInstaller (powershell)", () => {
  const design = makeDesign();
  const req = new Request("https://example.com/i/abc.ps1");
  const res = renderInstaller(req, design, "ps1");

  test("returns 200", () => {
    expect(res).not.toBeNull();
    expect(res!.status).toBe(200);
  });

  test("content-type is text/plain; charset=utf-8", () => {
    expect(res!.headers.get("content-type")).toBe(
      "text/plain; charset=utf-8",
    );
  });

  test("cache-control includes max-age=3600", () => {
    expect(res!.headers.get("cache-control") ?? "").toContain("max-age=3600");
  });

  test("body contains the single-quoted here-string markers @' and '@", async () => {
    const body = await res!.clone().text();
    expect(body).toContain("$script = @'");
    expect(body).toMatch(/\n'@\n/);
  });

  test("body contains a recognisable compiled-PS snippet", async () => {
    const body = await res!.clone().text();
    // PS_HEADER from packages/shared/src/compiler/powershell.ts
    expect(body).toContain("$ErrorActionPreference");
    expect(body).toContain("ConvertFrom-Json");
    expect(body).toContain("hello");
  });
});

describe("renderInstaller selfheal query param", () => {
  // The self-heal block is unconditionally embedded inside both templates —
  // it's runtime-gated by $STATUSLINE_SELFHEAL on the user's machine, not by
  // a template flag. So the query param is accepted for forward-compat but
  // doesn't change the rendered output today. Either way, the self-heal
  // block must be present in the script.
  test("bash output contains the self-heal block with or without ?selfheal=1", async () => {
    const design = makeDesign();
    const plain = renderInstaller(
      new Request("https://example.com/i/abc.sh"),
      design,
      "sh",
    );
    const flagged = renderInstaller(
      new Request("https://example.com/i/abc.sh?selfheal=1"),
      design,
      "sh",
    );
    const plainBody = await plain!.text();
    const flaggedBody = await flagged!.text();
    expect(plainBody).toContain("STATUSLINE_SELFHEAL");
    expect(plainBody).toContain("__offer_self_heal");
    expect(flaggedBody).toContain("STATUSLINE_SELFHEAL");
    expect(flaggedBody).toContain("__offer_self_heal");
  });

  test("powershell output contains the self-heal block with or without ?selfheal=1", async () => {
    const design = makeDesign();
    const plain = renderInstaller(
      new Request("https://example.com/i/abc.ps1"),
      design,
      "ps1",
    );
    const flagged = renderInstaller(
      new Request("https://example.com/i/abc.ps1?selfheal=1"),
      design,
      "ps1",
    );
    const plainBody = await plain!.text();
    const flaggedBody = await flagged!.text();
    expect(plainBody).toContain("STATUSLINE_SELFHEAL");
    expect(plainBody).toContain("Invoke-SelfHeal");
    expect(flaggedBody).toContain("STATUSLINE_SELFHEAL");
    expect(flaggedBody).toContain("Invoke-SelfHeal");
  });
});

describe("handleInstaller (DB-backed)", () => {
  test("known id returns the bash installer", async () => {
    const env = makeD1Env(
      new Map([["designs:known", JSON.stringify(makeDesign())]]),
    );
    const res = await handleInstaller(
      new Request("https://example.com/i/known.sh"),
      env,
      { id: "known", ext: "sh" },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe(
      "text/x-shellscript; charset=utf-8",
    );
    const body = await res.text();
    expect(body).toContain("STATUSLINE_EOF");
  });

  test("known id returns the powershell installer", async () => {
    const env = makeD1Env(
      new Map([["designs:known", JSON.stringify(makeDesign())]]),
    );
    const res = await handleInstaller(
      new Request("https://example.com/i/known.ps1"),
      env,
      { id: "known", ext: "ps1" },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe(
      "text/plain; charset=utf-8",
    );
    const body = await res.text();
    expect(body).toContain("$script = @'");
  });

  test("unknown id returns 404", async () => {
    const env = makeD1Env(new Map());
    const res = await handleInstaller(
      new Request("https://example.com/i/missing.sh"),
      env,
      { id: "missing", ext: "sh" },
    );
    expect(res.status).toBe(404);
  });

  test("falls back to install_records when id is not in designs", async () => {
    const env = makeD1Env(
      new Map([["install_records:tmp1", JSON.stringify(makeDesign())]]),
    );
    const res = await handleInstaller(
      new Request("https://example.com/i/tmp1.sh"),
      env,
      { id: "tmp1", ext: "sh" },
    );
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("STATUSLINE_EOF");
  });
});
