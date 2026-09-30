import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CaretDown, MagnifyingGlass, X } from "@phosphor-icons/react";
import type { CommunityCardSummary, Design } from "@statusline/shared/types";
import { Link } from "../../router";
import { api } from "../../lib/api";
import { CardGrid, CardSkeletonRows, CommunityDesignCard, EmptyState } from "./CommunityDesignCard";
import { accountApi } from "../../lib/accountApi";
import { ACCOUNTS_ENABLED } from "../../lib/config";
import { VerifiedBadge } from "../Account/ui";

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
 * Filters derived from what a design actually contains, so they work on the
 * existing schema with no category field. Like search, they only narrow the
 * pages already loaded.
 */
const FACETS = [
  { id: "minimal", label: "Minimal" },
  { id: "powerline", label: "Powerline" },
  { id: "context", label: "Context" },
  { id: "limits", label: "Rate limits" },
  { id: "cost", label: "Cost" },
  { id: "multiline", label: "Multi-line" },
] as const;
type Facet = (typeof FACETS)[number]["id"];

// Powerline private-use arrows plus the plain-Unicode wedges people use without a patched font.
const POWERLINE_GLYPH = /[\uE0B0-\uE0BF\u25B6\u25C0\u25E2-\u25E5]/;
const CHROME = new Set(["lineBreak", "spacer", "separator", "static", "glyph"]);

