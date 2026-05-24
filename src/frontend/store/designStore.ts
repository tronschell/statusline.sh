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
    case "rateLimit5hPct":
      return { ...base, type };
    case "rateLimit5hBar":
      return {
        ...base,
        type,
        width: 10,
        filledChar: "█",
        emptyChar: "░",
      };
    case "rateLimit7dPct":
      return { ...base, type };
    case "rateLimit7dBar":
      return {
        ...base,
        type,
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
  }
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
            const el = defaultsFor(type, nanoid(8));
            return { ...design, elements: [...design.elements, el] };
          });
        },

        addElementAt(type, index) {
          withHistory((design) => {
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
      };
    },
    {
      name: "statusline-design-v1",
      storage: createJSONStorage(safeStorage),
      partialize: (state) => ({ design: state.design }),
    },
  ),
);
