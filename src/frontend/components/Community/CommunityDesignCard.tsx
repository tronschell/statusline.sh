import { useState } from "react";
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

export function CommunityDesignCard({ summary }: CommunityDesignCardProps) {
  const [forking, setForking] = useState(false);
  const [forkError, setForkError] = useState<string | null>(null);

  const onOpen = () => {
    navigate(`/community/${summary.slug}`);
  };

  const onFork = async () => {
    setForking(true);
    setForkError(null);
    try {
      const { id } = await api.fork(summary.id);
      navigate(`/builder?fork=${id}`);
    } catch (e) {
      setForkError(e instanceof Error ? e.message : String(e));
      setForking(false);
    }
  };

  return (
    <article className="border border-white/[0.06] rounded-[10px] p-6 hover:border-white/[0.12] transition-colors flex flex-col gap-4 bg-[#0E0E10]">
      <div className="overflow-hidden">
        <StaticPreview design={summary.design} />
      </div>

      <div className="flex flex-col gap-1.5">
        <h3 className="text-xl font-semibold tracking-tight text-[#E8E8E6] truncate">
          {summary.name}
        </h3>
        <div className="text-[13px] text-[#8A8A86]">
          {summary.author_name ?? "anonymous"}
        </div>
        {summary.description ? (
          <p
            className="text-[13px] text-[#A8A8A4] mt-1"
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {summary.description}
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-4 text-[12px] text-[#6F6F6B] mt-auto">
        <span>{summary.forks} fork{summary.forks === 1 ? "" : "s"}</span>
        <span>·</span>
        <span>{summary.views} view{summary.views === 1 ? "" : "s"}</span>
        <span>·</span>
        <span>{relativeTime(summary.published_at)}</span>
      </div>

      <div className="flex items-center gap-2 mt-1">
        <button
          type="button"
          onClick={onOpen}
          className="px-3 py-1.5 rounded-[6px] text-[13px] border border-white/[0.08] hover:border-white/[0.18] hover:bg-white/[0.02] transition-colors text-[#E8E8E6]"
        >
          Open →
        </button>
        <button
          type="button"
          onClick={onFork}
          disabled={forking}
          className="px-3 py-1.5 rounded-[6px] text-[13px] border border-white/[0.08] hover:border-white/[0.18] hover:bg-white/[0.02] transition-colors text-[#E8E8E6] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {forking ? "Forking…" : "Fork to Builder"}
        </button>
        {forkError ? (
          <span className="text-[11px] text-[#E89B9E]">{forkError}</span>
        ) : null}
      </div>
    </article>
  );
}

export default CommunityDesignCard;
