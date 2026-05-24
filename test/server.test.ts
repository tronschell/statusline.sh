import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { serve } from "bun";
import { resetDbForTests, setDbPathForTests } from "../src/server/db";
import { routes } from "../src/server/routes";
import type { Design } from "../src/shared/types";

const FIXTURE: Design = {
  version: 1,
  name: "Test Design",
  elements: [
    { id: "a1", type: "model", style: { bold: true } },
    { id: "a2", type: "separator", text: " | ", style: {} },
    { id: "a3", type: "cwd", mode: "basename", style: { fg: { kind: "ansi16", index: 14 } } },
  ],
};

const INVALID = {
  version: 1,
  name: "Bad",
  elements: [
    { id: "x", type: "cost", style: {}, precision: 99 },
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
      return new Response("not found", { status: 404 });
    },
  });
  base = `http://localhost:${server.port}`;
});

afterAll(() => {
  server.stop(true);
  resetDbForTests();
});

beforeEach(() => {
  // Fresh DB per test for isolation.
  setDbPathForTests(":memory:");
});

describe("design CRUD", () => {
  test("POST → GET roundtrip", async () => {
    const post = await fetch(`${base}/api/designs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(FIXTURE),
    });
    expect(post.status).toBe(201);
    const { id } = (await post.json()) as { id: string };
    expect(typeof id).toBe("string");
    expect(id.length).toBe(10);

    const get = await fetch(`${base}/api/designs/${id}`);
    expect(get.status).toBe(200);
    const body = (await get.json()) as { design: Design; views: number };
    expect(body.design.name).toBe("Test Design");
    expect(body.design.elements.length).toBe(3);
    expect(body.views).toBe(1);

    // Second GET bumps views again.
    const get2 = await fetch(`${base}/api/designs/${id}`);
    const body2 = (await get2.json()) as { views: number };
    expect(body2.views).toBe(2);
  });

  test("POST invalid design returns 400 with error", async () => {
    const res = await fetch(`${base}/api/designs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(INVALID),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; path?: string };
    expect(body.error).toBeTruthy();
    expect(body.path).toMatch(/precision/);
  });

  test("GET unknown design returns 404", async () => {
    const res = await fetch(`${base}/api/designs/does-not-x`);
    expect(res.status).toBe(404);
  });

  test("PUT updates design", async () => {
    const post = await fetch(`${base}/api/designs`, {
      method: "POST",
      body: JSON.stringify(FIXTURE),
    });
    const { id } = (await post.json()) as { id: string };

    const updated = { ...FIXTURE, name: "Updated" };
    const put = await fetch(`${base}/api/designs/${id}`, {
      method: "PUT",
      body: JSON.stringify(updated),
    });
    expect(put.status).toBe(200);

    const get = await fetch(`${base}/api/designs/${id}`);
    const body = (await get.json()) as { design: Design };
    expect(body.design.name).toBe("Updated");
  });

  test("PUT unknown design returns 404", async () => {
    const put = await fetch(`${base}/api/designs/missing0xyz`, {
      method: "PUT",
      body: JSON.stringify(FIXTURE),
    });
    expect(put.status).toBe(404);
  });
});

