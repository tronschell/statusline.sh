import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { StateStorage } from "zustand/middleware";
import { nanoid } from "nanoid";
import type {
  AnsiStyle,
  Design,
  Element,
  ElementType,
} from "@statusline/shared/types";
import { getThemePreset } from "../themes/presets";

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

const HISTORY_CAP = 50;
const MAX_LINE_BREAKS = 3;

const INITIAL_DESIGN: Design = {
  version: 1,
  name: "Untitled",
  elements: [],
};

const EMPTY_STYLE: AnsiStyle = {};

function defaultsFor(type: ElementType, id: string): Element {
  const base = { id, style: { ...EMPTY_STYLE } };
  switch (type) {
    case "static":
      return { ...base, type, text: "text" };
    case "model":
      return { ...base, type };
    case "cwd":
      return { ...base, type, mode: "basename" };
    case "gitBranch":
      return { ...base, type };
    case "gitStatus":
      return { ...base, type, dirtyText: "✗", cleanText: "✓" };
    case "linesAdded":
      return { ...base, type };
    case "linesRemoved":
      return { ...base, type };
    case "contextPct":
      return { ...base, type };
    case "contextBar":
      return {
        ...base,
        type,
        width: 10,
        filledChar: "█",
        emptyChar: "░",
      };
    case "contextTokens":
      return { ...base, type, variant: "ratio", compact: true };
    case "rateLimit5h":
      return {
        ...base,
        type,
        variant: "pct",
        width: 10,
        filledChar: "█",
        emptyChar: "░",
      };
    case "rateLimit7d":
      return {
        ...base,
        type,
        variant: "pct",
        width: 10,
        filledChar: "█",
        emptyChar: "░",
      };
    case "cost":
      return { ...base, type, precision: 2 };
    case "sessionDuration":
      return { ...base, type, format: "human" };
    case "glyph":
      return { ...base, type, char: "◆" };
    case "separator":
      return { ...base, type, text: " | " };
    case "rotator":
      return {
        ...base,
        type,
        items: ["✨", "🌙", "⚡", "🔥", "🌈"],
        intervalSeconds: 3,
        pickMode: "cycle",
      };
    case "segmentSplit":
      return {
        ...base,
        type,
        source: { kind: "field", path: "workspace.git_worktree" },
        delimiter: "/",
        segments: [{ style: {} }, { style: {} }],
      };
    case "thinkingEffort":
      return { ...base, type };
    case "outputStyle":
      return { ...base, type, alwaysShow: false };
    case "fastMode":
      return { ...base, type, text: "⚡fast" };
    case "lineBreak":
      return { ...base, type };
    case "spacer":
      return { ...base, type, mode: "flex", char: " " };
  }
}

function lineBreakCapReached(design: Design): boolean {
  let n = 0;
  for (const el of design.elements) {
    if (el.type === "lineBreak") n++;
    if (n >= MAX_LINE_BREAKS) return true;
  }
  return false;
}

export interface DesignState {
  design: Design;
  selectedId: string | null;
  past: Design[];
  future: Design[];

  addElement(type: ElementType): void;
  addElementAt(type: ElementType, index: number): void;
  updateElement(id: string, patch: Partial<Element>): void;
  removeElement(id: string): void;
  reorder(fromIdx: number, toIdx: number): void;
  select(id: string | null): void;
  setName(name: string): void;
  undo(): void;
  redo(): void;
  importDesign(d: Design): void;
  reset(): void;
  applyThemePreset(presetId: string): void;
}

function pushHistory(past: Design[], prior: Design): Design[] {
  const next = past.concat(structuredClone(prior));
  if (next.length > HISTORY_CAP) {
    next.splice(0, next.length - HISTORY_CAP);
  }
  return next;
}

