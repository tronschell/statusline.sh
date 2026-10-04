import { useMemo, useRef, type ReactNode } from "react";
import { ArrowRightIcon, DownloadSimpleIcon, EyeIcon, GitForkIcon } from "@phosphor-icons/react";
import { renderToAnsi } from "@statusline/shared/compiler/interpret";
import { DEFAULT_MOCK_STDIN } from "@statusline/shared/mockStdin";
import type { CommunityCardSummary, Design } from "@statusline/shared/types";
import { Link } from "../../router";
import { VerifiedBadge } from "../Account/ui";
import { AnsiToHtml } from "../Preview/AnsiToHtml";
import { CardGlow, randomPastelPair, useCardActive } from "./CardGlow";

export interface CommunityDesignCardProps {
  summary: CommunityCardSummary;
  /** Hide the creator line (e.g. on that creator's own profile). */
  hideCreator?: boolean;
}

export function relativeTime(ts: number): string {
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
 * The rendered statusline on a terminal-coloured panel. Fixed height so every
 * card in a grid lines up; multi-line designs show in full, and long lines fade
 * out on the right edge instead of being cut mid-glyph.
 */
function PreviewStrip({ design }: { design: Design }) {
  const ansi = useMemo(() => {
    try {
      return renderToAnsi(design, DEFAULT_MOCK_STDIN);
    } catch {
      return "[render error]";
    }
  }, [design]);
  return (
    <div className="flex h-[132px] items-center overflow-hidden border-b border-white/[0.06] bg-[#0A0A0B] px-5 font-mono text-[13px] leading-[1.5] whitespace-nowrap text-[#E8E8E6] [mask-image:linear-gradient(to_right,#000_calc(100%-44px),transparent)]">
      <div>
        <AnsiToHtml ansi={ansi} />
      </div>
    </div>
  );
}

export function Creator({ summary }: { summary: CommunityCardSummary }) {
  if (!summary.owner) {
    return <span>{summary.author_name?.trim() ? summary.author_name : "anonymous"}</span>;
  }
  return (
    <span className="inline-flex items-center gap-1">
      <Link
        href={`/u/${summary.owner.username}`}
        className="text-[#C9C9C5] no-underline hover:text-white hover:underline"
      >
        @{summary.owner.username}
      </Link>
      {summary.owner.verified ? <VerifiedBadge size={15} /> : null}
    </span>
  );
}

function Stat({ icon, value, label }: { icon: ReactNode; value: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5" title={label}>
      {icon}
      <span className="sr-only">{label}: </span>
      {value.toLocaleString()}
    </span>
  );
}

const linkFocus =
  "outline-none focus-visible:after:ring-2 focus-visible:after:ring-white/40 focus-visible:after:rounded-[10px]";

/**
 * Community card. The whole card is one link to the detail page (stretched
 * from the title); the creator link sits above it. There is deliberately no
 * separate Fork button: Fork lives on the detail page, where the bump-counter
 * call is Turnstile-gated in one place, so a card button only duplicated "Open".
 */
export function CommunityDesignCard({ summary, hideCreator = false }: CommunityDesignCardProps) {
  const detailHref = `/community/${summary.slug}`;
  const ref = useRef<HTMLDivElement>(null);
  const active = useCardActive(ref);
  // A fresh random pastel each time the card lights up.
  const glow = useMemo(() => (active ? randomPastelPair() : null), [active]);
  return (
    <div ref={ref} className={`relative isolate h-full ${glow ? "z-10" : ""}`}>
      {glow ? <CardGlow colors={glow} /> : null}
    <article className="group relative flex h-full flex-col overflow-hidden rounded-[10px] border border-white/[0.07] bg-[#131315] transition-colors hover:border-white/[0.2] hover:bg-[#161618]">
      <PreviewStrip design={summary.design} />
      <div className="flex flex-1 flex-col gap-2 p-5">
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="min-w-0 truncate text-[16px] font-medium leading-snug text-[#F2F2F0]">
            <Link
              href={detailHref}
              className={`text-[#F2F2F0] no-underline after:absolute after:inset-0 after:content-[''] ${linkFocus}`}
            >
              {summary.name}
            </Link>
          </h3>
          <span className="shrink-0 text-[12px] text-[#6F6F6B]">{relativeTime(summary.published_at)}</span>
        </div>
        <p className="flex flex-wrap items-center gap-x-2 text-[13px] text-[#8A8A86]">
          {hideCreator ? null : (
            <span className="relative z-10">
              by <Creator summary={summary} />
            </span>
          )}
          {summary.featured ? (
            <span className="text-[#8FB8DA]">{hideCreator ? "" : "· "}Featured</span>
          ) : null}
        </p>
        {summary.description ? (
          <p className="line-clamp-2 text-[14px] leading-relaxed text-[#8A8A86]">{summary.description}</p>
        ) : null}
        <div className="mt-auto flex items-center justify-between pt-4 font-mono text-[12px] tabular-nums text-[#6F6F6B]">
          <div className="flex items-center gap-4">
            <Stat icon={<DownloadSimpleIcon size={13} weight="bold" />} value={summary.installs} label="Installs" />
            <Stat icon={<GitForkIcon size={13} weight="bold" />} value={summary.forks} label="Forks" />
            <Stat icon={<EyeIcon size={13} weight="bold" />} value={summary.views} label="Views" />
          </div>
          <ArrowRightIcon
            size={14}
            weight="bold"
            aria-hidden="true"
            className="text-[#6F6F6B] transition-transform group-hover:translate-x-0.5 group-hover:text-[#E8E8E6]"
          />
        </div>
      </div>
    </article>
    </div>
  );
}

/** Responsive card grid shared by the gallery, featured strip, related and profile pages. */
export function CardGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

/** Skeleton cards shown while the first page loads; mirrors the card layout. */
export function CardSkeletonRows({ count = 6 }: { count?: number }) {
  return (
    <div aria-hidden="true" className="animate-pulse">
      <CardGrid>
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="overflow-hidden rounded-[10px] border border-white/[0.07] bg-[#131315]">
            <div className="h-[132px] border-b border-white/[0.06] bg-white/[0.03]" />
            <div className="flex flex-col gap-3 p-5">
              <div className="h-4 w-2/3 rounded bg-white/[0.06]" />
              <div className="h-3 w-1/3 rounded bg-white/[0.04]" />
              <div className="h-3 w-5/6 rounded bg-white/[0.04]" />
            </div>
          </div>
        ))}
      </CardGrid>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="border-t border-white/[0.07] py-20 md:py-28">
      <p className="font-serif text-[28px] leading-tight tracking-tight text-[#E8E8E6]">{title}</p>
      {children ? <p className="mt-3 text-[14px] text-[#8A8A86]">{children}</p> : null}
    </div>
  );
}

export default CommunityDesignCard;
