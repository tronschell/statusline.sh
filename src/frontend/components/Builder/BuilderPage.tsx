import { useEffect, useRef, type ReactNode } from "react";
import { useDesignStore } from "../../store/designStore";
import { TEMPLATES } from "@statusline/shared/templates";

export interface BuilderQuery {
  templateId?: string;
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
  if (t) out.templateId = t;
  return out;
}

// sessionStorage key used to dedupe seeds across React 19 StrictMode double
// effect-invocation and hot-reloads. Keyed on the actual query so navigating
// to a different template still triggers a fresh seed.
function seedKey(q: BuilderQuery): string {
  return `statusline-builder-seeded:${q.templateId ?? ""}`;
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
 * design store from `?template=` query param.
 *
 * - Reads location.search at mount.
 * - For `?template=<id>`: looks up TEMPLATES, calls importDesign synchronously.
 * - Seeds at most once per templateId per session (guards against StrictMode
 *   double-invoke and hot-reload clobbering user edits).
 *
 * Forking from a community design is handled by the community detail page
 * itself, which imports the design into the store before navigating here.
 */
export function BuilderPage({ children }: BuilderPageProps) {
  const seededRef = useRef(false);

  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;

    const search = typeof window !== "undefined" ? window.location.search : "";
    const q = parseBuilderQuery(search);

    if (!q.templateId) return;
    if (hasSeededThisSession(q)) return;

    if (q.templateId) {
      const tpl = TEMPLATES.find((t) => t.id === q.templateId);
      if (tpl) {
        useDesignStore.getState().importDesign(structuredClone(tpl.design));
        markSeededThisSession(q);
      }
      return;
    }
  }, []);

  return <>{children}</>;
}

export default BuilderPage;
