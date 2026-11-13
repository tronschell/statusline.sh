import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, Clock, Copy, DownloadSimple, X } from "@phosphor-icons/react";
import { renderToAnsi } from "@statusline/shared/compiler/interpret";
import { DEFAULT_MOCK_STDIN } from "@statusline/shared/mockStdin";
import type { Design } from "@statusline/shared/types";
import { api } from "../../lib/api";
import { ApiError } from "../../lib/accountApi";
import { ACCOUNTS_ENABLED } from "../../lib/config";
import { TurnstileWidget } from "../../lib/turnstile";
import { useDesignStore } from "../../store/designStore";
import { exportDesignAsJson } from "../../lib/exportDesign";
import Modal from "../Modal/Modal";
import { useAuthStore } from "../../store/authStore";
import { LinkBtn } from "../Account/ui";
import { AnsiToHtml } from "../Preview/AnsiToHtml";
import { relativeTime } from "./CommunityDesignCard";

export interface PublishDialogProps {
  designName: string;
  isOpen: boolean;
  onClose(): void;
  /** Called after a successful publish with the assigned slug. */
  onPublished?(slug: string): void;
}

interface DailyLimit {
  wait: { long: string; short: string };
  upgrade: boolean;
}

interface PublishedTwin {
  slug: string;
  name: string;
  author_name: string;
  published_at: number;
}

const NAME_MAX = 60;
const AUTHOR_MAX = 40;
const DESCRIPTION_MAX = 200;
const COUNT_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const labelClass = "text-xs text-[#8A8A86]";
const primaryClass =
  "h-11 rounded-[6px] border border-[#E8E8E6] bg-[#E8E8E6] text-[13px] font-semibold text-[#0E0E10] transition-transform hover:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100";

function countWord(n: number): string {
  return COUNT_WORDS[n] ?? String(n);
}

function waitLabels(seconds: number): { long: string; short: string } {
  const unit = seconds < 3600 ? "minute" : "hour";
  const n = Math.ceil(seconds / (unit === "hour" ? 3600 : 60));
  return { long: `${n} ${unit}${n === 1 ? "" : "s"}`, short: `${n}${unit[0]}` };
}

function DesignPreview({ design }: { design: Design }) {
  const ansi = useMemo(() => {
    try {
      return renderToAnsi(design, DEFAULT_MOCK_STDIN);
    } catch {
      return "[render error]";
    }
  }, [design]);
  return (
    <div className="overflow-hidden bg-[#0E0E10] px-5 py-[18px] text-[12.5px] leading-[1.75]">
      <AnsiToHtml ansi={ansi} />
    </div>
  );
}

