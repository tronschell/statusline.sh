import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import type { CommunityCardSummary } from "@statusline/shared/types";
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
      <div className="mx-auto max-w-[1400px] px-8 pt-16 pb-24 md:pt-24">
        <header className="mb-12 flex flex-col gap-6 md:mb-16 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-[12px] uppercase tracking-[0.16em] text-[#8A8A86]">
              Browse
            </div>
            <h1
              className="mt-3 font-serif text-5xl md:text-6xl leading-[1.05] tracking-tight"
              style={{
                fontFamily:
                  "var(--font-serif, 'Instrument Serif', Georgia, serif)",
              }}
            >
              Community.
            </h1>
            <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed text-[#8A8A86]">
              Designs published by the community. Open any of them to see the
              live preview, or fork into your own builder.
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

          <div className="flex flex-col gap-4 md:items-end">
            <div className="flex items-center justify-between gap-6">
              <div className="text-[13px] text-[#8A8A86]">
                {loading
                  ? "Loading…"
                  : `${filteredItems.length} design${filteredItems.length === 1 ? "" : "s"}`}
              </div>
              <SortToggle value={sort} onChange={setSort} />
            </div>
            <div className="flex flex-col gap-1.5 md:items-end">
              <div className="relative">
                <MagnifyingGlass
                  size={14}
                  weight="bold"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8A86]"
                />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search loaded designs…"
                  aria-label="Search loaded designs"
                  className="w-full rounded-[8px] border border-white/[0.06] bg-[#161618] py-2 pl-9 pr-3 text-[13px] text-[#E8E8E6] placeholder:text-[#5A5A57] transition-colors hover:border-white/[0.18] focus:border-white/[0.18] focus:outline-none md:w-64"
                />
              </div>
              <span className="text-[11px] text-[#8A8A86]">
                Searches loaded designs
              </span>
            </div>
          </div>
        </header>

        {error ? (
          <div className="mb-8 rounded-[10px] border border-[#E89B9E]/30 bg-[#3A1F21]/30 px-4 py-3 text-[13px] text-[#E89B9E]">
            {error}
          </div>
        ) : null}

        {!loading && items.length === 0 ? (
          <div className="rounded-[10px] border border-white/[0.06] py-24 text-center text-[#8A8A86]">
            No designs yet. Be the first to publish.
          </div>
        ) : searching && filteredItems.length === 0 ? (
          <div className="rounded-[10px] border border-white/[0.06] py-24 text-center text-[#8A8A86]">
            No loaded designs match “{trimmedQuery}”.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredItems.map((item) => (
              <CommunityDesignCard key={item.id} summary={item} />
            ))}
          </div>
        )}

        {nextCursor && !searching ? (
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
