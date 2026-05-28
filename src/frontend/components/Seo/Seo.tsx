import { useEffect, useSyncExternalStore } from "react";
import { usePath } from "../../router";
import {
  DEFAULT_OG_IMAGE,
  SITE_NAME,
  absoluteUrl,
  canonicalUrl,
  metaForPath,
  type RouteMeta,
} from "../../seo";

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
    const meta = override && override.path === path
      ? override.meta
      : metaForPath(path);
    const canonical = canonicalUrl(meta.canonicalPath);
    const image = absoluteUrl(meta.image ?? DEFAULT_OG_IMAGE);

    document.title = meta.title;
    setMeta("name", "description", meta.description);
    setMeta("name", "robots", meta.robots ?? "index,follow");
    setMeta("property", "og:site_name", SITE_NAME);
    setMeta("property", "og:type", "website");
    setMeta("property", "og:title", meta.title);
    setMeta("property", "og:description", meta.description);
    setMeta("property", "og:url", canonical);
    setMeta("property", "og:image", image);
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", meta.title);
    setMeta("name", "twitter:description", meta.description);
    setMeta("name", "twitter:image", image);
    setCanonical(canonical);
    setJsonLd(meta.jsonLd ?? []);
  }, [path, override]);

  return null;
}

function setMeta(attribute: "name" | "property", key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(
    `meta[${attribute}="${key}"]`,
  );
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.content = content;
}

function setCanonical(href: string) {
  let element = document.head.querySelector<HTMLLinkElement>(
    'link[rel="canonical"]',
  );
  if (!element) {
    element = document.createElement("link");
    element.rel = "canonical";
    document.head.appendChild(element);
  }
  element.href = href;
}

function setJsonLd(items: Array<Record<string, unknown>>) {
  document
    .querySelectorAll('script[type="application/ld+json"][data-seo="route"]')
    .forEach((element) => element.remove());

  for (const item of items) {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.dataset.seo = "route";
    script.text = JSON.stringify(item);
    document.head.appendChild(script);
  }
}

export default Seo;
