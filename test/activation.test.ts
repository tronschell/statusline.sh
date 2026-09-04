import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { subscribeToBuilderStart } from "../src/frontend/components/Builder/BuilderPage";
import { useDesignStore } from "../src/frontend/store/designStore";
import { useUiStore } from "../src/frontend/store/uiStore";
import { TEMPLATES } from "@statusline/shared/templates";

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalUiState = useUiStore.getState();
const gtag = mock((..._args: unknown[]) => {});
let stop = () => {};
let started = { current: false };

beforeEach(() => {
  gtag.mockClear();
  useDesignStore.getState().reset();
  useUiStore.getState().setAutoInsert("none");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { gtag },
  });
  started = { current: false };
});

afterEach(() => {
  stop();
  useUiStore.setState(originalUiState);
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
});

describe("builder activation", () => {
  test("ignores existing designs, selection, preview settings, and same-value edits", () => {
    const store = useDesignStore.getState();
    store.addElement("model");
    const id = useDesignStore.getState().design.elements[0]!.id;
    stop = subscribeToBuilderStart(started);

    store.select(id);
    useUiStore.getState().setOsOverride("windows");
    store.setName("Untitled");
    store.updateElement(id, {});

    expect(gtag).not.toHaveBeenCalled();
    expect(started.current).toBe(false);
  });

  test("records the first actual edit once, including after effect replay", () => {
    stop = subscribeToBuilderStart(started);
    const store = useDesignStore.getState();
    store.addElement("model");
    expect(gtag.mock.calls).toEqual([
      ["event", "builder_start", { element_count: 1 }],
    ]);

    stop();
    stop = subscribeToBuilderStart(started);
    store.addElement("cwd");
    store.setName("A private design name");
    store.undo();
    expect(gtag).toHaveBeenCalledTimes(1);
  });

  test("records a successful template import but not the empty scratch reset", () => {
    stop = subscribeToBuilderStart(started);
    useDesignStore.getState().reset();
    expect(gtag).not.toHaveBeenCalled();

    const template = TEMPLATES[0]!;
    useDesignStore.getState().importDesign(template.design);
    expect(gtag.mock.calls).toEqual([
      ["event", "builder_start", { element_count: template.design.elements.length }],
    ]);
  });

  test("stops observing when the builder unmounts", () => {
    stop = subscribeToBuilderStart(started);
    stop();
    useDesignStore.getState().addElement("model");
    expect(gtag).not.toHaveBeenCalled();
  });

  test("missing or throwing analytics cannot prevent an edit", () => {
    const w = window as unknown as { gtag?: (...args: unknown[]) => void };
    delete w.gtag;
    stop = subscribeToBuilderStart(started);
    const store = useDesignStore.getState();
    expect(() => store.addElement("model")).not.toThrow();
    expect(started.current).toBe(false);

    w.gtag = () => { throw new Error("Analytics unavailable"); };
    expect(() => store.addElement("cwd")).not.toThrow();
    expect(started.current).toBe(false);

    w.gtag = gtag;
    store.addElement("cost");
    expect(useDesignStore.getState().design.elements).toHaveLength(3);
    expect(gtag.mock.calls).toEqual([
      ["event", "builder_start", { element_count: 3 }],
    ]);
  });
});
