import { useEffect, type ReactNode } from "react";
import { useDesignStore } from "../../store/designStore";
import { TEMPLATES } from "@statusline/shared/templates";
import { api } from "../../lib/api";

export interface BuilderQuery {
  templateId?: string;
  forkId?: string;
  isNew?: boolean;
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
  const f = sp.get("fork");
  if (f) out.forkId = f;
  if (sp.has("new")) out.isNew = true;
  return out;
}

// sessionStorage key used to dedupe seeds across React 19 StrictMode double
// effect-invocation and hot-reloads. Keyed on the actual query (fork slug /
// "new" / template id) so navigating to a different seed still fires once.
function seedKey(q: BuilderQuery): string {
  if (q.forkId) return `statusline-builder-seeded:fork:${q.forkId}`;
  if (q.isNew) return "statusline-builder-seeded:new";
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
 * Layout pass-through wrapper that seeds the design store from the URL and
 * wires the builder's global keyboard shortcuts.
 *
 * Seeding runs at most once per query per session (deduped via sessionStorage
 * so it survives React 19 StrictMode double-invoke and hot reloads without
 * clobbering user edits):
 *   - `?fork=<slug>`   — fetch the community design and import it as a fork.
 *                        Takes precedence over `?new` and `?template`.
 *   - `?new`           — start from scratch (confirm first when the current
 *                        design is non-empty), then reset().
 *   - `?template=<id>` — import a built-in template synchronously.
 *
 * Keyboard: Delete / Backspace removes the selected element (unless focus is in
 * a text field); Alt+ArrowLeft / Alt+ArrowRight nudge the selected element.
 */
export function BuilderPage({ children }: BuilderPageProps) {
  useEffect(() => {
    const search = typeof window !== "undefined" ? window.location.search : "";
    const q = parseBuilderQuery(search);

    // Fork wins over new + template. Async: fetch then import. The `cancelled`
    // flag prevents an import landing after unmount. We deliberately do NOT use
    // an in-memory "ran once" ref here — under StrictMode the setup→cleanup→
    // setup cycle would cancel the only in-flight fetch and nothing would load.
    // sessionStorage keyed on the slug dedupes instead, and it is marked only
    // after a successful import so a cancelled run can still be retried.
    if (q.forkId) {
      if (hasSeededThisSession(q)) return;
      const forkId = q.forkId;
      let cancelled = false;
      void (async () => {
        try {
          const d = await api.getCommunityBySlug(forkId);
          if (cancelled) return;
          useDesignStore.getState().importDesign({
            ...d.design,
            name: `${d.name} (fork)`,
          });
          markSeededThisSession(q);
        } catch (err) {
          if (!cancelled) {
            console.warn(`Could not load fork "${forkId}"`, err);
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    if (q.isNew) {
      if (hasSeededThisSession(q)) return;
      markSeededThisSession(q);
      const state = useDesignStore.getState();
      const hasElements = state.design.elements.length > 0;
      const confirmed =
        !hasElements ||
        (typeof window !== "undefined" &&
          window.confirm("Discard your current design and start from scratch?"));
      if (confirmed) state.reset();
      return;
    }

    if (q.templateId) {
      if (hasSeededThisSession(q)) return;
      const tpl = TEMPLATES.find((t) => t.id === q.templateId);
      if (tpl) {
        useDesignStore.getState().importDesign(structuredClone(tpl.design));
        markSeededThisSession(q);
      }
      return;
    }
  }, []);

  // Global builder keyboard shortcuts. Reads the store lazily on each event so
  // the handler never captures stale state and the effect can mount just once.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target;
      if (
        target instanceof Element &&
        target.closest("input,textarea,[contenteditable]")
      ) {
        return;
      }
      const state = useDesignStore.getState();
      const selectedId = state.selectedId;
      if (!selectedId) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        state.removeElement(selectedId);
        return;
      }
      if (e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        e.preventDefault();
        state.moveSelected(e.key === "ArrowLeft" ? -1 : 1);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return <>{children}</>;
}

export default BuilderPage;