function facetsOf(design: Design): Set<Facet> {
  const out = new Set<Facet>();
  const els = design.elements;
  const has = (...t: string[]) => els.some((e) => t.includes(e.type));
  if (els.filter((e) => !CHROME.has(e.type)).length <= 3 && !has("lineBreak")) out.add("minimal");
  if (els.some((e) => (e.type === "separator" || e.type === "static") && POWERLINE_GLYPH.test(e.text))) out.add("powerline");
  if (has("contextPct", "contextBar", "contextTokens")) out.add("context");
  if (has("rateLimit5h", "rateLimit7d")) out.add("limits");
  if (has("cost", "sessionDuration")) out.add("cost");
  if (has("lineBreak")) out.add("multiline");
  return out;
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
  const [query, setQuery] = useState("");
  const [facet, setFacet] = useState<Facet | null>(null);
  const [featured, setFeatured] = useState<CommunityCardSummary[]>([]);

  // Featured slots are a Pro perk; the endpoint degrades to an empty list.
  useEffect(() => {
    if (!ACCOUNTS_ENABLED) return;
    accountApi.featured().then((r) => setFeatured(r.items)).catch(() => setFeatured([]));
  }, []);

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

  // Client-side search over the already-loaded pages. Case-insensitive
  // substring match across name / author / description. This only narrows the
  // items already fetched — it is not a full-corpus search.
  const trimmedQuery = query.trim();
  const filteredItems = useMemo(() => {
    const q = trimmedQuery.toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const haystack = [item.name, item.author_name, item.description]
        .filter((v): v is string => Boolean(v))
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [items, trimmedQuery]);

  const searching = trimmedQuery.length > 0;
  const filtering = searching || facet !== null;
  const totalLabel = `${items.length}${nextCursor ? "+" : ""}`;
  const clearFilters = () => {
    setQuery("");
    setFacet(null);
  };

  const facetMap = useMemo(() => new Map(filteredItems.map((i) => [i.id, facetsOf(i.design)])), [filteredItems]);
  const facetCounts = useMemo(() => {
    const c = new Map<Facet, number>();
    for (const f of facetMap.values()) for (const id of f) c.set(id, (c.get(id) ?? 0) + 1);
    return c;
  }, [facetMap]);
  const shownItems = useMemo(
    () => (facet ? filteredItems.filter((i) => facetMap.get(i.id)?.has(facet)) : filteredItems),
    [filteredItems, facet, facetMap],
  );

  // Verified (Pro) creators lead the list. Stable partition of the loaded
  // pages: order within each group is whatever the API returned. Designs
  // already shown in the Featured strip are dropped from the list so the same
  // entry never appears twice.
  const showFeatured = featured.length > 0 && !searching && !facet;
  const listItems = useMemo(() => {
    const featuredIds = showFeatured ? new Set(featured.map((f) => f.id)) : null;
    const rest = featuredIds ? shownItems.filter((i) => !featuredIds.has(i.id)) : shownItems;
    return [
      ...rest.filter((i) => i.owner?.verified),
      ...rest.filter((i) => !i.owner?.verified),
    ];
  }, [shownItems, featured, showFeatured]);

  // IntersectionObserver auto-load. A sentinel `<div>` sits below the grid;
  // when it scrolls into view we fire `loadMore`. The button below remains for
  // a11y/keyboard users and as a no-JS-observer fallback.
  useEffect(() => {
    const el = sentinelRef.current;
    // While searching we only narrow the loaded pages — pausing infinite
    // scroll keeps the visible result set stable.
    if (!el || !nextCursor || searching) return;
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
  }, [loadMore, nextCursor, searching]);

  return (
    <div className="min-h-screen w-full bg-[#0E0E10] text-[#E8E8E6]">
      <div className="mx-auto max-w-[1180px] px-6 pt-16 pb-28 md:px-8 md:pt-24">
        <header className="mb-14 md:mb-20">
          <div className="text-[12px] uppercase tracking-[0.16em] text-[#8A8A86]">
            Community
          </div>
          <h1
            className="mt-4 max-w-[16ch] font-serif text-[44px] leading-[1.02] tracking-tight md:text-[76px]"
            style={{
              fontFamily:
                "var(--font-serif, 'Instrument Serif', Georgia, serif)",
            }}
          >
            Claude Code statusline examples
          </h1>
          <p className="mt-6 max-w-[54ch] text-[16px] leading-relaxed text-[#A8A8A4]">
            Browse real Claude Code statusline examples, templates, and themes
            published by the community — copy-paste to install, or fork any
            design into the builder.
          </p>
          <p className="mt-4 max-w-[60ch] text-[14px] leading-relaxed text-[#8A8A86]">
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
        </header>

        {showFeatured ? (
          <section aria-labelledby="featured-heading" className="mb-16 md:mb-24">
            <div className="mb-8 flex items-baseline gap-3">
              <h2
                id="featured-heading"
                className="font-serif text-[28px] leading-none tracking-tight"
              >
                Featured
              </h2>
              <VerifiedBadge size={15} />
            </div>
            <CardGrid>
              {featured.map((item) => (
                <CommunityDesignCard key={item.id} summary={item} />
              ))}
            </CardGrid>
          </section>
        ) : null}

        <section aria-labelledby="all-heading">
          <div className="mb-6 flex flex-wrap items-baseline gap-x-5 gap-y-1">
            <h2 id="all-heading" className="font-serif text-[28px] leading-none tracking-tight">
              All designs
            </h2>
            <span className="text-[13px] tabular-nums text-[#6F6F6B]" aria-live="polite">
              {loading
                ? "Loading…"
                : filtering
                  ? `${shownItems.length} of ${totalLabel} loaded`
                  : `${totalLabel} design${items.length === 1 && !nextCursor ? "" : "s"}`}
            </span>
            {filtering ? (
              <button
                type="button"
                onClick={clearFilters}
                className="text-[13px] text-[#E8E8E6] underline decoration-white/20 underline-offset-[4px] hover:decoration-white/50"
              >
                Clear filters
              </button>
            ) : null}
          </div>

          {/* One toolbar: what to show (filter tabs, single-select) on the left,
              how to find and order it (search, sort) on the right. Sticky on
              wider screens so it stays reachable while scrolling a long grid. */}
          <div className="z-30 -mx-6 mb-8 border-b border-white/[0.07] bg-[#0E0E10]/90 px-6 backdrop-blur-md sm:sticky sm:top-[60px] md:-mx-8 md:px-8">
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
              <div
                role="group"
                aria-label="Filter designs"
                className="-mx-6 flex min-w-0 max-w-[100vw] items-center gap-6 overflow-x-auto px-6 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                <FacetTab active={facet === null} onClick={() => setFacet(null)}>
                  All
                </FacetTab>
                {FACETS.filter((f) => facetCounts.has(f.id) || facet === f.id).map((f) => (
                  <FacetTab key={f.id} active={facet === f.id} onClick={() => setFacet(f.id)}>
                    {f.label}
                    <span className="ml-1.5 text-[11px] tabular-nums text-[#5A5A57]">{facetCounts.get(f.id) ?? 0}</span>
                  </FacetTab>
                ))}
              </div>

              <div className="flex w-full items-center gap-3 py-2.5 sm:w-auto">
                <div className="relative min-w-0 flex-1 sm:w-52 sm:flex-none">
                  <MagnifyingGlass
                    size={14}
                    weight="bold"
                    className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6F6F6B]"
                  />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setQuery("");
                    }}
                    placeholder="Search name, creator…"
                    aria-label="Search designs by name, creator or description"
                    className="h-8 w-full rounded-[6px] bg-white/[0.05] pl-8 pr-7 text-[13px] text-[#E8E8E6] placeholder:text-[#6F6F6B] transition-colors [appearance:none] hover:bg-white/[0.07] focus:bg-white/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 [&::-webkit-search-cancel-button]:hidden"
                  />
                  {query ? (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      aria-label="Clear search"
                      className="absolute right-1.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-[#8A8A86] hover:text-[#E8E8E6]"
                    >
                      <X size={12} weight="bold" />
                    </button>
                  ) : null}
                </div>
                <label className="relative flex shrink-0 items-center text-[13px] text-[#6F6F6B]">
                  <span className="mr-2">Sort</span>
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as Sort)}
                    className="h-8 cursor-pointer appearance-none rounded-[6px] bg-white/[0.05] pl-3 pr-7 text-[13px] text-[#E8E8E6] transition-colors hover:bg-white/[0.07] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                  >
                    <option value="recent">Recent</option>
                    <option value="popular">Popular</option>
                  </select>
                  <CaretDown
                    size={11}
                    weight="bold"
                    aria-hidden="true"
                    className="pointer-events-none absolute right-2.5 text-[#8A8A86]"
                  />
                </label>
              </div>
            </div>
          </div>

          {error ? (
            <div
              role="alert"
              className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-1 border-l-2 border-[#E89B9E]/60 py-1 pl-4 text-[13px] text-[#E89B9E]"
            >
              <span>{error}</span>
              <button
                type="button"
                onClick={() => (items.length === 0 ? void load(sort) : void loadMore())}
                className="text-[#E8E8E6] underline decoration-white/20 underline-offset-[4px] hover:decoration-white/50"
              >
                Try again
              </button>
            </div>
          ) : null}

          {loading && items.length === 0 ? (
            <CardSkeletonRows />
          ) : !loading && items.length === 0 ? (
            error ? null : (
              <EmptyState title="No designs yet.">
                Be the first to publish one from the{" "}
                <Link
                  href="/builder"
                  className="text-[#E8E8E6] underline decoration-white/20 underline-offset-[4px] hover:decoration-white/50"
                >
                  builder
                </Link>
                .
              </EmptyState>
            )
          ) : (searching || facet) && shownItems.length === 0 ? (
            <EmptyState title="No loaded designs match.">
              <button
                type="button"
                onClick={clearFilters}
                className="text-[#E8E8E6] underline decoration-white/20 underline-offset-[4px] hover:decoration-white/50"
              >
                Clear filters
              </button>
            </EmptyState>
          ) : (
            <CardGrid>
              {listItems.map((item) => (
                <CommunityDesignCard key={item.id} summary={item} />
              ))}
            </CardGrid>
          )}

          {nextCursor && !searching ? (
            <>
              <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />
              <div className="mt-10 flex justify-center">
                <button
                  type="button"
                  onClick={() => void loadMore()}
                  disabled={loadingMore}
                  className="text-[13px] text-[#A8A8A4] underline decoration-white/20 underline-offset-[5px] transition-colors hover:text-[#E8E8E6] hover:decoration-white/50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              </div>
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function FacetTab({
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
      aria-pressed={active}
      className={
        "-mb-px shrink-0 whitespace-nowrap border-b-2 py-3 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 " +
        (active
          ? "border-[#E8E8E6] text-[#E8E8E6]"
          : "border-transparent text-[#8A8A86] hover:text-[#E8E8E6]")
      }
    >
      {children}
    </button>
  );
}

export default CommunityPage;
