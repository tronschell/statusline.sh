import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CommunityCardSummary, Design } from "@statusline/shared/types";
import { Link } from "../../router";
import { api } from "../../lib/api";
import { CommunityDesignCard } from "./CommunityDesignCard";

type Sort = "recent" | "popular";

/**
 * Module-scoped cache shared across mounts. The page can unmount when the
 * user navigates into a design detail and remount on back-navigation — without
 * this we'd re-issue the first-page fetch every time. The edge cache absorbs
 * most of the cost, but it still incurs a Worker round-trip + render flicker.
 *
 * Cache lives for the lifetime of the SPA session. It's intentionally not
 * persisted — the 60s edge cache is plenty fresh on first visit.
 */
interface CacheEntry {
  items: CommunityCardSummary[];
  nextCursor: string | null;
}
const pageCache = new Map<Sort, CacheEntry>();

const PAGE_SIZE = 24;

/**
 * Category facets shown under the heading. They frame the gallery as
 * "examples, templates & themes" for search, give readers a vocabulary for the
 * kinds of designs published here, and act as client-side filters.
 *
 * There is no `category` column on D1 — rather than a schema migration, we
 * infer each design's bucket from its element composition (`categoryOf` below).
 * Filtering is therefore a pure view over the designs already loaded into
 * `items`; because the list is infinite-scroll paginated, a filter only sees
 * what has been fetched so far (loading more pages widens the pool). This keeps
 * the pagination code untouched and avoids a backend round-trip per facet.
 */
const CATEGORY_FACETS = [
  "Minimal",
  "Powerline",
  "Cost tracker",
  "Context / token",
  "Themes",
] as const;

type CategoryFacet = (typeof CATEGORY_FACETS)[number];

/**
 * Infer a single browse category for a design from the elements it uses. Pure
 * and deterministic; first matching rule wins. This is a heuristic for the
 * facet filter, not a canonical taxonomy — a design that spans several themes
 * is placed in its most distinctive bucket.
 */
export function categoryOf(design: Design): CategoryFacet {
  const types = new Set(design.elements.map((e) => e.type));
  const has = (...t: Design["elements"][number]["type"][]): boolean =>
    t.some((x) => types.has(x));

  // Powerline: segmented bars built from segmentSplit styling.
  if (has("segmentSplit")) return "Powerline";

  // Context / token: usage / progress bars and token-window readouts.
  if (
    has(
      "contextBar",
      "contextPct",
      "contextTokens",
      "rateLimit5h",
      "rateLimit7d",
    )
  )
    return "Context / token";

  // Cost tracker: spend / session-cost oriented layouts.
  if (has("cost")) return "Cost tracker";

  // Minimal: a short single-line bar of a few basic elements, no theming.
  const meaningful = design.elements.filter(
    (e) =>
      e.type !== "separator" && e.type !== "spacer" && e.type !== "lineBreak",
  ).length;
  if (!design.background && meaningful <= 4) return "Minimal";

  // Everything else — decorated, multi-line, or background-themed designs.
  return "Themes";
}

