#!/usr/bin/env bun
/**
 * Seed the local SQLite DB with a handful of published community designs.
 *
 * Usage:
 *   bun run scripts/seed.ts
 *
 * Idempotent: each template name is skipped if a published row with the same
 * `json -> $.name` already exists.
 */

import { getDb } from "../src/server/db";
import {
  insertDesign,
  publishDesign,
} from "../src/server/designs";
import { TEMPLATES } from "../src/shared/templates";

const SEED_TEMPLATE_IDS = [
  "minimal",
  "verbose-dev",
  "branch-split",
  "context-watch",
] as const;

const AUTHOR = "statusline-maker";

function existsByName(name: string): boolean {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT id FROM designs WHERE is_public = 1 AND json_extract(json, '$.name') = ? LIMIT 1",
    )
    .get(name) as { id: string } | null;
  return row !== null;
}

async function main(): Promise<void> {
  let created = 0;
  let skipped = 0;
  const results: { name: string; slug?: string; status: "created" | "skipped" }[] = [];

  for (const tplId of SEED_TEMPLATE_IDS) {
    const tpl = TEMPLATES.find((t) => t.id === tplId);
    if (!tpl) {
      console.warn(`[seed] template not found: ${tplId}`);
      continue;
    }
    if (existsByName(tpl.name)) {
      skipped += 1;
      results.push({ name: tpl.name, status: "skipped" });
      continue;
    }

    const { id } = insertDesign(tpl.design);
    const pub = publishDesign(id, {
      author_name: AUTHOR,
      description: tpl.description,
      name: tpl.name,
    });
    if (!pub) {
      console.error(`[seed] failed to publish ${tpl.name} (id=${id})`);
      continue;
    }
    created += 1;
    results.push({ name: tpl.name, slug: pub.slug, status: "created" });
  }

  console.log(`[seed] done. created=${created} skipped=${skipped}`);
  for (const r of results) {
    if (r.status === "created") {
      console.log(`  + ${r.name}  (slug: ${r.slug})`);
    } else {
      console.log(`  · ${r.name}  (already exists)`);
    }
  }
}

await main();
