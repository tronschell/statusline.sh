import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { useDesignStore } from "../src/frontend/store/designStore";
import { useUiStore } from "../src/frontend/store/uiStore";
import type { Element } from "@statusline/shared/types";

function types(): string[] {
  return useDesignStore.getState().design.elements.map((e) => e.type);
}

beforeEach(() => {
  useDesignStore.getState().reset();
});

afterEach(() => {
  // Leave global auto-insert OFF so other test files (which assume the
  // historical no-op behaviour) are unaffected.
  useUiStore.getState().setAutoInsert("none");
});

describe("auto-insert: separator mode", () => {
  test("drops a separator between two content elements", () => {
    useUiStore.getState().setAutoInsert("separator");
    useUiStore.getState().setAutoSeparatorText(" · ");
    const { addElement } = useDesignStore.getState();
    addElement("model");
    addElement("cwd");
    expect(types()).toEqual(["model", "separator", "cwd"]);
    const sep = useDesignStore.getState().design.elements[1] as Extract<
      Element,
      { type: "separator" }
    >;
    expect(sep.text).toBe(" · ");
  });

  test("no leading separator before the first element", () => {
    useUiStore.getState().setAutoInsert("separator");
    useDesignStore.getState().addElement("model");
    expect(types()).toEqual(["model"]);
  });

  test("does not separate before a structural element or after a line break", () => {
    useUiStore.getState().setAutoInsert("separator");
    const { addElement } = useDesignStore.getState();
    addElement("model");
    addElement("lineBreak"); // structural — no separator before it
    addElement("cwd"); // prev is lineBreak — no separator before it
    expect(types()).toEqual(["model", "lineBreak", "cwd"]);
  });

  test("does not separate when the added element is itself a separator", () => {
    useUiStore.getState().setAutoInsert("separator");
    const { addElement } = useDesignStore.getState();
    addElement("model");
    addElement("separator");
    expect(types()).toEqual(["model", "separator"]);
  });
});

describe("auto-insert: spacer mode", () => {
  test("drops a fixed spacer between two content elements", () => {
    useUiStore.getState().setAutoInsert("spacer");
    useUiStore.getState().setAutoSpacerWidth(3);
    useUiStore.getState().setAutoSpacerChar(" ");
    const { addElement } = useDesignStore.getState();
    addElement("model");
    addElement("cwd");
    expect(types()).toEqual(["model", "spacer", "cwd"]);
    const sp = useDesignStore.getState().design.elements[1] as Extract<
      Element,
      { type: "spacer" }
    >;
    expect(sp.mode).toBe("fixed");
    expect(sp.width).toBe(3);
  });
});

describe("auto-insert: padding mode", () => {
  test("appends a trailing space to the previous element's suffix", () => {
    useUiStore.getState().setAutoInsert("padding");
    const { addElement } = useDesignStore.getState();
    addElement("model");
    addElement("cwd");
    const els = useDesignStore.getState().design.elements;
    // No extra element is inserted — just two content elements.
    expect(els.map((e) => e.type)).toEqual(["model", "cwd"]);
    expect(els[0]!.suffix).toBe(" ");
    expect(els[1]!.suffix).toBeUndefined();
  });

  test("does not stack spaces when the suffix already ends in whitespace", () => {
    useUiStore.getState().setAutoInsert("padding");
    const { addElement, updateElement } = useDesignStore.getState();
    addElement("model");
    const modelId = useDesignStore.getState().design.elements[0]!.id;
    updateElement(modelId, { suffix: " | " } as never);
    addElement("cwd");
    const els = useDesignStore.getState().design.elements;
    expect(els[0]!.suffix).toBe(" | "); // untouched, already ends in a space
  });

  test("does not pad across a line break", () => {
    useUiStore.getState().setAutoInsert("padding");
    const { addElement } = useDesignStore.getState();
    addElement("model");
    addElement("lineBreak");
    addElement("cwd");
    const els = useDesignStore.getState().design.elements;
    expect(els.map((e) => e.type)).toEqual(["model", "lineBreak", "cwd"]);
    // lineBreak isn't content, so cwd doesn't pad it.
    expect(els[1]!.suffix).toBeUndefined();
  });
});

