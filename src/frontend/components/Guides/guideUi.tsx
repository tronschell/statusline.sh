/**
 * Small presentational primitives shared by the guide page and its widgets.
 * Nothing here touches `window` / `document` / `navigator` during render, so the
 * guide pages stay renderable with `renderToStaticMarkup` (see test/guide.test.tsx).
 */
import { Check, Copy } from "@phosphor-icons/react";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Link } from "../../router";
import { goToBuilder } from "../../lib/navigate";
import { parseInline } from "./guideContent";

export const SERIF: CSSProperties = {
  fontFamily: "var(--font-serif, 'Instrument Serif', Georgia, serif)",
};

/** True when the visitor asked the OS for reduced motion. `false` on the server. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return reduced;
}

const LINK_CLASS =
  "text-[#E8E8E6] underline decoration-white/25 underline-offset-[3px] transition-colors hover:decoration-white/60";

/** Renders the guide's inline mini-markup: `code`, **bold**, [label](href). */
export function Inline({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((tok, i) => {
        switch (tok.t) {
          case "code":
            return (
              <code
                key={i}
                className="rounded-[4px] bg-white/[0.06] px-1.5 py-0.5 font-mono text-[0.88em] text-[#E8E8E6]"
              >
                {tok.v}
              </code>
            );
          case "strong":
            return (
              <strong key={i} className="font-semibold text-[#E8E8E6]">
                {tok.v}
              </strong>
            );
          case "link":
            if (/^https?:\/\//.test(tok.href)) {
              return (
                <a
                  key={i}
                  href={tok.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={LINK_CLASS}
                >
                  {tok.v}
                </a>
              );
            }
            // Hash links need a plain anchor (the router only handles paths).
            if (tok.href.startsWith("#")) {
              return (
                <a key={i} href={tok.href} className={LINK_CLASS}>
                  {tok.v}
                </a>
              );
            }
            return (
              <Link key={i} href={tok.href} className={LINK_CLASS}>
                {tok.v}
              </Link>
            );
          default:
            return <span key={i}>{tok.v}</span>;
        }
      })}
    </>
  );
}

export function CopyButton({
  text,
  label,
  className = "",
}: {
  text: string;
  label: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked (insecure context / permissions): the text stays selectable.
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy ${label}`}
      className={
        "inline-flex items-center gap-1.5 rounded-[6px] border border-white/[0.08] px-2 py-1 font-mono text-[11px] text-[#A8A8A4] transition-colors hover:border-white/[0.18] hover:text-[#E8E8E6] " +
        className
      }
    >
      {copied ? (
        <Check size={12} weight="bold" className="text-[#9CC09F]" />
      ) : (
        <Copy size={12} weight="bold" />
      )}
      <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}

export function CodeBlock({ label, code }: { label: string; code: string }) {
  const lines = code.split("\n");
  return (
    <div className="overflow-hidden rounded-[10px] border border-white/[0.08] bg-black/30">
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] py-1.5 pl-4 pr-2">
        <span className="truncate font-mono text-[12px] text-[#8A8A86]">
          {label}
        </span>
        <CopyButton text={code} label={label} />
      </div>
      <pre
        tabIndex={0}
        className="overflow-x-auto px-4 py-4 font-mono text-[12.5px] leading-[1.7] text-[#E8E8E6] focus-visible:outline focus-visible:outline-1 focus-visible:outline-white/30"
      >
        <code>
          {lines.map((line, i) => (
            <span
              key={i}
              className={/^\s*#(?!!)/.test(line) ? "text-[#6F6F6B]" : undefined}
            >
              {line}
              {i < lines.length - 1 ? "\n" : ""}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}

export function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "inline-flex items-center rounded-[999px] border px-3 py-1 text-[12px] transition-colors " +
        (active
          ? "border-white/20 bg-[#E8E8E6] text-[#0E0E10]"
          : "border-white/[0.1] bg-[#0E0E10] text-[#A8A8A4] hover:border-white/20 hover:text-[#E8E8E6]")
      }
    >
      {children}
    </button>
  );
}

/**
 * Fades a block in the first time it enters the viewport. Uses threshold 0 so a
 * tall block on a small phone still triggers, and stays visible when
 * IntersectionObserver is missing or the visitor prefers reduced motion.
 */
export function Reveal({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0, rootMargin: "0px 0px -8% 0px" },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(10px)",
        transition:
          "opacity 550ms cubic-bezier(0.16,1,0.3,1), transform 550ms cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      {children}
    </div>
  );
}

/**
 * A crawlable `/builder?template=...` anchor that opens the builder through the
 * shared `goToBuilder` helper (SPA navigation) on a plain click.
 */
export function BuilderLink({
  templateId,
  className,
  title,
  children,
}: {
  templateId?: string;
  className?: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={templateId ? `/builder?template=${templateId}` : "/builder"}
      title={title}
      className={className}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
          return;
        }
        e.preventDefault();
        goToBuilder(templateId ? { templateId } : {});
      }}
    >
      {children}
    </a>
  );
}

/** Keyframes for the guide. Every animation is switched off for reduced motion. */
export function GuideStyles() {
  return (
    <style>{`
      @keyframes guide-blink { 0%, 49% { opacity: 1 } 50%, 100% { opacity: 0 } }
      @keyframes guide-ping { 0% { transform: scale(1); opacity: .55 } 80%, 100% { transform: scale(2.1); opacity: 0 } }
      @keyframes guide-nudge { 0%, 100% { transform: translateX(0) } 50% { transform: translateX(4px) } }
      @keyframes guide-rise { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: translateY(0) } }
      .guide-blink { animation: guide-blink 1.05s steps(1) infinite }
      .guide-ping { animation: guide-ping 2.4s cubic-bezier(0,0,.2,1) infinite }
      .guide-nudge { animation: guide-nudge 1.8s ease-in-out infinite }
      .guide-rise { animation: guide-rise 500ms cubic-bezier(.16,1,.3,1) both }
      @media (prefers-reduced-motion: reduce) {
        .guide-blink, .guide-ping, .guide-nudge, .guide-rise { animation: none !important }
      }
    `}</style>
  );
}