export default function PublishDialog({
  designName,
  isOpen,
  onClose,
  onPublished,
}: PublishDialogProps) {
  const design = useDesignStore((s) => s.design);
  const me = useAuthStore((s) => s.me);
  const [name, setName] = useState(designName);
  const [author, setAuthor] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState<DailyLimit | null>(null);
  const [twin, setTwin] = useState<PublishedTwin | null>(null);
  const [publishedSlug, setPublishedSlug] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(designName);
      setError(null);
      setLimit(null);
      setTwin(null);
      setBusy(false);
      setPublishedSlug(null);
      setCopied(false);
      setToken(null);
    }
  }, [isOpen, designName]);

  const publishName = name.trim() || designName;
  const authorName = me ? me.user.display_name : author.trim();
  const communityPath = `/community/${publishedSlug}`;

  async function onPublish() {
    if (busy || limit || twin) return;
    if (!me && !token) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.publish(
        {
          design,
          name: publishName,
          // Signed in: the Worker fills this from the account's display name.
          author_name: authorName.slice(0, AUTHOR_MAX),
          description: description.trim(),
          ...(me ? {} : { turnstile_token: token! }),
        },
        { signedIn: Boolean(me) },
      );
      setPublishedSlug(res.slug);
      if (
        typeof res.id === "string" && res.id &&
        typeof res.slug === "string" && res.slug
      ) {
        try {
          const w = window as unknown as { gtag?: (...args: unknown[]) => void };
          w.gtag?.("event", "publish_success", {
            element_count: design.elements.length,
          });
        } catch {
          // A telemetry failure must not turn a successful publish into an error.
        }
      }
      onPublished?.(res.slug);
    } catch (e) {
      const body = e instanceof ApiError ? e.body : {};
      if (typeof body.retry_after === "number") {
        setLimit({ wait: waitLabels(body.retry_after), upgrade: body.upgrade === true });
      } else if (typeof body.slug === "string" && typeof body.name === "string") {
        setTwin(body as unknown as PublishedTwin);
      } else {
        setError((e as Error).message || "Failed to publish");
      }
    } finally {
      setBusy(false);
    }
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${communityPath}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked
    }
  }

  const freePerDay = me?.plan.freePublishesPerDay ?? 1;
  const proPerDay = countWord(me?.plan.proPublishesPerDay ?? 5);
  const allowance = limit?.upgrade
    ? `Free accounts can publish ${countWord(freePerDay)} design${freePerDay === 1 ? "" : "s"} a day.`
    : `Pro accounts can publish ${proPerDay} a day.`;
  const verdict = limit
    ? {
        icon: <Clock size={20} weight="bold" className="mt-px shrink-0 text-[#D8B870]" />,
        title: limit.upgrade ? "You've already published today" : `You've published ${proPerDay} designs today`,
        body: `${allowance} This one can go up in ${limit.wait.long}, and it stays saved in the builder until then.`,
      }
    : twin
      ? {
          icon: <Copy size={20} weight="bold" className="mt-px shrink-0 text-[#8FB8DA]" />,
          title: "This design is already in the community",
          body: "It matches a published statusline element for element. A new name isn't enough: change the design itself to publish your own version.",
        }
      : null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Publish to community" widthClass="max-w-[480px]" bare>
      <form
        className="flex flex-col gap-[22px] px-7 pt-4 pb-7 text-[#E8E8E6]"
        onSubmit={(e) => {
          e.preventDefault();
          void onPublish();
        }}
      >
        <div className="flex items-center justify-between">
          {publishedSlug ? (
            <h2 className="flex items-center gap-2 text-[13px] font-medium text-[#9CC09F]">
              <Check size={14} weight="bold" />
              Published to community
            </h2>
          ) : (
            <h2 className="text-[13px] font-medium text-[#8A8A86]">Publish to community</h2>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-3.5 flex size-11 items-center justify-center text-[#8A8A86] hover:text-[#E8E8E6]"
          >
            <X size={16} weight="bold" />
          </button>
        </div>

        <div className="overflow-hidden rounded-[10px] border border-white/[0.06]">
          <DesignPreview design={design} />
          {publishedSlug ? (
            <div className="flex flex-col gap-1.5 border-t border-white/[0.06] px-5 pt-[18px] pb-5">
              <h3 className="font-serif text-[30px] leading-[1.1]">{publishName}</h3>
              <p className="text-sm text-[#8A8A86]">by {authorName}, just now</p>
            </div>
          ) : (
            <div className="flex flex-col gap-0.5 border-t border-white/[0.06] px-5 pt-4 pb-3.5">
              <label className={labelClass} htmlFor="publish-name">
                Name
              </label>
              <input
                id="publish-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, NAME_MAX))}
                maxLength={NAME_MAX}
                className="h-11 w-full border-b border-white/[0.12] bg-transparent font-serif text-[30px] leading-[1.1] focus:border-[#8FB8DA] focus:outline-none"
                required
              />
              <div className="mt-1.5 flex h-11 items-center gap-2 text-sm">
                {me ? (
                  <>
                    <span className="text-[#8A8A86]">by</span>
                    {me.user.display_name}
                  </>
                ) : (
                  <>
                    <label className="text-[#8A8A86]" htmlFor="publish-author">
                      by
                    </label>
                    <input
                      id="publish-author"
                      type="text"
                      value={author}
                      onChange={(e) => setAuthor(e.target.value.slice(0, AUTHOR_MAX))}
                      maxLength={AUTHOR_MAX}
                      className="h-11 grow bg-transparent placeholder:text-[#5A5A57] focus:outline-none"
                      placeholder="Your name or handle"
                      required
                    />
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {publishedSlug ? (
          <>
            <div className="flex flex-col gap-2">
              <label className={labelClass} htmlFor="publish-url">
                Link to share
              </label>
              <div className="flex gap-2">
                <input
                  id="publish-url"
                  type="text"
                  readOnly
                  value={`${window.location.host}${communityPath}`}
                  className="h-11 min-w-0 grow rounded-[6px] border border-white/[0.06] bg-[#0E0E10] px-3.5 font-mono text-[12.5px] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={copyUrl}
                  className="flex h-11 shrink-0 items-center gap-2 rounded-[6px] border border-white/10 px-4 text-[13px] font-medium"
                >
                  {copied ? <Check size={14} weight="bold" /> : <Copy size={14} weight="bold" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="text-[13px] leading-normal text-[#8A8A86]">
                It can take up to a minute to show in the gallery.
                {me?.pro.active ? null : " You can publish again tomorrow."}
              </p>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] pt-[18px]">
              <a
                href={communityPath}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-11 items-center gap-1.5 text-[13px] text-[#8FB8DA] hover:text-[#B5D2EA]"
              >
                View on community
                <ArrowRight size={14} weight="bold" />
              </a>
              <button type="button" onClick={onClose} className={`${primaryClass} px-6`}>
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            {verdict ? (
              <div className="flex flex-col gap-4 border-t border-white/[0.06] pt-5">
                <div className="flex items-start gap-3">
                  {verdict.icon}
                  <div className="flex flex-col gap-1.5">
                    <h3 className="text-[15px] font-medium leading-[1.35]">{verdict.title}</h3>
                    <p className="text-[13px] leading-[1.55] text-[#8A8A86]">{verdict.body}</p>
                  </div>
                </div>
                {limit?.upgrade && ACCOUNTS_ENABLED ? (
                  <div className="flex items-center justify-between gap-4 rounded-[8px] border border-white/[0.06] bg-[#1C1C1F] py-3.5 pr-3.5 pl-4">
                    <div className="flex flex-col gap-[3px]">
                      <p className="text-sm font-medium">Pro publishes {proPerDay} a day</p>
                      <p className="text-[13px] text-[#8A8A86]">
                        ${me?.plan.priceUsdPerMonth ?? 5} a month. Cancel any time.
                      </p>
                    </div>
                    <LinkBtn href="/pricing" variant="primary" dither className="h-11 shrink-0 px-[18px] font-semibold">
                      Upgrade to Pro
                    </LinkBtn>
                  </div>
                ) : null}
                {twin ? (
                  <a
                    href={`/community/${twin.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-11 items-center justify-between gap-4 rounded-[8px] border border-white/[0.06] bg-[#1C1C1F] px-4 py-3 hover:border-white/[0.18]"
                  >
                    <span className="flex min-w-0 flex-col gap-[3px]">
                      <span className="truncate font-serif text-xl leading-[1.15]">{twin.name}</span>
                      <span className="text-[13px] text-[#8A8A86]">
                        by {twin.author_name}, published {relativeTime(twin.published_at)}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 text-[13px] text-[#8FB8DA]">
                      View it
                      <ArrowRight size={14} weight="bold" />
                    </span>
                  </a>
                ) : null}
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  <div className="flex items-baseline justify-between">
                    <label className={labelClass} htmlFor="publish-description">
                      What it shows
                    </label>
                    <span className="font-mono text-xs text-[#8A8A86]">
                      {description.length} / {DESCRIPTION_MAX}
                    </span>
                  </div>
                  <textarea
                    id="publish-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value.slice(0, DESCRIPTION_MAX))}
                    maxLength={DESCRIPTION_MAX}
                    rows={3}
                    className="w-full resize-none rounded-[8px] border border-white/[0.06] bg-[#0E0E10] px-3.5 py-3 text-sm leading-normal focus:border-[#8FB8DA] focus:outline-none"
                  />
                </div>
                {!me ? (
                  <TurnstileWidget
                    onToken={(t) => {
                      setError(null);
                      setToken(t);
                    }}
                    onError={(code) => {
                      setToken(null);
                      setError(
                        `Cloudflare challenge failed (code ${code}). Disable script blockers or reload, then try again.`,
                      );
                    }}
                  />
                ) : null}
              </>
            )}

            {error ? (
              <p className="text-[13px] text-[#E8A08A]" role="alert">
                {error}
              </p>
            ) : null}

            <div className={verdict ? "" : "flex flex-col gap-3.5 border-t border-white/[0.06] pt-[18px]"}>
              {verdict ? null : (
                <p className="text-[13px] leading-normal text-[#8A8A86]">
                  Publishing is permanent. A design can't be edited or removed once it is in the community.
                </p>
              )}
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => exportDesignAsJson(design, publishName)}
                  className="flex h-11 items-center gap-2 text-[13px] text-[#8A8A86] hover:text-[#E8E8E6]"
                  title="Download this design as a JSON file"
                >
                  <DownloadSimple size={14} weight="bold" />
                  Export JSON
                </button>
                {twin ? (
                  <button type="button" onClick={onClose} className={`${primaryClass} px-5`}>
                    Back to the builder
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="h-11 px-3.5 text-[13px] font-medium hover:text-white"
                    >
                      {limit ? "Close" : "Cancel"}
                    </button>
                    {limit ? (
                      <button
                        type="submit"
                        disabled
                        className="h-11 cursor-not-allowed rounded-[6px] border border-white/[0.06] bg-[#1C1C1F] px-5 text-[13px] font-medium text-[#8A8A86]"
                      >
                        Available in {limit.wait.short}
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={busy || !name.trim() || (!me && (!author.trim() || !token))}
                        className={`${primaryClass} px-5`}
                      >
                        {busy ? "Publishing..." : "Publish"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </form>
    </Modal>
  );
}
