/**
 * Minimal DOM stub for unit-testing `applyHeadMeta` without pulling in jsdom or
 * happy-dom (neither is a dependency of this project). It implements only the
 * surface that `applyHeadMeta`/`resolveHeadMeta` touch:
 *
 *  - `document.createElement(tag)`
 *  - `document.title` (get/set)
 *  - `document.head.{appendChild,querySelector,querySelectorAll}`
 *  - element `{tagName, setAttribute, getAttribute, remove, textContent, dataset}`
 *
 * Selector support is restricted to attribute-equality forms actually used:
 *   `meta[name="x"]`, `meta[property="x"]`, `link[rel="canonical"]`, and
 *   `script[type="application/ld+json"][data-seo="route"]`.
 */

export interface StubElement {
  tagName: string;
  attributes: Record<string, string>;
  textContent: string;
  dataset: Record<string, string>;
  parent: StubElement | null;
  setAttribute(name: string, value: string): void;
  getAttribute(name: string): string | null;
  remove(): void;
}

interface AttrFilter {
  name: string;
  value: string;
}

interface ParsedSelector {
  tag: string;
  attrs: AttrFilter[];
}

const DATA_ATTR_RE = /^data-(.+)$/;

function camelize(kebab: string): string {
  return kebab.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

function makeElement(tag: string): StubElement {
  const el: StubElement = {
    tagName: tag.toUpperCase(),
    attributes: {},
    textContent: "",
    dataset: {},
    parent: null,
    setAttribute(name, value) {
      this.attributes[name] = value;
      const m = DATA_ATTR_RE.exec(name);
      if (m && m[1]) this.dataset[camelize(m[1])] = value;
    },
    getAttribute(name) {
      return name in this.attributes ? this.attributes[name]! : null;
    },
    remove() {
      if (!this.parent) return;
      const siblings = (this.parent as HeadElement).children;
      const idx = siblings.indexOf(this);
      if (idx >= 0) siblings.splice(idx, 1);
      this.parent = null;
    },
  };
  // Keep dataset writes in sync with attributes for the one prop we set
  // directly (`script.dataset.seo = "route"`): proxy it so reads via
  // attribute selectors still match.
  return new Proxy(el, {
    set(target, prop, value) {
      if (prop === "dataset") {
        target.dataset = value as Record<string, string>;
        return true;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (target as any)[prop] = value;
      return true;
    },
  });
}

interface HeadElement extends StubElement {
  children: StubElement[];
  appendChild(child: StubElement): StubElement;
  querySelector(sel: string): StubElement | null;
  querySelectorAll(sel: string): StubElement[];
}

function parseSelector(selector: string): ParsedSelector {
  const tagMatch = /^([a-zA-Z]+)/.exec(selector);
  const tag = (tagMatch?.[1] ?? "").toLowerCase();
  const attrs: AttrFilter[] = [];
  const re = /\[([^\]=]+)="([^"]*)"\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(selector))) {
    attrs.push({ name: m[1]!, value: m[2]! });
  }
  return { tag, attrs };
}

function matches(el: StubElement, parsed: ParsedSelector): boolean {
  if (parsed.tag && el.tagName.toLowerCase() !== parsed.tag) return false;
  return parsed.attrs.every((a) => {
    // dataset attrs (`data-seo`) may have been set via `el.dataset.seo`
    const direct = el.getAttribute(a.name);
    if (direct !== null) return direct === a.value;
    const dm = DATA_ATTR_RE.exec(a.name);
    if (dm && dm[1]) return el.dataset[camelize(dm[1])] === a.value;
    return false;
  });
}

export interface StubDocument {
  title: string;
  head: HeadElement;
  createElement(tag: string): StubElement;
}

export function makeStubDocument(): StubDocument {
  const head = makeElement("head") as HeadElement;
  head.children = [];
  head.appendChild = function (child: StubElement) {
    child.parent = head;
    head.children.push(child);
    return child;
  };
  head.querySelector = function (sel: string) {
    const parsed = parseSelector(sel);
    return head.children.find((c) => matches(c, parsed)) ?? null;
  };
  head.querySelectorAll = function (sel: string) {
    const parsed = parseSelector(sel);
    const found = head.children.filter((c) => matches(c, parsed));
    // Mimic NodeList.forEach used by applyHeadMeta.
    return Object.assign(found, {
      forEach(cb: (el: StubElement) => void) {
        for (const el of [...found]) cb(el);
      },
    });
  };

  return {
    title: "",
    head,
    createElement(tag: string) {
      return makeElement(tag);
    },
  };
}
