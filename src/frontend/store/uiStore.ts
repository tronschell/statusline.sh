import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { StateStorage } from "zustand/middleware";
import { DEFAULT_MOCK_STDIN } from "@statusline/shared/mockStdin";

function safeStorage(): StateStorage {
  if (typeof localStorage !== "undefined") return localStorage;
  const mem = new Map<string, string>();
  return {
    getItem: (k) => mem.get(k) ?? null,
    setItem: (k, v) => {
      mem.set(k, v);
    },
    removeItem: (k) => {
      mem.delete(k);
    },
  };
}

export type OsOverride = "auto" | "mac" | "linux" | "windows";

export interface UiState {
  paletteCollapsed: boolean;
  inspectorCollapsed: boolean;
  mockPreset: string;
  mockStdinJson: string;
  osOverride: OsOverride;
  selfHealOptIn: boolean;
  togglePalette(): void;
  toggleInspector(): void;
  setMockPreset(k: string): void;
  setMockStdinJson(s: string): void;
  setOsOverride(o: OsOverride): void;
  setSelfHealOptIn(b: boolean): void;
}

const DEFAULT_MOCK_JSON = JSON.stringify(DEFAULT_MOCK_STDIN, null, 2);

/**
 * Backfill top-level keys that were added to DEFAULT_MOCK_STDIN after the
 * user's persisted mockStdinJson was first written (e.g. `thinking`,
 * `effort`, `output_style`, `fast_mode` driving the new statusline
 * elements). Without this, those elements render as empty in the mock
 * terminal even though their fields exist in the current defaults. User
 * edits to existing keys are preserved — we only add what's missing.
 */
function backfillMockJson(stored: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    return DEFAULT_MOCK_JSON;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return DEFAULT_MOCK_JSON;
  }
  const merged: Record<string, unknown> = { ...(parsed as Record<string, unknown>) };
  let changed = false;
  for (const [key, val] of Object.entries(DEFAULT_MOCK_STDIN)) {
    if (!(key in merged)) {
      merged[key] = val;
      changed = true;
    }
  }
  if (!changed) return stored;
  return JSON.stringify(merged, null, 2);
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      paletteCollapsed: false,
      inspectorCollapsed: false,
      mockPreset: "default",
      mockStdinJson: DEFAULT_MOCK_JSON,
      osOverride: "auto",
      selfHealOptIn: false,
      togglePalette: () =>
        set((s) => ({ paletteCollapsed: !s.paletteCollapsed })),
      toggleInspector: () =>
        set((s) => ({ inspectorCollapsed: !s.inspectorCollapsed })),
      setMockPreset: (k) => set({ mockPreset: k }),
      setMockStdinJson: (s) => set({ mockStdinJson: s }),
      setOsOverride: (o) => set({ osOverride: o }),
      setSelfHealOptIn: (b) => set({ selfHealOptIn: b }),
    }),
    {
      name: "statusline-ui-v1",
      version: 2,
      storage: createJSONStorage(safeStorage),
      migrate: (persisted, version) => {
        if (typeof persisted !== "object" || persisted === null) return persisted;
        const state = persisted as Partial<UiState>;
        if (version < 2 && typeof state.mockStdinJson === "string") {
          state.mockStdinJson = backfillMockJson(state.mockStdinJson);
        }
        return state as UiState;
      },
    },
  ),
);
