import { useState } from "react";
import { GitForkIcon, EyeIcon, ArrowRightIcon } from "@phosphor-icons/react";
import type { CommunityCardSummary } from "../../../shared/types";
import { api } from "../../lib/api";
import { navigate } from "../../lib/navigate";
import { StaticPreview } from "../Preview/StaticPreview";

export interface CommunityDesignCardProps {
  summary: CommunityCardSummary;
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 0) return "just now";
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  const yr = Math.floor(day / 365);
  return `${yr}y ago`;
}

/**
 * Uniform community card. Every card has the same height regardless of
 * description length (description is line-clamped, footer is pinned with
 * mt-auto). Tightly aligned 4-row layout: preview / title / description /
 * footer (metadata + actions).
 */
export function CommunityDesignCard({ summary }: CommunityDesignCardProps) {
  const [forking, setForking] = useState(false);
  const [forkError, setForkError] = useState<string | null>(null);

  const onOpen = () => {
    navigate(`/community/${summary.slug}`);
  };

  const onFork = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setForking(true);
    setForkError(null);
    try {
      const { id } = await api.fork(summary.id);
      navigate(`/builder?fork=${id}`);
    } catch (err) {
      setForkError(err instanceof Error ? err.message : String(err));
      setForking(false);
    }
  };

  return (
    <article
      onClick={onOpen}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-[10px] border border-white/[0.06] bg-[#161618] transition-all hover:border-white/[0.14] hover:bg-[#19191B] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
    >
      {/* Preview frame — fixed aspect, centered, separated by a thin divider */}
      <div className="flex h-[120px] items-center justify-center overflow-hidden border-b border-white/[0.06] bg-[#0E0E10] px-5">
        <div className="w-full overflow-hidden">
          <StaticPreview design={summary.design} />
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="truncate text-[15px] font-medium tracking-tight text-[#E8E8E6]">
            {summary.name}
          </h3>
          <span className="shrink-0 text-[11px] text-[#6F6F6B]">
            {relativeTime(summary.published_at)}
          </span>
        </div>

        <div className="text-[12px] text-[#8A8A86]">
          by {summary.author_name ?? "anonymous"}
        </div>

        <p
          className="text-[13px] leading-relaxed text-[#8A8A86]"
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            minHeight: "2.6em",
          }}
        >
          {summary.description || " "}
        </p>

        {/* Footer pinned with mt-auto so cards line up vertically */}
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-white/[0.04] pt-3">
          <div className="flex items-center gap-3 text-[11px] text-[#6F6F6B]">
            <span className="inline-flex items-center gap-1">
              <GitForkIcon size={11} weight="bold" />
              {summary.forks}
            </span>
            <span className="inline-flex items-center gap-1">
              <EyeIcon size={11} weight="bold" />
              {summary.views}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onFork}
              disabled={forking}
              className="rounded-[6px] border border-white/[0.06] bg-[#1C1C1F] px-2.5 py-1 text-[11px] text-[#E8E8E6] transition-colors hover:border-white/[0.14] hover:bg-[#222226] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {forking ? "…" : "Fork"}
            </button>
            <span className="inline-flex items-center gap-1 text-[11px] text-[#8A8A86] transition-colors group-hover:text-[#E8E8E6]">
              Open
              <ArrowRightIcon size={11} weight="bold" />
            </span>
          </div>
        </div>

        {forkError ? (
          <div className="text-[11px] text-[#E89B9E]">{forkError}</div>
        ) : null}
      </div>
    </article>
  );
}

export default CommunityDesignCard;
