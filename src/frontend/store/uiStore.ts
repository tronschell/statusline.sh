import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { StateStorage } from "zustand/middleware";
import { DEFAULT_MOCK_STDIN } from "../../shared/mockStdin";

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
      storage: createJSONStorage(safeStorage),
    },
  ),
);
