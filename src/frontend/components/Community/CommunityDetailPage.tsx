import { useEffect, useMemo, useState } from "react";
import { Check, LinkSimple, XLogo } from "@phosphor-icons/react";
import type { CommunityCardSummary } from "@statusline/shared/types";
import { useOsDetect, type DetectedOs } from "../../hooks/useOsDetect";
import { api } from "../../lib/api";
import { describeElements } from "../../lib/describeElements";
import { navigate } from "../../lib/navigate";
import { useDesignStore } from "../../store/designStore";
import { TurnstileWidget } from "../../lib/turnstile";
import { Link } from "../../router";
import { Avatar, VerifiedBadge } from "../Account/ui";
import { CardGrid, CommunityDesignCard, relativeTime } from "./CommunityDesignCard";
import { DonateButton } from "../Account/ProfilePage";
import { StaticPreview } from "../Preview/StaticPreview";
import {
  buildCommunityDetailMeta,
  canonicalUrl,
} from "../../seo";
import {
  clearRouteMetaOverride,
  setRouteMetaOverride,
} from "../Seo";

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
  // We request 4 so that if the current page is itself in the top-3, we still
  // surface 3 alternatives.
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
        /* non-blocking — related designs are nice-to-have, not load-blocking */
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
        published_at: data.published_at,
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
      <div className="mx-auto max-w-[1100px] px-6 pb-28 pt-10 md:px-8">
        {/* Breadcrumb nav — visible counterpart to the BreadcrumbList JSON-LD
            emitted by `buildCommunityDetailMeta`. Mirrors the same trail of
            Home → Community → {design name}. */}
        <nav
          aria-label="Breadcrumb"
          className="mb-10 text-[12px] text-[#6F6F6B] md:mb-14"
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
          <div aria-busy="true" className="animate-pulse">
            <span className="sr-only">Loading…</span>
            <div className="h-14 w-2/3 rounded bg-white/[0.05] md:h-20" />
            <div className="mt-6 h-4 w-1/3 rounded bg-white/[0.04]" />
            <div className="mt-10 h-[110px] rounded-[10px] bg-white/[0.04]" />
          </div>
        ) : error ? (
          <div role="alert" className="border-l-2 border-[#E89B9E]/60 py-1 pl-4">
            <p className="text-[14px] text-[#E89B9E]">{error}</p>
            <p className="mt-2 text-[13px] text-[#8A8A86]">
              <Link
                href="/community"
                className="text-[#E8E8E6] underline decoration-white/20 underline-offset-[4px] hover:decoration-white/50"
              >
                Back to the community gallery
              </Link>
            </p>
          </div>
        ) : data ? (
          <article className="flex flex-col">
            {/* Header: name + author + publish date + description */}
            <header className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between md:gap-12">
              <div className="min-w-0">
                <h1
                  className="font-serif text-[44px] leading-[1.02] tracking-tight md:text-[68px]"
                  style={{ fontFamily: "var(--font-serif, 'Instrument Serif', Georgia, serif)" }}
                >
                  {data.name}
                </h1>

                <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[14px] text-[#8A8A86]">
                  <span className="inline-flex items-center gap-2">
                    {data.owner ? (
                      <>
                        <Avatar
                          name={data.owner.display_name || data.owner.username}
                          url={data.owner.avatar_url || undefined}
                          size={22}
                        />
                        <Link
                          href={`/u/${data.owner.username}`}
                          className="text-[#E8E8E6] no-underline hover:underline"
                        >
                          @{data.owner.username}
                        </Link>
                        {data.owner.verified ? <VerifiedBadge size={15} /> : null}
                      </>
                    ) : (
                      <>
                        by{" "}
                        <span className="text-[#E8E8E6]">
                          {data.author_name?.trim() ? data.author_name : "anonymous"}
                        </span>
                      </>
                    )}
                  </span>
                  <span aria-hidden="true" className="hidden sm:inline">·</span>
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

                <p className="mt-6 max-w-[62ch] text-[17px] leading-relaxed text-[#B4B4B0]">
                  {description}
                </p>

                {data.forked_from ? (
                  <p className="mt-4 text-[12px] text-[#6F6F6B]">
                    Forked from{" "}
                    <code className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[#A8A8A4]">
                      {data.forked_from}
                    </code>
                  </p>
                ) : null}
              </div>

              {data.owner?.donation_url ? (
                <div className="shrink-0">
                  <DonateButton url={data.owner.donation_url} />
                </div>
              ) : null}
            </header>

            {/* Live preview — the one framed object on the page. */}
            <section aria-label="Live terminal preview" className="mt-12 md:mt-14">
              <StaticPreview design={data.design} />
            </section>

            {/* Stats (machine-readable definition list) + share actions */}
            <section
              aria-labelledby="stats-heading"
              className="mt-5 flex flex-wrap items-center justify-between gap-x-8 gap-y-3"
            >
              <h2 id="stats-heading" className="sr-only">
                Statistics
              </h2>
              <dl className="flex gap-x-7">
                <Stat label="Installs" value={data.installs} />
                <Stat label="Forks" value={data.forks} />
                <Stat label="Views" value={data.views} />
              </dl>
              <ShareCluster
                url={canonicalUrl(`/community/${encodeURIComponent(data.slug)}`)}
                shareText={`${data.name} by ${
                  data.author_name?.trim() ? data.author_name : "anonymous"
                } — a Claude Code statusline`}
              />
            </section>

            {/* Install — inline commands (bash + PowerShell) so a user can copy
                without opening the drawer. */}
            <Section id="install-heading" title="Install this statusline">
              <p className="max-w-[62ch] text-[14px] leading-relaxed text-[#8A8A86]">
                Run one of the commands below in your terminal. The installer
                merges the statusLine setting into your Claude{" "}
                <code className="rounded bg-white/[0.04] px-1 text-[12px] text-[#A8A8A4]">
                  settings.json
                </code>{" "}
                and preserves any other top-level keys. Detected OS:{" "}
                <span className="text-[#A8A8A4]">{detectedOs}</span>.
              </p>

              <div className="mt-6 flex flex-col gap-6">
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
              </div>

              <div className="mt-8 flex flex-col gap-3">
                <TurnstileWidget
                  onToken={setForkToken}
                  onError={() => setForkToken(null)}
                />
                <button
                  type="button"
                  onClick={onFork}
                  disabled={forking}
                  className="w-fit rounded-[6px] bg-[#E8E8E6] px-4 py-2 text-[13px] font-medium text-[#0E0E10] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {forking ? "Forking…" : "Customize first → Fork to Builder"}
                </button>
              </div>
            </Section>

            {/* Element breakdown — keyword-rich crawlable body content. The
                list of distinct elements puts Claude Code statusline keyword
                variants into the page body (git branch, context usage bar,
                session cost, etc.) instead of being trapped inside the ANSI
                preview SVG-style element. */}
            {elementSummary.length > 0 ? (
              <Section id="contains-heading" title="What this statusline shows">
                <p className="max-w-[62ch] text-[14px] leading-relaxed text-[#8A8A86]">
                  This Claude Code statusline contains{" "}
                  {elementSummary.length} field
                  {elementSummary.length === 1 ? "" : "s"}: it renders the{" "}
                  {joinWithAnd(elementSummary)} into a single status line for
                  the bottom of your terminal.
                </p>
                <ul className="mt-5 border-t border-white/[0.06] sm:columns-2 sm:gap-x-10">
                  {elementSummary.map((label) => (
                    <li
                      key={label}
                      className="break-inside-avoid border-b border-white/[0.06] py-2 text-[13px] text-[#E8E8E6]"
                    >
                      {label}
                    </li>
                  ))}
                </ul>
              </Section>
            ) : null}

            {/* Raw design JSON — collapsed for power users who want to inspect
                or hand-edit the underlying schema. */}
            <Section id="json-heading" title="Design JSON">
              <details className="group">
                <summary className="cursor-pointer text-[14px] text-[#A8A8A4] outline-none transition-colors hover:text-[#E8E8E6] focus-visible:rounded focus-visible:ring-2 focus-visible:ring-white/40">
                  Show the raw design
                </summary>
                <pre className="mt-4 max-h-[420px] overflow-auto rounded-[10px] border border-white/[0.06] bg-[#0A0A0B] p-4 font-mono text-[12px] text-[#A8A8A4]">
                  <code>{JSON.stringify(data.design, null, 2)}</code>
                </pre>
              </details>
            </Section>

            {/* Related designs — top 3 popular, excluding the current slug. */}
            {related.length > 0 ? (
              <section
                aria-labelledby="related-heading"
                className="mt-16 border-t border-white/[0.07] pt-10 md:mt-20"
              >
                <h2
                  id="related-heading"
                  className="mb-8 font-serif text-[28px] leading-tight tracking-tight"
                >
                  Related Claude Code statuslines
                </h2>
                <CardGrid>
                  {related.map((r) => (
                    <CommunityDesignCard key={r.id} summary={r} />
                  ))}
                </CardGrid>
              </section>
            ) : null}

            {/* Forward link to the guide — keyword-rich anchor text for both
                humans (learn the concepts) and crawlers (internal-link signal). */}
            <p className="mt-16 border-t border-white/[0.07] pt-8 text-[14px] leading-relaxed text-[#A8A8A4]">
              <Link
                href="/how-to-make-a-claude-code-statusline"
                title="How to make a Claude Code statusline"
                className="text-[#E8E8E6] underline decoration-white/20 underline-offset-[4px] hover:decoration-white/50"
              >
                Learn how to make your own Claude Code statusline
              </Link>
              .
            </p>

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

/** Editorial section: serif heading in a left rail on desktop, content to the right, hairline above. */
function Section({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="mt-14 grid gap-x-12 gap-y-5 border-t border-white/[0.07] pt-9 md:mt-16 md:grid-cols-[220px_minmax(0,1fr)]"
    >
      <h2 id={id} className="font-serif text-[26px] leading-tight tracking-tight">
        {title}
      </h2>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

interface StatProps {
  label: string;
  value: number;
}

function Stat({ label, value }: StatProps) {
  return (
    <div className="flex items-baseline gap-2">
      <dd className="order-1 font-mono text-[15px] tabular-nums text-[#E8E8E6]">
        {value.toLocaleString()}
      </dd>
      <dt className="order-2 text-[12px] text-[#6F6F6B]">{label.toLowerCase()}</dt>
    </div>
  );
}

interface ShareClusterProps {
  url: string;
  shareText: string;
}

const textAction =
  "inline-flex items-center gap-1.5 text-[13px] text-[#A8A8A4] no-underline transition-colors hover:text-[#E8E8E6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:rounded-[4px]";

function ShareCluster({ url, shareText }: ShareClusterProps) {
  const [copied, setCopied] = useState(false);
  const onCopyLink = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* no-op */
    }
  };
  const tweetHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    shareText,
  )}&url=${encodeURIComponent(url)}`;

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
      <button
        type="button"
        onClick={onCopyLink}
        aria-label="Copy link to this statusline"
        className={textAction}
      >
        {copied ? (
          <>
            <Check size={13} weight="bold" />
            Copied
          </>
        ) : (
          <>
            <LinkSimple size={13} weight="bold" />
            Copy link
          </>
        )}
      </button>
      <a
        href={tweetHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on X"
        className={textAction}
      >
        <XLogo size={13} weight="bold" />
        Share on X
      </a>
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
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3 text-[12px] text-[#8A8A86]">
        <span>
          {label}
          {preferred ? <span className="text-[#6F6F6B]"> · detected</span> : null}
        </span>
        <button
          type="button"
          onClick={onCopy}
          className="text-[13px] text-[#A8A8A4] underline decoration-white/20 underline-offset-[4px] transition-colors hover:text-[#E8E8E6] hover:decoration-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto rounded-[10px] border border-white/[0.06] bg-[#0A0A0B] px-4 py-3.5 font-mono text-[12px] text-[#E8E8E6]">
        <code>{command}</code>
      </pre>
    </div>
  );
}

export default CommunityDetailPage;
