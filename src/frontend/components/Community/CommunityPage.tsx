import { useCallback, useEffect, useState } from "react";
import type { CommunityCardSummary } from "../../../shared/types";
import { api } from "../../lib/api";
import { CommunityDesignCard } from "./CommunityDesignCard";

type Sort = "recent" | "popular";

/**
 * Maps each card index to a 12-col bento span. Larger feature tiles every
 * fourth slot, smaller tiles in between, so the gallery reads asymmetrically.
 */
function spanFor(index: number): string {
  const m = index % 6;
  // Mix of 6/3/3 + 4/4/4 + 6/3/3 ... rows
  if (m === 0) return "col-span-12 md:col-span-6";
  if (m === 1) return "col-span-12 md:col-span-3";
  if (m === 2) return "col-span-12 md:col-span-3";
  if (m === 3) return "col-span-12 md:col-span-4";
  if (m === 4) return "col-span-12 md:col-span-4";
  return "col-span-12 md:col-span-4";
}

export function CommunityPage() {
  const [sort, setSort] = useState<Sort>("recent");
  const [items, setItems] = useState<CommunityCardSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (s: Sort) => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.listCommunity({ sort: s, limit: 24 });
        setItems(res.items);
        setNextCursor(res.nextCursor);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load(sort);
  }, [sort, load]);

  const loadMore = async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    setError(null);
    try {
      const res = await api.listCommunity({
        sort,
        limit: 24,
        cursor: nextCursor,
      });
      setItems((prev) => [...prev, ...res.items]);
      setNextCursor(res.nextCursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#0E0E10] text-[#E8E8E6]">
      <div className="max-w-[1400px] mx-auto px-8 py-10">
        <header className="mb-10 flex flex-col gap-4">
          <div className="flex items-baseline gap-6 flex-wrap">
            <h1
              className="text-5xl font-light tracking-tight"
              style={{ fontFamily: "ui-serif, Georgia, 'Times New Roman', serif" }}
            >
              Community
            </h1>
            <div className="text-[13px] text-[#8A8A86]">
              {loading ? "Loading…" : `${items.length} design${items.length === 1 ? "" : "s"}`}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <SortToggle value={sort} onChange={setSort} />
          </div>
        </header>

        {error ? (
          <div className="border border-[#E89B9E]/30 bg-[#3A1F21]/30 text-[#E89B9E] rounded-[10px] px-4 py-3 mb-6 text-[13px]">
            {error}
          </div>
        ) : null}

        {!loading && items.length === 0 ? (
          <div className="border border-white/[0.06] rounded-[10px] py-24 text-center text-[#8A8A86]">
            No designs yet. Be the first to publish.
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-6">
            {items.map((item, i) => (
              <div key={item.id} className={spanFor(i)}>
                <CommunityDesignCard summary={item} />
              </div>
            ))}
          </div>
        )}

        {nextCursor ? (
          <div className="mt-10 flex justify-center">
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="px-4 py-2 rounded-[6px] text-[13px] border border-white/[0.08] hover:border-white/[0.18] hover:bg-white/[0.02] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          </div>
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
  const base =
    "px-3 py-1.5 rounded-[6px] text-[13px] border transition-colors";
  const on = "border-white/[0.18] bg-white/[0.04] text-[#E8E8E6]";
  const off =
    "border-white/[0.06] text-[#8A8A86] hover:text-[#E8E8E6] hover:border-white/[0.12]";
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange("recent")}
        className={`${base} ${value === "recent" ? on : off}`}
      >
        Recent
      </button>
      <button
        type="button"
        onClick={() => onChange("popular")}
        className={`${base} ${value === "popular" ? on : off}`}
      >
        Popular
      </button>
    </div>
  );
}

export default CommunityPage;
