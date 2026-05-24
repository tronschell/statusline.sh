// Tiny navigation helpers. T13 may also create this file; if it does, both
// agents are expected to converge on the same minimal surface.
//
// We use the browser History API for SPA navigation and dispatch a synthetic
// "popstate" so subscribers (e.g. a hand-rolled router) can react.

import { useEffect, useState } from "react";

export function navigate(url: string): void {
  if (typeof window === "undefined") return;
  window.history.pushState({}, "", url);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function getPath(): string {
  if (typeof window === "undefined") return "/";
  return window.location.pathname + window.location.search;
}

export function useCurrentPath(): string {
  const [path, setPath] = useState<string>(() => getPath());
  useEffect(() => {
    const h = () => setPath(getPath());
    window.addEventListener("popstate", h);
    return () => window.removeEventListener("popstate", h);
  }, []);
  return path;
}

export interface GoToBuilderOpts {
  templateId?: string;
  forkId?: string;
}

/**
 * Builds a `/builder` URL with the given query and navigates to it.
 * - `templateId` -> `?template=<id>`
 * - `forkId`     -> `?fork=<id>`
 * If both are passed, both query params are added (forkId wins seeding order
 * inside `BuilderPage`, but this helper is agnostic).
 */
export function goToBuilder(opts: GoToBuilderOpts = {}): void {
  const sp = new URLSearchParams();
  if (opts.templateId) sp.set("template", opts.templateId);
  if (opts.forkId) sp.set("fork", opts.forkId);
  const qs = sp.toString();
  navigate(`/builder${qs ? `?${qs}` : ""}`);
}