describe("community lifecycle", () => {
  test("publish → list → fork", async () => {
    // Create
    const post = await fetch(`${base}/api/designs`, {
      method: "POST",
      body: JSON.stringify(FIXTURE),
    });
    const { id } = (await post.json()) as { id: string };

    // Initial community list is empty
    const list0 = await fetch(`${base}/api/community`);
    const body0 = (await list0.json()) as { items: unknown[] };
    expect(body0.items.length).toBe(0);

    // Publish
    const pub = await fetch(`${base}/api/designs/${id}/publish`, {
      method: "POST",
      body: JSON.stringify({
        author_name: "Alice",
        description: "A starter design",
        name: "My Cool Statusline",
      }),
    });
    expect(pub.status).toBe(200);
    const { slug } = (await pub.json()) as { slug: string };
    expect(slug).toMatch(/^my-cool-statusline-/);

    // Appears in list
    const list = await fetch(`${base}/api/community?sort=recent&limit=10`);
    expect(list.status).toBe(200);
    const listBody = (await list.json()) as {
      items: Array<{ id: string; slug: string; author_name: string; name: string }>;
      nextCursor: string | null;
    };
    expect(listBody.items.length).toBe(1);
    expect(listBody.items[0]!.id).toBe(id);
    expect(listBody.items[0]!.slug).toBe(slug);
    expect(listBody.items[0]!.author_name).toBe("Alice");

    // Detail by slug
    const detail = await fetch(`${base}/api/community/${slug}`);
    expect(detail.status).toBe(200);
    const detailBody = (await detail.json()) as { id: string; design: Design };
    expect(detailBody.id).toBe(id);
    expect(detailBody.design.name).toBe("My Cool Statusline");

    // Fork
    const fork = await fetch(`${base}/api/designs/${id}/fork`, { method: "POST" });
    expect(fork.status).toBe(201);
    const { id: forkId } = (await fork.json()) as { id: string };
    expect(forkId).not.toBe(id);

    // Fork has forked_from set
    const forkGet = await fetch(`${base}/api/designs/${forkId}`);
    const forkBody = (await forkGet.json()) as { forked_from: string };
    expect(forkBody.forked_from).toBe(id);

    // Original now has forks=1
    const origGet = await fetch(`${base}/api/designs/${id}`);
    const origBody = (await origGet.json()) as { forks: number };
    expect(origBody.forks).toBe(1);
  });

  test("unpublish removes from community", async () => {
    const post = await fetch(`${base}/api/designs`, {
      method: "POST",
      body: JSON.stringify(FIXTURE),
    });
    const { id } = (await post.json()) as { id: string };

    await fetch(`${base}/api/designs/${id}/publish`, {
      method: "POST",
      body: JSON.stringify({
        author_name: "Bob",
        description: "Test",
        name: "Removed",
      }),
    });

    const list1 = await fetch(`${base}/api/community`);
    expect(((await list1.json()) as { items: unknown[] }).items.length).toBe(1);

    await fetch(`${base}/api/designs/${id}/unpublish`, { method: "POST" });

    const list2 = await fetch(`${base}/api/community`);
    expect(((await list2.json()) as { items: unknown[] }).items.length).toBe(0);
  });

  test("publish unknown design returns 404", async () => {
    const res = await fetch(`${base}/api/designs/missing0000/publish`, {
      method: "POST",
      body: JSON.stringify({ author_name: "x", description: "y", name: "z" }),
    });
    expect(res.status).toBe(404);
  });

  test("fork unknown design returns 404", async () => {
    const res = await fetch(`${base}/api/designs/missing0000/fork`, {
      method: "POST",
    });
    expect(res.status).toBe(404);
  });

  test("community slug not found returns 404", async () => {
    const res = await fetch(`${base}/api/community/nope`);
    expect(res.status).toBe(404);
  });
});

