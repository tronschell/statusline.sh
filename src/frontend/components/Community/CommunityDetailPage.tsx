import { useEffect, useMemo, useState } from "react";
import type { CommunityCardSummary } from "@statusline/shared/types";
import { useOsDetect, type DetectedOs } from "../../hooks/useOsDetect";
import { api } from "../../lib/api";
import { navigate } from "../../lib/navigate";
import { useDesignStore } from "../../store/designStore";
import { TurnstileWidget } from "../../lib/turnstile";
import { StaticPreview } from "../Preview/StaticPreview";

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
  const [copied, setCopied] = useState(false);
  const [forkToken, setForkToken] = useState<string | null>(null);
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

  const oneLiner = useMemo(() => {
    if (!data) return "";
    return api.oneLiner(data.id, os, false);
  }, [data, os]);

  const onCopy = async () => {
    if (!oneLiner) return;
    try {
      await navigator.clipboard.writeText(oneLiner);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* no-op */
    }
  };

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
      <div className="max-w-[1100px] mx-auto px-8 py-10">
        <button
          type="button"
          onClick={() => navigate("/community")}
          className="text-[13px] text-[#8A8A86] hover:text-[#E8E8E6] transition-colors mb-8"
        >
          ← Back to community
        </button>

        {loading ? (
          <div className="text-[13px] text-[#8A8A86]">Loading…</div>
        ) : error ? (
          <div className="border border-[#E89B9E]/30 bg-[#3A1F21]/30 text-[#E89B9E] rounded-[10px] px-4 py-3 text-[13px]">
            {error}
          </div>
        ) : data ? (
          <div className="flex flex-col gap-10">
            <section>
              <StaticPreview design={data.design} />
            </section>

            <section className="flex flex-col gap-3">
              <h1
                className="text-4xl font-light tracking-tight"
                style={{ fontFamily: "ui-serif, Georgia, 'Times New Roman', serif" }}
              >
                {data.name}
              </h1>
              <div className="text-[13px] text-[#8A8A86]">
                by {data.author_name ?? "anonymous"}
              </div>
              {data.description ? (
                <p className="text-[14px] text-[#A8A8A4] leading-relaxed max-w-[70ch]">
                  {data.description}
                </p>
              ) : null}

              <div className="flex items-center gap-4 text-[12px] text-[#6F6F6B] mt-2">
                <span>{data.forks} fork{data.forks === 1 ? "" : "s"}</span>
                <span>·</span>
                <span>{data.views} view{data.views === 1 ? "" : "s"}</span>
                <span>·</span>
                <span>published {relativeTime(data.published_at)}</span>
              </div>

              {data.forked_from ? (
                <div className="text-[12px] text-[#6F6F6B] mt-1">
                  Forked from{" "}
                  <code className="text-[#A8A8A4] bg-white/[0.04] px-1.5 py-0.5 rounded">
                    {data.forked_from}
                  </code>
                </div>
              ) : null}
            </section>

            <section className="flex flex-col gap-4 border-t border-white/[0.06] pt-8">
              <h2
                className="text-2xl font-light tracking-tight"
                style={{ fontFamily: "ui-serif, Georgia, 'Times New Roman', serif" }}
              >
                Install this statusline
              </h2>
              <p className="text-[13px] text-[#8A8A86] max-w-[70ch]">
                Paste this one-liner into your terminal. Detected OS:{" "}
                <span className="text-[#A8A8A4]">{detectedOs}</span>.
              </p>
              <div className="flex items-stretch gap-2 max-w-full">
                <pre className="flex-1 bg-black/40 border border-white/[0.06] rounded-[6px] px-3 py-2 font-mono text-[12px] text-[#E8E8E6] overflow-x-auto">
                  <code>{oneLiner}</code>
                </pre>
                <button
                  type="button"
                  onClick={onCopy}
                  className="px-3 py-2 rounded-[6px] text-[13px] border border-white/[0.08] hover:border-white/[0.18] hover:bg-white/[0.02] transition-colors whitespace-nowrap"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>

              <div className="mt-4 flex flex-col gap-3">
                <TurnstileWidget
                  size="invisible"
                  onToken={setForkToken}
                  onError={() => setForkToken(null)}
                />
                <button
                  type="button"
                  onClick={onFork}
                  disabled={forking}
                  className="w-fit px-4 py-2 rounded-[6px] text-[13px] border border-white/[0.12] hover:border-white/[0.24] hover:bg-white/[0.03] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {forking ? "Forking…" : "Customize first → Fork to Builder"}
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default CommunityDetailPage;
