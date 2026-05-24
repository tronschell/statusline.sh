import { Plus, Trash } from "@phosphor-icons/react";
import type { Element } from "@statusline/shared/types";
import {
  type FieldsProps,
  captionClass,
  inputClass,
  labelClass,
} from "./common";

type RotatorElement = Extract<Element, { type: "rotator" }>;

const EMOJI_PRESETS: ReadonlyArray<{ label: string; items: string[] }> = [
  { label: "Sparkle", items: ["✨", "🌙", "⚡", "🔥", "🌈"] },
  { label: "Spinner", items: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] },
  { label: "Moon", items: ["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"] },
  { label: "Cat", items: ["🐱", "😺", "😸", "😻", "🙀", "😼"] },
  { label: "Bar", items: ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█", "▇", "▆", "▅", "▄", "▃", "▂"] },
];

export default function RotatorFields({
  element,
  onPatch,
}: FieldsProps<RotatorElement>) {
  function setItems(items: string[]) {
    onPatch({ items } as Partial<Element>);
  }
  function setItem(idx: number, v: string) {
    const next = element.items.slice();
    next[idx] = v;
    setItems(next);
  }
  function removeItem(idx: number) {
    if (element.items.length <= 1) return;
    const next = element.items.slice();
    next.splice(idx, 1);
    setItems(next);
  }
  function addItem() {
    setItems([...element.items, "✨"]);
  }
  function setIntervalSeconds(v: string) {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 1) return;
    onPatch({ intervalSeconds: Math.round(n) } as Partial<Element>);
  }
  function setMode(pickMode: "cycle" | "random") {
    onPatch({ pickMode } as Partial<Element>);
  }
  function applyPreset(items: string[]) {
    setItems(items);
  }

  return (
    <div className="flex flex-col gap-4">
      <p className={captionClass}>
        Rotates through items each time the statusline refreshes. Cycle uses
        a time-based clock so all turns within an interval show the same item;
        random picks a different item on every refresh.
      </p>

      <div className="flex flex-col gap-2">
        <label className={labelClass}>Mode</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode("cycle")}
            className={`flex-1 rounded-[4px] border px-3 py-2 text-xs uppercase tracking-wider transition-colors ${
              element.pickMode === "cycle"
                ? "border-[#8FB8DA] bg-[#1E2A36] text-[#E8E8E6]"
                : "border-white/[0.06] bg-[#1C1C1F] text-[#8A8A86] hover:text-[#E8E8E6]"
            }`}
          >
            Cycle
          </button>
          <button
            type="button"
            onClick={() => setMode("random")}
            className={`flex-1 rounded-[4px] border px-3 py-2 text-xs uppercase tracking-wider transition-colors ${
              element.pickMode === "random"
                ? "border-[#8FB8DA] bg-[#1E2A36] text-[#E8E8E6]"
                : "border-white/[0.06] bg-[#1C1C1F] text-[#8A8A86] hover:text-[#E8E8E6]"
            }`}
          >
            Random
          </button>
        </div>
      </div>

      {element.pickMode === "cycle" && (
        <div className="flex flex-col gap-2">
          <label className={labelClass}>Interval (seconds)</label>
          <input
            type="number"
            min={1}
            max={3600}
            value={element.intervalSeconds}
            onChange={(e) => setIntervalSeconds(e.target.value)}
            className={inputClass}
          />
          <p className={captionClass}>
            Item advances every {element.intervalSeconds}s based on the system
            clock — feels alive without persistent state.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label className={labelClass}>Items ({element.items.length})</label>
        <div className="flex flex-col gap-1.5">
          {element.items.map((it, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={it}
                onChange={(e) => setItem(i, e.target.value)}
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => removeItem(i)}
                disabled={element.items.length <= 1}
                aria-label={`Remove item ${i + 1}`}
                className="flex items-center justify-center w-8 h-8 shrink-0 rounded-[4px] border border-white/[0.06] bg-[#1C1C1F] text-[#8A8A86] transition-colors hover:text-[#E89B9E] hover:border-[#3A1F21] disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Trash size={13} weight="bold" />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addItem}
          className="flex items-center justify-center gap-1.5 rounded-[4px] border border-dashed border-white/[0.08] bg-transparent px-3 py-1.5 text-xs uppercase tracking-wider text-[#8A8A86] transition-colors hover:text-[#E8E8E6] hover:border-white/[0.16]"
        >
          <Plus size={12} weight="bold" />
          Add item
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <label className={labelClass}>Presets</label>
        <div className="flex flex-wrap gap-1.5">
          {EMOJI_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => applyPreset(p.items)}
              className="rounded-[4px] border border-white/[0.06] bg-[#1C1C1F] px-2.5 py-1.5 text-xs text-[#E8E8E6] transition-colors hover:border-white/[0.16]"
              title={p.items.join(" ")}
            >
              <span className="text-[#8A8A86] mr-1.5">{p.label}</span>
              <span className="font-mono">
                {p.items.slice(0, 4).join("")}
                {p.items.length > 4 ? "…" : ""}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
