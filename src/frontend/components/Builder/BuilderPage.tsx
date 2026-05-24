import { useEffect, useRef, useState, type ReactNode } from "react";
import { useDesignStore } from "../../store/designStore";
import { TEMPLATES } from "../../../shared/templates";
import { api } from "../../lib/api";

export interface BuilderQuery {
  templateId?: string;
  forkId?: string;
}

/**
 * Parses a URL search string (with or without leading "?") into the subset
 * of query params BuilderPage cares about. Pure / no side effects so it can
 * be unit-tested without a DOM.
 */
export function parseBuilderQuery(search: string): BuilderQuery {
  const sp = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const out: BuilderQuery = {};
  const t = sp.get("template");
  const f = sp.get("fork");
  if (t) out.templateId = t;
  if (f) out.forkId = f;
  return out;
}

// sessionStorage key used to dedupe seeds across React 19 StrictMode double
// effect-invocation and hot-reloads. Keyed on the actual query so navigating
// to a different template/fork still triggers a fresh seed.
function seedKey(q: BuilderQuery): string {
  return `statusline-builder-seeded:${q.templateId ?? ""}:${q.forkId ?? ""}`;
}

function hasSeededThisSession(q: BuilderQuery): boolean {
  if (typeof sessionStorage === "undefined") return false;
  try {
    return sessionStorage.getItem(seedKey(q)) === "1";
  } catch {
    return false;
  }
}

function markSeededThisSession(q: BuilderQuery): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(seedKey(q), "1");
  } catch {
    // ignore quota / disabled storage
  }
}

export interface BuilderPageProps {
  children: ReactNode;
}

/**
 * Pure layout pass-through wrapper that handles one-shot seeding of the
 * design store from `?template=` or `?fork=` query params.
 *
 * - Reads location.search at mount.
 * - For `?template=<id>`: looks up TEMPLATES, calls importDesign synchronously.
 * - For `?fork=<id>`: fetches the design via `api.getDesign`, then imports it
 *   with `name` suffixed " (fork)".
 * - Seeds at most once per (templateId, forkId) tuple per session (guards
 *   against StrictMode double-invoke and hot-reload clobbering user edits).
 */
export function BuilderPage({ children }: BuilderPageProps) {
  const seededRef = useRef(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;

    const search = typeof window !== "undefined" ? window.location.search : "";
    const q = parseBuilderQuery(search);

    if (!q.templateId && !q.forkId) return;
    if (hasSeededThisSession(q)) return;

    let cancelled = false;

    if (q.templateId) {
      const tpl = TEMPLATES.find((t) => t.id === q.templateId);
      if (tpl) {
        useDesignStore.getState().importDesign(structuredClone(tpl.design));
        markSeededThisSession(q);
      }
      return;
    }

    if (q.forkId) {
      setLoading(true);
      api
        .getDesign(q.forkId)
        .then((fetched) => {
          if (cancelled) return;
          const cloned = structuredClone(fetched);
          // Strip server-only meta fields; importDesign accepts a Design.
          const forked = {
            version: cloned.version,
            name: `${cloned.name} (fork)`,
            elements: cloned.elements,
          };
          useDesignStore.getState().importDesign(forked);
          markSeededThisSession(q);
        })
        .catch((err) => {
          // Non-fatal: log and leave the store untouched so the user lands on
          // a blank builder rather than a broken page.
          console.error("[BuilderPage] fork load failed:", err);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      {children}
      {loading ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
        >
          <div className="rounded-lg border border-[#2A2A2E] bg-[#16161A] px-5 py-3 text-sm text-[#E8E8E6] shadow-xl">
            Loading template…
          </div>
        </div>
      ) : null}
    </>
  );
}

export default BuilderPage;
