/**
 * Workers Analytics Engine → D1 view-count rollup.
 *
 * The detail handler in src/index.ts writes a data point to AE per request
 * (blob1 = slug). The hourly cron in src/index.ts calls `rollupViewsFromAE`,
 * which queries the AE SQL API for the elapsed window, sums the
 * sample-aware counts per slug, and pushes the deltas into D1 in a single
 * atomic batch with the cursor advance.
 *
 * Sampling: AE samples writes under load. `SUM(_sample_interval)` is the
 * unbiased estimator of true event count — using `COUNT(*)` would
 * undercount by orders of magnitude on a viral design. See
 * https://developers.cloudflare.com/analytics/analytics-engine/sql-reference/
 */

import { applyViewRollup, getLastRollupAt, type DbEnv } from "./designs";

export interface ViewRollupEnv extends DbEnv {
  CF_ACCOUNT_ID?: string;
  CF_ANALYTICS_TOKEN?: string;
}

const AE_DATASET = "statusline_views";

// AE ingestion is eventually consistent (typical latency: seconds, p99: a few
// minutes). We cap the upper bound of each rollup window this far in the past
// so an event that hasn't yet landed in AE gets picked up on the next run
// instead of being silently lost on the boundary.
const INGESTION_BUFFER_MS = 5 * 60 * 1000;

// Bound the first-ever rollup so we don't ask AE for "everything since epoch"
// when last_rollup_at is still the seed value 0.
const COLD_START_LOOKBACK_MS = 60 * 60 * 1000;

interface AeQueryRow {
  slug: string;
  count: number | string;
}

interface AeQueryResponse {
  data?: AeQueryRow[];
}

export async function queryViewCounts(
  env: ViewRollupEnv,
  sinceMs: number,
  untilMs: number,
  fetchImpl: typeof fetch = fetch,
): Promise<Map<string, number> | null> {
  if (!env.CF_ACCOUNT_ID || !env.CF_ANALYTICS_TOKEN) return null;
  if (untilMs <= sinceMs) return new Map();

  // AE timestamps are DateTime64(3). ISO-8601 with millisecond precision
  // round-trips cleanly through toDateTime64('…', 3).
  const sinceIso = new Date(sinceMs).toISOString();
  const untilIso = new Date(untilMs).toISOString();
  const sql =
    `SELECT blob1 AS slug, SUM(_sample_interval) AS count ` +
    `FROM ${AE_DATASET} ` +
    `WHERE timestamp > toDateTime64('${sinceIso}', 3) ` +
    `AND timestamp <= toDateTime64('${untilIso}', 3) ` +
    `GROUP BY blob1 ` +
    `FORMAT JSON`;

  const res = await fetchImpl(
    `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/analytics_engine/sql`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.CF_ANALYTICS_TOKEN}`,
        "content-type": "text/plain",
      },
      body: sql,
    },
  );
  if (!res.ok) {
    console.error(
      `AE query failed: ${res.status} ${await res.text().catch(() => "")}`,
    );
    return null;
  }
  const body = (await res.json()) as AeQueryResponse;
  const counts = new Map<string, number>();
  for (const row of body.data ?? []) {
    const count = Math.round(Number(row.count));
    if (typeof row.slug === "string" && Number.isFinite(count) && count > 0) {
      counts.set(row.slug, count);
    }
  }
  return counts;
}

export async function rollupViewsFromAE(env: ViewRollupEnv): Promise<{
  applied: number;
  windowStart: number;
  windowEnd: number;
} | null> {
  const now = Date.now();
  const untilMs = now - INGESTION_BUFFER_MS;
  const stored = await getLastRollupAt(env);
  const sinceMs = stored === 0 ? untilMs - COLD_START_LOOKBACK_MS : stored;

  const counts = await queryViewCounts(env, sinceMs, untilMs);
  // queryViewCounts returns null specifically when AE credentials are absent —
  // skip the cursor advance too, so the moment credentials land we backfill
  // the pending window instead of dropping it.
  if (counts === null) return null;

  await applyViewRollup(env, counts, untilMs);
  return { applied: counts.size, windowStart: sinceMs, windowEnd: untilMs };
}