export const useDesignStore = create<DesignState>()(
  persist(
    (set, get) => {
      function withHistory(mutator: (design: Design) => Design): void {
        const { design, past } = get();
        const nextDesign = mutator(design);
        if (nextDesign === design) return;
        set({
          design: nextDesign,
          past: pushHistory(past, design),
          future: [],
        });
      }

      return {
        design: structuredClone(INITIAL_DESIGN),
        selectedId: null,
        past: [],
        future: [],

        addElement(type) {
          withHistory((design) => {
            if (type === "lineBreak" && lineBreakCapReached(design)) {
              return design;
            }
            const el = defaultsFor(type, nanoid(8));
            return { ...design, elements: [...design.elements, el] };
          });
        },

        addElementAt(type, index) {
          withHistory((design) => {
            if (type === "lineBreak" && lineBreakCapReached(design)) {
              return design;
            }
            const el = defaultsFor(type, nanoid(8));
            const i = Math.max(0, Math.min(index, design.elements.length));
            const elements = design.elements.slice();
            elements.splice(i, 0, el);
            return { ...design, elements };
          });
        },

        updateElement(id, patch) {
          withHistory((design) => {
            let changed = false;
            const elements = design.elements.map((el) => {
              if (el.id !== id) return el;
              changed = true;
              const { type: _ignored, ...rest } = patch as Partial<Element> & {
                type?: ElementType;
              };
              return { ...el, ...rest, type: el.type } as Element;
            });
            if (!changed) return design;
            return { ...design, elements };
          });
        },

        removeElement(id) {
          const { selectedId } = get();
          withHistory((design) => {
            const elements = design.elements.filter((el) => el.id !== id);
            if (elements.length === design.elements.length) return design;
            return { ...design, elements };
          });
          if (selectedId === id) set({ selectedId: null });
        },

        reorder(fromIdx, toIdx) {
          withHistory((design) => {
            const len = design.elements.length;
            if (
              fromIdx === toIdx ||
              fromIdx < 0 ||
              toIdx < 0 ||
              fromIdx >= len ||
              toIdx >= len
            ) {
              return design;
            }
            const elements = design.elements.slice();
            const [moved] = elements.splice(fromIdx, 1);
            if (!moved) return design;
            elements.splice(toIdx, 0, moved);
            return { ...design, elements };
          });
        },

        select(id) {
          set({ selectedId: id });
        },

        setName(name) {
          withHistory((design) => {
            if (design.name === name) return design;
            return { ...design, name };
          });
        },

        undo() {
          const { past, future, design } = get();
          if (past.length === 0) return;
          const prev = past[past.length - 1]!;
          set({
            design: prev,
            past: past.slice(0, -1),
            future: future.concat(structuredClone(design)),
          });
        },

        redo() {
          const { past, future, design } = get();
          if (future.length === 0) return;
          const next = future[future.length - 1]!;
          set({
            design: next,
            future: future.slice(0, -1),
            past: past.concat(structuredClone(design)),
          });
        },

        importDesign(d) {
          set({
            design: structuredClone(d),
            past: [],
            future: [],
            selectedId: null,
          });
        },

        reset() {
          set({
            design: structuredClone(INITIAL_DESIGN),
            past: [],
            future: [],
            selectedId: null,
          });
        },

        applyThemePreset(presetId) {
          const preset = getThemePreset(presetId);
          if (!preset) return;
          withHistory((design) => {
            if (design.elements.length === 0) return design;
            const elements = design.elements.map((el) => {
              const color = preset.colors[el.type] ?? preset.colors.default;
              return {
                ...el,
                style: { ...el.style, fg: color },
              } as Element;
            });
            return { ...design, elements };
          });
        },
      };
    },
    {
      name: "statusline-design-v1",
      storage: createJSONStorage(safeStorage),
      partialize: (state) => ({ design: state.design }),
      version: 2,
      // v1 → v2: consolidate rateLimit{5h,7d}{Pct,Bar} into rateLimit{5h,7d}
      // with a `variant: "pct" | "bar"` field. Old persisted designs would
      // crash the inspector switch otherwise.
      migrate: (persisted, _version) => {
        if (!persisted || typeof persisted !== "object") return persisted;
        const state = persisted as { design?: { elements?: unknown[] } };
        const els = state.design?.elements;
        if (!Array.isArray(els)) return persisted;
        const ALIASES: Record<string, { type: string; variant: "pct" | "bar" }> = {
          rateLimit5hPct: { type: "rateLimit5h", variant: "pct" },
          rateLimit5hBar: { type: "rateLimit5h", variant: "bar" },
          rateLimit7dPct: { type: "rateLimit7d", variant: "pct" },
          rateLimit7dBar: { type: "rateLimit7d", variant: "bar" },
        };
        const next = els.map((el) => {
          if (!el || typeof el !== "object") return el;
          const e = el as Record<string, unknown>;
          const alias = typeof e.type === "string" ? ALIASES[e.type] : undefined;
          if (!alias) return el;
          return {
            width: 10,
            filledChar: "█",
            emptyChar: "░",
            ...e,
            type: alias.type,
            variant: alias.variant,
          };
        });
        return { ...state, design: { ...state.design, elements: next } };
      },
    },
  ),
);