describe("publish sanitization", () => {
  async function createAndPublish(payload: {
    author_name: string;
    description: string;
    name: string;
  }): Promise<Response> {
    const post = await fetch(`${base}/api/designs`, {
      method: "POST",
      body: JSON.stringify(FIXTURE),
    });
    const { id } = (await post.json()) as { id: string };
    return fetch(`${base}/api/designs/${id}/publish`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  test("rejects slur in author name (leet-obfuscated)", async () => {
    // "n!gger" → after leet/punctuation normalisation → "nigger"
    const res = await createAndPublish({
      author_name: "n!gger",
      description: "ok",
      name: "Fine",
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error.toLowerCase()).toContain("author_name");
  });

  test("rejects profanity in description even with punctuation spacing", async () => {
    // "f.u.c.k" survives because punctuation strip leaves "fuck".
    const res = await createAndPublish({
      author_name: "Alice",
      description: "this is f.u.c.k awesome",
      name: "Fine",
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error.toLowerCase()).toContain("description");
  });

  test("strips angle brackets and zero-width chars without rejecting", async () => {
    // Stored value should have no `<script>` markup and no U+200B padding.
    const payload = {
      author_name: "Carol",
      // ZWSP between letters + bracketed markup attempt.
      description: "Hel​lo <script>alert(1)</script> world",
      name: "Clean Name",
    };
    const post = await fetch(`${base}/api/designs`, {
      method: "POST",
      body: JSON.stringify(FIXTURE),
    });
    const { id } = (await post.json()) as { id: string };
    const pub = await fetch(`${base}/api/designs/${id}/publish`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    expect(pub.status).toBe(200);
    const { slug } = (await pub.json()) as { slug: string };
    const detail = await fetch(`${base}/api/community/${slug}`);
    const body = (await detail.json()) as {
      description: string;
      author_name: string;
    };
    expect(body.description).not.toContain("<");
    expect(body.description).not.toContain(">");
    expect(body.description).not.toContain("​");
    expect(body.description).toContain("Hello");
    expect(body.description).toContain("scriptalert(1)/script");
  });

  test("rejects empty name after trimming whitespace", async () => {
    const res = await createAndPublish({
      author_name: "Alice",
      description: "ok",
      name: "   \t  ",
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error.toLowerCase()).toContain("name");
  });

  test("allows empty description", async () => {
    const res = await createAndPublish({
      author_name: "Alice",
      description: "",
      name: "Bare Name",
    });
    expect(res.status).toBe(200);
  });

  test("truncates over-long name to the field cap", async () => {
    const longName = "x".repeat(200);
    const res = await createAndPublish({
      author_name: "Alice",
      description: "ok",
      name: longName,
    });
    expect(res.status).toBe(200);
    const { slug } = (await res.json()) as { slug: string };
    const detail = await fetch(`${base}/api/community/${slug}`);
    const body = (await detail.json()) as { design: Design };
    // Server cap is 60 chars on `name`.
    expect(body.design.name.length).toBeLessThanOrEqual(60);
  });
});

describe("installer endpoints", () => {
  test("GET /i/:id.sh returns runnable bash installer", async () => {
    const post = await fetch(`${base}/api/designs`, {
      method: "POST",
      body: JSON.stringify(FIXTURE),
    });
    const { id } = (await post.json()) as { id: string };

    const res = await fetch(`${base}/i/${id}.sh`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/x-shellscript");
    const text = await res.text();
    expect(text).toContain("#!/usr/bin/env bash");
    expect(text).toContain("<<'STATUSLINE_EOF'");
    expect(text).toContain("STATUSLINE_EOF");
    expect(text).toContain("exit 0");
    // The embedded compiled script should be present.
    expect(text).toContain("INPUT=\"$(cat)\"");
  });

  test("GET /i/:id.ps1 returns powershell installer", async () => {
    const post = await fetch(`${base}/api/designs`, {
      method: "POST",
      body: JSON.stringify(FIXTURE),
    });
    const { id } = (await post.json()) as { id: string };

    const res = await fetch(`${base}/i/${id}.ps1`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    const text = await res.text();
    expect(text).toContain("ConvertFrom-Json");
    expect(text).toContain("@'");
    expect(text).toContain("'@");
    expect(text).toContain("exit 0");
  });

  test("GET /i/:id.sh unknown returns 404", async () => {
    const res = await fetch(`${base}/i/missing0000.sh`);
    expect(res.status).toBe(404);
  });
});

describe("templates endpoint", () => {
  test("GET /api/templates returns array (empty if module missing)", async () => {
    const res = await fetch(`${base}/api/templates`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body) || typeof body === "object").toBe(true);
  });
});
