import { useEffect } from "react";
import { usePath } from "../../router";
import {
  DEFAULT_OG_IMAGE,
  SITE_NAME,
  absoluteUrl,
  canonicalUrl,
  metaForPath,
} from "../../seo";

export function Seo() {
  const path = usePath();

  useEffect(() => {
    const meta = metaForPath(path);
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
  }, [path]);

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
