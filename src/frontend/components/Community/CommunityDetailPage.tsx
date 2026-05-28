import { useEffect, useMemo, useState } from "react";
import type { CommunityCardSummary } from "@statusline/shared/types";
import { useOsDetect, type DetectedOs } from "../../hooks/useOsDetect";
import { api } from "../../lib/api";
import { describeElements } from "../../lib/describeElements";
import { navigate } from "../../lib/navigate";
import { useDesignStore } from "../../store/designStore";
import { TurnstileWidget } from "../../lib/turnstile";
import { Link } from "../../router";
import { StaticPreview } from "../Preview/StaticPreview";
import {
  buildCommunityDetailMeta,
  canonicalUrl,
} from "../../seo";
import {
  clearRouteMetaOverride,
  setRouteMetaOverride,
} from "../Seo";

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

function formatPublishDate(ts: number): string {
  try {
    return new Date(ts).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return new Date(ts).toISOString().slice(0, 10);
  }
}

function osForInstaller(detected: DetectedOs): "mac" | "linux" | "windows" {
  return detected === "unknown" ? "mac" : detected;
}

export interface CommunityDetailPageProps {
  slug?: string;
}

function readSlug(): string {
  if (typeof window === "undefined") return "";
  const m = /^\/community\/([^/?#]+)/.exec(window.location.pathname);
  return m ? decodeURIComponent(m[1]!) : "";
}

export function CommunityDetailPage({ slug: slugProp }: CommunityDetailPageProps = {}) {
  const slug = slugProp ?? readSlug();
  const [data, setData] = useState<CommunityCardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [forking, setForking] = useState(false);
  const [forkToken, setForkToken] = useState<string | null>(null);
  const [related, setRelated] = useState<CommunityCardSummary[]>([]);
  const detectedOs = useOsDetect();
  const os = osForInstaller(detectedOs);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getCommunityBySlug(slug)
      .then((d) => {
        if (cancelled) return;
        setData(d);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Related designs — fetch the top popular and filter out the current slug.
  // We fetch 4 so that if the current page is in the top-3, we still surface 3.
  useEffect(() => {
    let cancelled = false;
    api
      .listCommunity({ sort: "popular", limit: 4 })
      .then((res) => {
        if (cancelled) return;
        const filtered = res.items.filter((d) => d.slug !== slug).slice(0, 3);
        setRelated(filtered);
      })
      .catch(() => {
        /* non-blocking */
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Push refined route meta (title/description/JSON-LD) once the design has
  // loaded so search engines / social previews / the document title pick up
  // the real design name + author + description. Clear on unmount so a stale
  // override doesn't leak onto subsequent navigations.
  useEffect(() => {
    if (!data) return;
    const canonicalPath = `/community/${encodeURIComponent(data.slug)}`;
    setRouteMetaOverride(
      canonicalPath,
      buildCommunityDetailMeta({
        slug: data.slug,
        name: data.name,
        description: data.description,
        author_name: data.author_name,
      }),
    );
    return () => clearRouteMetaOverride(canonicalPath);
  }, [data]);

  const bashCmd = useMemo(
    () => (data ? api.oneLiner(data.id, "mac", false) : ""),
    [data],
  );
  const psCmd = useMemo(
    () => (data ? api.oneLiner(data.id, "windows", false) : ""),
    [data],
  );

  const elementSummary = useMemo(() => {
    if (!data) return [] as string[];
    return describeElements(data.design.elements);
  }, [data]);

  const description = useMemo(() => {
    if (!data) return "";
    const raw = (data.description ?? "").trim();
    if (raw.length > 0) return raw;
    const author = (data.author_name ?? "").trim();
    return author.length > 0
      ? `A Claude Code statusline design by ${author}.`
      : "A community-published Claude Code statusline design.";
  }, [data]);

  const onFork = () => {
    if (!data) return;
    setForking(true);
    useDesignStore.getState().importDesign({
      ...data.design,
      name: `${data.name} (fork)`,
    });
    if (forkToken) {
      void api.forkBump(data.slug, forkToken).catch(() => {});
    }
    navigate("/builder");
  };

  return (
    <div className="min-h-screen w-full bg-[#0E0E10] text-[#E8E8E6]">
      <div className="mx-auto max-w-[1100px] px-6 py-10 md:px-8">
        {/* Breadcrumb nav — visible counterpart to the BreadcrumbList JSON-LD. */}
        <nav
          aria-label="Breadcrumb"
          className="mb-8 text-[12px] text-[#6F6F6B]"
        >
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link
                href="/"
                className="text-[#8A8A86] no-underline transition-colors hover:text-[#E8E8E6]"
              >
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link
                href="/community"
                className="text-[#8A8A86] no-underline transition-colors hover:text-[#E8E8E6]"
              >
                Community
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="truncate text-[#E8E8E6]" aria-current="page">
              {data?.name ?? slug}
            </li>
          </ol>
        </nav>

        {loading ? (
          <div className="text-[13px] text-[#8A8A86]">Loading…</div>
        ) : error ? (
          <div className="rounded-[10px] border border-[#E89B9E]/30 bg-[#3A1F21]/30 px-4 py-3 text-[13px] text-[#E89B9E]">
            {error}
          </div>
        ) : data ? (
          <article className="flex flex-col gap-10">
            {/* Header: name + author + publish date + description */}
            <header className="flex flex-col gap-4">
              <h1
                className="text-4xl font-light tracking-tight md:text-5xl"
                style={{ fontFamily: "ui-serif, Georgia, 'Times New Roman', serif" }}
              >
                {data.name}
              </h1>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[#8A8A86]">
                <span>
                  by{" "}
                  <span className="text-[#E8E8E6]">
                    {data.author_name?.trim() ? data.author_name : "anonymous"}
                  </span>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Published{" "}
                  <time dateTime={new Date(data.published_at).toISOString()}>
                    {formatPublishDate(data.published_at)}
                  </time>{" "}
                  <span className="text-[#6F6F6B]">
                    ({relativeTime(data.published_at)})
                  </span>
                </span>
              </div>

              <p className="max-w-[70ch] text-[15px] leading-relaxed text-[#A8A8A4]">
                {description}
              </p>

              {data.forked_from ? (
                <div className="text-[12px] text-[#6F6F6B]">
                  Forked from{" "}
                  <code className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[#A8A8A4]">
                    {data.forked_from}
                  </code>
                </div>
              ) : null}
            </header>

            {/* Live preview */}
            <section aria-label="Live terminal preview">
              <StaticPreview design={data.design} />
            </section>

            {/* Stats — machine-readable definition list */}
            <section aria-labelledby="stats-heading">
              <h2 id="stats-heading" className="sr-only">
                Statistics
              </h2>
              <dl className="grid grid-cols-3 gap-3 sm:max-w-[420px]">
                <Stat label="Installs" value={data.installs} />
                <Stat label="Forks" value={data.forks} />
                <Stat label="Views" value={data.views} />
              </dl>
            </section>

            {/* Element breakdown — keyword-rich crawlable body content */}
            {elementSummary.length > 0 ? (
              <section
                aria-labelledby="contains-heading"
                className="flex flex-col gap-3 border-t border-white/[0.06] pt-8"
              >
                <h2
                  id="contains-heading"
                  className="text-2xl font-light tracking-tight"
                  style={{ fontFamily: "ui-serif, Georgia, 'Times New Roman', serif" }}
                >
                  What this statusline shows
                </h2>
                <p className="max-w-[70ch] text-[14px] leading-relaxed text-[#A8A8A4]">
                  This Claude Code statusline contains{" "}
                  {elementSummary.length} field
                  {elementSummary.length === 1 ? "" : "s"}: it renders the{" "}
                  {joinWithAnd(elementSummary)} into a single status line for
                  the bottom of your terminal.
                </p>
                <ul className="flex flex-wrap gap-2">
                  {elementSummary.map((label) => (
                    <li
                      key={label}
                      className="rounded-[10px] border border-white/[0.06] bg-[#161618] px-3 py-1.5 text-[12px] text-[#E8E8E6]"
                    >
                      {label}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {/* Install — inline commands (bash + PowerShell) */}
            <section
              aria-labelledby="install-heading"
              className="flex flex-col gap-4 border-t border-white/[0.06] pt-8"
            >
              <h2
                id="install-heading"
                className="text-2xl font-light tracking-tight"
                style={{ fontFamily: "ui-serif, Georgia, 'Times New Roman', serif" }}
              >
                Install this statusline
              </h2>
              <p className="max-w-[70ch] text-[13px] text-[#8A8A86]">
                Run one of the commands below in your terminal. The installer
                merges the statusLine setting into your Claude{" "}
                <code className="rounded bg-white/[0.04] px-1 text-[12px] text-[#A8A8A4]">
                  settings.json
                </code>{" "}
                and preserves any other top-level keys. Detected OS:{" "}
                <span className="text-[#A8A8A4]">{detectedOs}</span>.
              </p>

              <CommandBlock
                label="macOS / Linux"
                command={bashCmd}
                preferred={os !== "windows"}
              />
              <CommandBlock
                label="Windows (PowerShell)"
                command={psCmd}
                preferred={os === "windows"}
              />

              <div className="mt-2 flex flex-col gap-3">
                <TurnstileWidget
                  size="invisible"
                  onToken={setForkToken}
                  onError={() => setForkToken(null)}
                />
                <button
                  type="button"
                  onClick={onFork}
                  disabled={forking}
                  className="w-fit rounded-[6px] border border-white/[0.12] px-4 py-2 text-[13px] transition-colors hover:border-white/[0.24] hover:bg-white/[0.03] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {forking ? "Forking…" : "Customize first → Fork to Builder"}
                </button>
              </div>
            </section>

            {/* Raw design JSON — collapsed for power users */}
            <section className="border-t border-white/[0.06] pt-8">
              <details className="group">
                <summary className="cursor-pointer text-[14px] text-[#A8A8A4] outline-none transition-colors hover:text-[#E8E8E6] focus-visible:rounded focus-visible:ring-2 focus-visible:ring-white/40">
                  Design JSON
                </summary>
                <pre className="mt-4 max-h-[420px] overflow-auto rounded-[10px] border border-white/[0.06] bg-black/40 p-4 font-mono text-[12px] text-[#A8A8A4]">
                  <code>{JSON.stringify(data.design, null, 2)}</code>
                </pre>
              </details>
            </section>

            {/* Related designs */}
            {related.length > 0 ? (
              <section
                aria-labelledby="related-heading"
                className="border-t border-white/[0.06] pt-8"
              >
                <h2
                  id="related-heading"
                  className="mb-5 text-2xl font-light tracking-tight"
                  style={{ fontFamily: "ui-serif, Georgia, 'Times New Roman', serif" }}
                >
                  Related Claude Code statuslines
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {related.map((r) => (
                    <RelatedCard key={r.id} summary={r} />
                  ))}
                </div>
              </section>
            ) : null}

            {/* Forward link to the guide — keyword-rich anchor text for both
                humans (learn the concepts) and crawlers (internal-link signal). */}
            <section className="border-t border-white/[0.06] pt-8">
              <p className="text-[14px] leading-relaxed text-[#A8A8A4]">
                <Link
                  href="/how-to-make-a-claude-code-statusline"
                  title="How to make a Claude Code statusline"
                  className="text-[#E8E8E6] underline decoration-white/20 underline-offset-[4px] hover:decoration-white/50"
                >
                  Learn how to make your own Claude Code statusline
                </Link>
                .
              </p>
            </section>

            {/* Hidden link for crawlers — gives the canonical URL inline. */}
            <link rel="canonical" href={canonicalUrl(`/community/${encodeURIComponent(data.slug)}`)} />
          </article>
        ) : null}
      </div>
    </div>
  );
}

function joinWithAnd(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

interface StatProps {
  label: string;
  value: number;
}

function Stat({ label, value }: StatProps) {
  return (
    <div className="rounded-[10px] border border-white/[0.06] bg-[#161618] px-4 py-3">
      <dt className="text-[11px] uppercase tracking-[0.12em] text-[#6F6F6B]">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-[18px] tabular-nums text-[#E8E8E6]">
        {value.toLocaleString()}
      </dd>
    </div>
  );
}

interface CommandBlockProps {
  label: string;
  command: string;
  preferred: boolean;
}

function CommandBlock({ label, command, preferred }: CommandBlockProps) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    if (!command) return;
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* no-op */
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-[#6F6F6B]">
        <span>{label}</span>
        {preferred ? (
          <span className="rounded-[4px] border border-white/[0.08] px-1.5 py-0.5 text-[10px] normal-case tracking-normal text-[#A8A8A4]">
            detected
          </span>
        ) : null}
      </div>
      <div className="flex items-stretch gap-2">
        <pre className="flex-1 overflow-x-auto rounded-[6px] border border-white/[0.06] bg-black/40 px-3 py-2 font-mono text-[12px] text-[#E8E8E6]">
          <code>{command}</code>
        </pre>
        <button
          type="button"
          onClick={onCopy}
          className="whitespace-nowrap rounded-[6px] border border-white/[0.08] px-3 py-2 text-[13px] transition-colors hover:border-white/[0.18] hover:bg-white/[0.02]"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

interface RelatedCardProps {
  summary: CommunityCardSummary;
}

function RelatedCard({ summary }: RelatedCardProps) {
  return (
    <Link
      href={`/community/${summary.slug}`}
      className="group flex flex-col overflow-hidden rounded-[10px] border border-white/[0.06] bg-[#161618] no-underline transition-colors hover:border-white/[0.14] hover:bg-[#19191B]"
    >
      <div className="flex h-[100px] items-center justify-center overflow-hidden border-b border-white/[0.06] bg-[#0E0E10] px-4">
        <div className="w-full overflow-hidden">
          <StaticPreview design={summary.design} />
        </div>
      </div>
      <div className="flex flex-col gap-1 p-4">
        <div className="truncate text-[13px] font-medium text-[#E8E8E6] group-hover:text-white">
          {summary.name}
        </div>
        <div className="text-[11px] text-[#8A8A86]">
          by {summary.author_name?.trim() ? summary.author_name : "anonymous"}
        </div>
      </div>
    </Link>
  );
}

export default CommunityDetailPage;