export function CommunityPage() {
  const [sort, setSort] = useState<Sort>("recent");
  const [items, setItems] = useState<CommunityCardSummary[]>(
    () => pageCache.get("recent")?.items ?? [],
  );
  const [nextCursor, setNextCursor] = useState<string | null>(
    () => pageCache.get("recent")?.nextCursor ?? null,
  );
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // null = the "All" facet (no filter). Filtering is a pure view over the
  // designs already loaded into `items` — see CATEGORY_FACETS note above.
  const [activeCategory, setActiveCategory] = useState<CategoryFacet | null>(
    null,
  );

  const visibleItems = useMemo(
    () =>
      activeCategory
        ? items.filter((it) => categoryOf(it.design) === activeCategory)
        : items,
    [items, activeCategory],
  );

  // Coalesce concurrent loadMore calls. Without this, a fast scroll can fire
  // the observer multiple times before the in-flight request settles.
  const fetchingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async (s: Sort) => {
    const cached = pageCache.get(s);
    if (cached) {
      setItems(cached.items);
      setNextCursor(cached.nextCursor);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.listCommunity({ sort: s, limit: PAGE_SIZE });
      pageCache.set(s, { items: res.items, nextCursor: res.nextCursor });
      setItems(res.items);
      setNextCursor(res.nextCursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(sort);
  }, [sort, load]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || fetchingRef.current) return;
    fetchingRef.current = true;
    setLoadingMore(true);
    setError(null);
    try {
      const res = await api.listCommunity({
        sort,
        limit: PAGE_SIZE,
        cursor: nextCursor,
      });
      setItems((prev) => {
        const merged = [...prev, ...res.items];
        pageCache.set(sort, { items: merged, nextCursor: res.nextCursor });
        return merged;
      });
      setNextCursor(res.nextCursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingMore(false);
      fetchingRef.current = false;
    }
  }, [nextCursor, sort]);

  // IntersectionObserver auto-load. A sentinel `<div>` sits below the grid;
  // when it scrolls into view we fire `loadMore`. The button below remains for
  // a11y/keyboard users and as a no-JS-observer fallback.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !nextCursor) return;
    if (typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            void loadMore();
            break;
          }
        }
      },
      // Pre-load one viewport early so the user never sees a hard stop.
      { rootMargin: "600px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore, nextCursor]);

  return (
    <div className="min-h-screen w-full bg-[#0E0E10] text-[#E8E8E6]">
      <div className="mx-auto max-w-[1400px] px-8 pt-16 pb-24 md:pt-24">
        <header className="mb-12 flex flex-col gap-6 md:mb-16 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-[12px] uppercase tracking-[0.16em] text-[#8A8A86]">
              Community
            </div>
            <h1
              className="mt-3 font-serif text-5xl md:text-6xl leading-[1.05] tracking-tight"
              style={{
                fontFamily:
                  "var(--font-serif, 'Instrument Serif', Georgia, serif)",
              }}
            >
              Claude Code statusline examples
            </h1>
            <p className="mt-4 max-w-[58ch] text-[15px] leading-relaxed text-[#8A8A86]">
              Browse real Claude Code statusline examples, templates, and themes
              published by the community — preview each design in a live
              terminal, copy-paste the one-line install command, or fork any
              design into the builder to make it your own.
            </p>
            <p className="mt-3 max-w-[60ch] text-[14px] leading-relaxed text-[#8A8A86]">
              <Link
                href="/builder"
                title="Claude Code Statusline Builder"
                className="text-[#E8E8E6] underline decoration-white/20 underline-offset-[4px] hover:decoration-white/50"
              >
                Start building your own Claude Code statusline
              </Link>
              , or read{" "}
              <Link
                href="/how-to-make-a-claude-code-statusline"
                title="How to make a Claude Code statusline"
                className="text-[#E8E8E6] underline decoration-white/20 underline-offset-[4px] hover:decoration-white/50"
              >
                How to make a Claude Code statusline
              </Link>{" "}
              first.
            </p>
          </div>

          <div className="flex items-center justify-between gap-6 md:flex-col md:items-end">
            <div className="text-[13px] text-[#8A8A86]">
              {loading
                ? "Loading…"
                : `${visibleItems.length} design${visibleItems.length === 1 ? "" : "s"}`}
            </div>
            <SortToggle value={sort} onChange={setSort} />
          </div>
        </header>

        {/* Indexable category facets, wired as client-side filters over the
            loaded designs (see CATEGORY_FACETS + categoryOf above). */}
        <div className="mb-10 flex flex-wrap items-center gap-2 md:mb-12">
          <span className="mr-1 text-[11px] uppercase tracking-[0.14em] text-[#6F6F6B]">
            Browse by
          </span>
          <FacetPill
            active={activeCategory === null}
            onClick={() => setActiveCategory(null)}
          >
            All
          </FacetPill>
          {CATEGORY_FACETS.map((label) => (
            <FacetPill
              key={label}
              active={activeCategory === label}
              onClick={() =>
                setActiveCategory((cur) => (cur === label ? null : label))
              }
            >
              {label}
            </FacetPill>
          ))}
        </div>

        {error ? (
          <div className="mb-8 rounded-[10px] border border-[#E89B9E]/30 bg-[#3A1F21]/30 px-4 py-3 text-[13px] text-[#E89B9E]">
            {error}
          </div>
        ) : null}

        {!loading && items.length === 0 ? (
          <div className="rounded-[10px] border border-white/[0.06] py-24 text-center text-[#8A8A86]">
            No designs yet. Be the first to publish.
          </div>
        ) : !loading && visibleItems.length === 0 ? (
          <div className="rounded-[10px] border border-white/[0.06] py-24 text-center text-[#8A8A86]">
            No{" "}
            <span className="text-[#E8E8E6]">{activeCategory}</span> designs
            among the {items.length} loaded so far.{" "}
            <button
              type="button"
              onClick={() => setActiveCategory(null)}
              className="text-[#E8E8E6] underline decoration-white/20 underline-offset-[4px] hover:decoration-white/50"
            >
              Show all
            </button>
            {nextCursor ? " or load more below." : "."}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {visibleItems.map((item) => (
              <CommunityDesignCard key={item.id} summary={item} />
            ))}
          </div>
        )}

        {nextCursor ? (
          <>
            <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />
            <div className="mt-12 flex justify-center">
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="rounded-[6px] border border-white/[0.08] px-4 py-2 text-[13px] text-[#E8E8E6] transition-colors hover:border-white/[0.18] hover:bg-white/[0.02] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

interface FacetPillProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function FacetPill({ active, onClick, children }: FacetPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "inline-flex items-center rounded-[999px] border px-3 py-1 text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 " +
        (active
          ? "border-white/[0.18] bg-[#222226] text-[#E8E8E6]"
          : "border-white/[0.08] bg-[#161618] text-[#A8A8A4] hover:border-white/[0.14] hover:text-[#E8E8E6]")
      }
    >
      {children}
    </button>
  );
}

interface SortToggleProps {
  value: Sort;
  onChange: (v: Sort) => void;
}

function SortToggle({ value, onChange }: SortToggleProps) {
  return (
    <div className="inline-flex items-center rounded-[8px] border border-white/[0.06] bg-[#161618] p-1">
      <SortButton active={value === "recent"} onClick={() => onChange("recent")}>
        Recent
      </SortButton>
      <SortButton active={value === "popular"} onClick={() => onChange("popular")}>
        Popular
      </SortButton>
    </div>
  );
}

function SortButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-[6px] px-3 py-1.5 text-[12px] uppercase tracking-[0.1em] transition-colors " +
        (active
          ? "bg-[#1C1C1F] text-[#E8E8E6]"
          : "text-[#8A8A86] hover:text-[#E8E8E6]")
      }
    >
      {children}
    </button>
  );
}

export default CommunityPage;
