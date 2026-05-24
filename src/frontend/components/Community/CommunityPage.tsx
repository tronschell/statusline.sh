import { useCallback, useEffect, useState } from "react";
import type { CommunityCardSummary } from "@statusline/shared/types";
import { api } from "../../lib/api";
import { CommunityDesignCard } from "./CommunityDesignCard";

type Sort = "recent" | "popular";

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
          </div>

          <div className="flex items-center justify-between gap-6 md:flex-col md:items-end">
            <div className="text-[13px] text-[#8A8A86]">
              {loading
                ? "Loading…"
                : `${items.length} design${items.length === 1 ? "" : "s"}`}
            </div>
            <SortToggle value={sort} onChange={setSort} />
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
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <CommunityDesignCard key={item.id} summary={item} />
            ))}
          </div>
        )}

        {nextCursor ? (
          <div className="mt-12 flex justify-center">
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="rounded-[6px] border border-white/[0.08] px-4 py-2 text-[13px] text-[#E8E8E6] transition-colors hover:border-white/[0.18] hover:bg-white/[0.02] disabled:cursor-not-allowed disabled:opacity-50"
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