describe("auto-insert: off (default)", () => {
  test("adds nothing extra", () => {
    useUiStore.getState().setAutoInsert("none");
    const { addElement } = useDesignStore.getState();
    addElement("model");
    addElement("cwd");
    expect(types()).toEqual(["model", "cwd"]);
  });
});

describe("auto-insert: addElementAt", () => {
  test("inserts a separator before a content element dropped between two", () => {
    useUiStore.getState().setAutoInsert("none");
    const { addElement, addElementAt } = useDesignStore.getState();
    addElement("model");
    addElement("cwd");
    // turn it on, then drop a branch between model and cwd (index 1)
    useUiStore.getState().setAutoInsert("separator");
    addElementAt("gitBranch", 1);
    // model | branch, then cwd untouched
    expect(types()).toEqual(["model", "separator", "gitBranch", "cwd"]);
  });
});

describe("lastAdd tracking", () => {
  test("records content + separator ids and bumps nonce per add", () => {
    useUiStore.getState().setAutoInsert("separator");
    const { addElement } = useDesignStore.getState();
    addElement("model");
    const first = useDesignStore.getState().lastAdd;
    expect(first?.separatorId).toBeNull();
    const modelId = useDesignStore.getState().design.elements[0]!.id;
    expect(first?.contentId).toBe(modelId);

    addElement("cwd");
    const second = useDesignStore.getState().lastAdd;
    const els = useDesignStore.getState().design.elements;
    expect(second?.contentId).toBe(els[2]!.id); // cwd
    expect(second?.separatorId).toBe(els[1]!.id); // the auto separator
    expect((second?.nonce ?? 0) > (first?.nonce ?? 0)).toBe(true);
  });
});

describe("replaceAllSeparators", () => {
  test("rewrites every separator text in one step", () => {
    useUiStore.getState().setAutoInsert("separator");
    useUiStore.getState().setAutoSeparatorText(" | ");
    const { addElement, replaceAllSeparators } = useDesignStore.getState();
    addElement("model");
    addElement("cwd");
    addElement("gitBranch");
    const pastBefore = useDesignStore.getState().past.length;
    replaceAllSeparators(" · ");
    const seps = useDesignStore
      .getState()
      .design.elements.filter((e) => e.type === "separator") as Array<
      Extract<Element, { type: "separator" }>
    >;
    expect(seps.length).toBe(2);
    expect(seps.every((s) => s.text === " · ")).toBe(true);
    // exactly one new history entry for the whole mass edit
    expect(useDesignStore.getState().past.length).toBe(pastBefore + 1);
  });

  test("null removes all separators", () => {
    useUiStore.getState().setAutoInsert("separator");
    const { addElement, replaceAllSeparators } = useDesignStore.getState();
    addElement("model");
    addElement("cwd");
    replaceAllSeparators(null);
    expect(types()).toEqual(["model", "cwd"]);
  });
});

describe("respaceFromConfig", () => {
  test("converts a template's separators to the chosen padding scheme", () => {
    useDesignStore.getState().importDesign({
      version: 1,
      name: "t",
      elements: [
        { id: "m", type: "model", style: {} },
        { id: "s", type: "separator", text: "· ", style: {} },
        { id: "c", type: "cwd", mode: "basename", style: {} },
      ],
    });
    useUiStore.getState().setAutoInsert("padding");
    useDesignStore.getState().respaceFromConfig();
    const els = useDesignStore.getState().design.elements;
    expect(els.map((e) => e.type)).toEqual(["model", "cwd"]);
    expect(els[0]!.suffix).toBe(" ");
    // one undoable step
    expect(useDesignStore.getState().past.length).toBe(1);
  });

  test("clears selection when the selected element gets stripped", () => {
    useDesignStore.getState().importDesign({
      version: 1,
      name: "t",
      elements: [
        { id: "m", type: "model", style: {} },
        { id: "s", type: "separator", text: "· ", style: {} },
        { id: "c", type: "cwd", mode: "basename", style: {} },
      ],
    });
    useDesignStore.getState().select("s"); // select the separator that will be removed
    useUiStore.getState().setAutoInsert("none");
    useDesignStore.getState().respaceFromConfig();
    expect(useDesignStore.getState().selectedId).toBeNull();
  });
});
