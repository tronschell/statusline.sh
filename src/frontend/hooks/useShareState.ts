import { useCallback, useEffect, useState } from "react";

const DESIGN_ID_KEY = "statusline-design-id-v1";
const SLUG_KEY = "statusline-slug-v1";

function readSession(key: string): string | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSession(key: string, value: string | null): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch {
    // ignore (private mode, quota, etc.)
  }
}

export interface ShareState {
  designId: string | null;
  slug: string | null;
  setDesignId(id: string | null): void;
  setSlug(slug: string | null): void;
  clear(): void;
}

/**
 * Tracks the server-assigned short id (assigned at Save & Share time) and
 * the community slug (assigned when published). Both are persisted to
 * sessionStorage so a tab refresh keeps the saved state.
 */
export function useShareState(): ShareState {
  const [designId, setDesignIdState] = useState<string | null>(() =>
    readSession(DESIGN_ID_KEY),
  );
  const [slug, setSlugState] = useState<string | null>(() =>
    readSession(SLUG_KEY),
  );

  useEffect(() => {
    writeSession(DESIGN_ID_KEY, designId);
  }, [designId]);

  useEffect(() => {
    writeSession(SLUG_KEY, slug);
  }, [slug]);

  const setDesignId = useCallback((id: string | null) => {
    setDesignIdState(id);
    if (id === null) setSlugState(null);
  }, []);

  const setSlug = useCallback((s: string | null) => {
    setSlugState(s);
  }, []);

  const clear = useCallback(() => {
    setDesignIdState(null);
    setSlugState(null);
  }, []);

  return { designId, slug, setDesignId, setSlug, clear };
}
