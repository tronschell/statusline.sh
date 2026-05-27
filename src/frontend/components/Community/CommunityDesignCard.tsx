import { GitForkIcon, EyeIcon, ArrowRightIcon, DownloadSimpleIcon } from "@phosphor-icons/react";
import type { CommunityCardSummary } from "@statusline/shared/types";
import { Link } from "../../router";
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
 *
 * The Fork link routes to the detail page rather than forking inline so we
 * can gate the bump-counter call with Turnstile in one place. Rendering a
 * Turnstile widget per card would look awful and inflate iframe count.
 */
export function CommunityDesignCard({ summary }: CommunityDesignCardProps) {
  const detailHref = `/community/${summary.slug}`;

  return (
    <article
      className="group flex h-full flex-col overflow-hidden rounded-[10px] border border-white/[0.06] bg-[#161618] transition-all hover:border-white/[0.14] hover:bg-[#19191B]"
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
            <Link
              href={detailHref}
              className="text-[#E8E8E6] no-underline outline-none transition-colors hover:text-white focus-visible:rounded-[4px] focus-visible:ring-2 focus-visible:ring-white/40"
            >
              {summary.name}
            </Link>
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
            <span className="inline-flex items-center gap-1" title="Installs">
              <DownloadSimpleIcon size={11} weight="bold" />
              {summary.installs}
            </span>
            <span className="inline-flex items-center gap-1" title="Forks">
              <GitForkIcon size={11} weight="bold" />
              {summary.forks}
            </span>
            <span className="inline-flex items-center gap-1" title="Views">
              <EyeIcon size={11} weight="bold" />
              {summary.views}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={detailHref}
              className="inline-flex items-center gap-1.5 rounded-[6px] border border-white/[0.06] bg-[#1C1C1F] px-2.5 py-1 text-[11px] text-[#E8E8E6] no-underline transition-colors hover:border-white/[0.14] hover:bg-[#222226] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              <GitForkIcon size={12} weight="bold" />
              Fork
            </Link>
            <Link
              href={detailHref}
              className="inline-flex items-center gap-1 text-[11px] text-[#8A8A86] no-underline transition-colors hover:text-[#E8E8E6] group-hover:text-[#E8E8E6]"
            >
              Open
              <ArrowRightIcon size={11} weight="bold" />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

export default CommunityDesignCard;
