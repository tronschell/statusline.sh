import { describe, expect, test, beforeEach } from "bun:test";
import { useDesignStore } from "../src/frontend/store/designStore";
import { useUiStore } from "../src/frontend/store/uiStore";
import type { Design, Element } from "@statusline/shared/types";

function resetStore() {
  useDesignStore.getState().reset();
}

beforeEach(() => {
  resetStore();
});

describe("designStore: addElement", () => {
  test("adds element with unique id and correct type", () => {
    const { addElement } = useDesignStore.getState();
    addElement("model");
    addElement("static");
    addElement("contextBar");
    const { design } = useDesignStore.getState();
    expect(design.elements.length).toBe(3);
    expect(design.elements[0]?.type).toBe("model");
    expect(design.elements[1]?.type).toBe("static");
    expect(design.elements[2]?.type).toBe("contextBar");
    const ids = design.elements.map((e) => e.id);
    expect(new Set(ids).size).toBe(3);
    for (const id of ids) expect(id.length).toBe(8);
  });

  test("applies type-specific defaults", () => {
    const { addElement } = useDesignStore.getState();
    addElement("contextBar");
    addElement("cwd");
    addElement("cost");
    addElement("segmentSplit");
    const els = useDesignStore.getState().design.elements;
    const bar = els[0] as Extract<Element, { type: "contextBar" }>;
    expect(bar.width).toBe(10);
    expect(bar.filledChar).toBe("█");
    expect(bar.emptyChar).toBe("░");
    const cwd = els[1] as Extract<Element, { type: "cwd" }>;
    expect(cwd.mode).toBe("basename");
    const cost = els[2] as Extract<Element, { type: "cost" }>;
    expect(cost.precision).toBe(2);
    const seg = els[3] as Extract<Element, { type: "segmentSplit" }>;
    expect(seg.delimiter).toBe("/");
    expect(seg.segments.length).toBe(2);
    expect(seg.source).toEqual({
      kind: "field",
      path: "workspace.git_worktree",
    });
  });
});

describe("designStore: updateElement", () => {
  test("applies patch and preserves type", () => {
    const { addElement, updateElement } = useDesignStore.getState();
    addElement("static");
    const id = useDesignStore.getState().design.elements[0]!.id;
    updateElement(id, { text: "hello" } as Partial<Element>);
    const el = useDesignStore.getState().design.elements[0] as Extract<
      Element,
      { type: "static" }
    >;
    expect(el.text).toBe("hello");
    expect(el.type).toBe("static");
  });

  test("does not allow patch to change type", () => {
    const { addElement, updateElement } = useDesignStore.getState();
    addElement("static");
    const id = useDesignStore.getState().design.elements[0]!.id;
    updateElement(id, { type: "model" } as unknown as Partial<Element>);
    const el = useDesignStore.getState().design.elements[0]!;
    expect(el.type).toBe("static");
  });
});

describe("designStore: removeElement", () => {
  test("removes by id and clears selection if matched", () => {
    const { addElement, removeElement, select } = useDesignStore.getState();
    addElement("model");
    addElement("static");
    const [a, b] = useDesignStore.getState().design.elements;
    select(a!.id);
    removeElement(a!.id);
    const state = useDesignStore.getState();
    expect(state.design.elements.length).toBe(1);
    expect(state.design.elements[0]?.id).toBe(b!.id);
    expect(state.selectedId).toBeNull();
  });

  test("keeps selection if other element removed", () => {
    const { addElement, removeElement, select } = useDesignStore.getState();
    addElement("model");
    addElement("static");
    const [a, b] = useDesignStore.getState().design.elements;
    select(b!.id);
    removeElement(a!.id);
    expect(useDesignStore.getState().selectedId).toBe(b!.id);
  });
});

describe("designStore: reorder", () => {
  test("moves item correctly", () => {
    const { addElement, reorder } = useDesignStore.getState();
    addElement("model");
    addElement("static");
    addElement("cwd");
    const before = useDesignStore
      .getState()
      .design.elements.map((e) => e.type);
    expect(before).toEqual(["model", "static", "cwd"]);
    reorder(0, 2);
    const after = useDesignStore
      .getState()
      .design.elements.map((e) => e.type);
    expect(after).toEqual(["static", "cwd", "model"]);
  });
});

