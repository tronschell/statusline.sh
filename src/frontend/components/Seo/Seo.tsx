import { useEffect, useSyncExternalStore } from "react";
import { usePath } from "../../router";
import { applyHeadMeta, metaForPath, type RouteMeta } from "../../seo";

/**
 * Tiny external store so route-aware pages (e.g. CommunityDetailPage) can push
 * a refined meta override once their data loads, without having to lift state
 * into a Context wrapping the whole router tree.
 *
 * Pattern: page calls `setRouteMetaOverride(path, meta)` after fetch; clears
 * on unmount with `clearRouteMetaOverride(path)`. The `Seo` component
 * subscribes and re-applies meta whenever either path or override changes.
 *
 * Overrides are keyed by canonical pathname so a stale override from a
 * previously-visited slug doesn't leak onto a new slug page.
 */
const overrideStore = (() => {
  const listeners = new Set<() => void>();
  let state: { path: string; meta: RouteMeta } | null = null;
  return {
    get(): { path: string; meta: RouteMeta } | null {
      return state;
    },
    set(path: string, meta: RouteMeta): void {
      state = { path, meta };
      for (const l of listeners) l();
    },
    clear(path: string): void {
      if (state && state.path === path) {
        state = null;
        for (const l of listeners) l();
      }
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
})();

export function setRouteMetaOverride(path: string, meta: RouteMeta): void {
  overrideStore.set(path, meta);
}

export function clearRouteMetaOverride(path: string): void {
  overrideStore.clear(path);
}

function useRouteMetaOverride(): { path: string; meta: RouteMeta } | null {
  return useSyncExternalStore(
    overrideStore.subscribe,
    overrideStore.get,
    overrideStore.get,
  );
}

export function Seo() {
  const path = usePath();
  const override = useRouteMetaOverride();

  useEffect(() => {
    // Prefer a page-supplied override (e.g. the community detail page once its
    // row loads), but only when it targets the *current* path — otherwise fall
    // back to the route's static metadata. `applyHeadMeta` upserts every tag
    // and the canonical, so client-side navigation never leaves a prior
    // route's title/canonical/JSON-LD stale.
    const meta = override && override.path === path ? override.meta : metaForPath(path);
    applyHeadMeta(meta);
  }, [path, override]);

  return null;
}

export default Seo;