describe("designStore: undo/redo", () => {
  test("undo restores prior state", () => {
    const { addElement, undo } = useDesignStore.getState();
    addElement("model");
    addElement("static");
    expect(useDesignStore.getState().design.elements.length).toBe(2);
    undo();
    expect(useDesignStore.getState().design.elements.length).toBe(1);
    undo();
    expect(useDesignStore.getState().design.elements.length).toBe(0);
  });

  test("redo restores undone state", () => {
    const { addElement, undo, redo } = useDesignStore.getState();
    addElement("model");
    addElement("static");
    undo();
    expect(useDesignStore.getState().design.elements.length).toBe(1);
    redo();
    expect(useDesignStore.getState().design.elements.length).toBe(2);
  });

  test("undo past empty is a no-op", () => {
    const { undo } = useDesignStore.getState();
    undo();
    undo();
    expect(useDesignStore.getState().design.elements.length).toBe(0);
    expect(useDesignStore.getState().past.length).toBe(0);
  });

  test("redo past empty is a no-op", () => {
    const { redo } = useDesignStore.getState();
    redo();
    expect(useDesignStore.getState().future.length).toBe(0);
  });

  test("history capped at 50", () => {
    const { addElement } = useDesignStore.getState();
    for (let i = 0; i < 60; i++) addElement("model");
    expect(useDesignStore.getState().past.length).toBe(50);
    expect(useDesignStore.getState().design.elements.length).toBe(60);
  });

  test("mutation clears future", () => {
    const { addElement, undo } = useDesignStore.getState();
    addElement("model");
    addElement("static");
    undo();
    expect(useDesignStore.getState().future.length).toBe(1);
    addElement("cwd");
    expect(useDesignStore.getState().future.length).toBe(0);
  });
});

describe("designStore: importDesign", () => {
  test("replaces design and clears history & selection", () => {
    const { addElement, select, importDesign } = useDesignStore.getState();
    addElement("model");
    const id = useDesignStore.getState().design.elements[0]!.id;
    select(id);
    const imported: Design = {
      version: 1,
      name: "Imported",
      elements: [
        { id: "x1", type: "model", style: {} },
        { id: "x2", type: "static", text: "yo", style: {} },
      ],
    };
    importDesign(imported);
    const state = useDesignStore.getState();
    expect(state.design.name).toBe("Imported");
    expect(state.design.elements.length).toBe(2);
    expect(state.past.length).toBe(0);
    expect(state.future.length).toBe(0);
    expect(state.selectedId).toBeNull();
  });
});

describe("designStore: reset", () => {
  test("clears everything", () => {
    const { addElement, select, reset } = useDesignStore.getState();
    addElement("model");
    addElement("static");
    select(useDesignStore.getState().design.elements[0]!.id);
    reset();
    const state = useDesignStore.getState();
    expect(state.design.name).toBe("Untitled");
    expect(state.design.elements.length).toBe(0);
    expect(state.past.length).toBe(0);
    expect(state.future.length).toBe(0);
    expect(state.selectedId).toBeNull();
  });
});

describe("designStore: persist middleware", () => {
  test("persist API surface is present", () => {
    const persistApi = (useDesignStore as unknown as {
      persist?: {
        getOptions: () => { name?: string };
        rehydrate: () => unknown;
        clearStorage: () => unknown;
      };
    }).persist;
    expect(persistApi).toBeDefined();
    expect(persistApi?.getOptions().name).toBe("statusline-design-v1");
    expect(typeof persistApi?.rehydrate).toBe("function");
    expect(typeof persistApi?.clearStorage).toBe("function");
  });
});

describe("uiStore", () => {
  test("has correct defaults", () => {
    const s = useUiStore.getState();
    expect(s.paletteCollapsed).toBe(false);
    expect(s.inspectorCollapsed).toBe(false);
    expect(s.mockPreset).toBe("default");
    expect(s.osOverride).toBe("auto");
    expect(s.selfHealOptIn).toBe(false);
    expect(typeof s.mockStdinJson).toBe("string");
    expect(() => JSON.parse(s.mockStdinJson)).not.toThrow();
  });

  test("toggles and setters work", () => {
    const {
      togglePalette,
      toggleInspector,
      setMockPreset,
      setOsOverride,
      setSelfHealOptIn,
      setMockStdinJson,
    } = useUiStore.getState();
    const originalMockJson = useUiStore.getState().mockStdinJson;
    togglePalette();
    expect(useUiStore.getState().paletteCollapsed).toBe(true);
    toggleInspector();
    expect(useUiStore.getState().inspectorCollapsed).toBe(true);
    setMockPreset("deep");
    expect(useUiStore.getState().mockPreset).toBe("deep");
    setOsOverride("windows");
    expect(useUiStore.getState().osOverride).toBe("windows");
    setSelfHealOptIn(true);
    expect(useUiStore.getState().selfHealOptIn).toBe(true);
    setMockStdinJson("{\"hello\":1}");
    expect(useUiStore.getState().mockStdinJson).toBe("{\"hello\":1}");
    // reset for next tests
    useUiStore.setState({
      paletteCollapsed: false,
      inspectorCollapsed: false,
      mockPreset: "default",
      mockStdinJson: originalMockJson,
      osOverride: "auto",
      selfHealOptIn: false,
    });
  });

  test("persist middleware is configured", () => {
    const persistApi = (useUiStore as unknown as {
      persist?: { getOptions: () => { name?: string } };
    }).persist;
    expect(persistApi).toBeDefined();
    expect(persistApi?.getOptions().name).toBe("statusline-ui-v1");
  });
});
