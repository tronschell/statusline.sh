import type { Element } from "@statusline/shared/types";

export interface FieldsProps<T extends Element = Element> {
  element: T;
  onPatch: (patch: Partial<Element>) => void;
}

export const inputClass =
  "w-full rounded-none border-0 border-b border-white/[0.12] bg-transparent px-0 py-1.5 text-[14px] text-[#E8E8E6] placeholder:text-[#5A5A57] transition-colors hover:border-white/[0.24] focus:border-[#8FB8DA] focus:outline-none";

export const labelClass =
  "text-[11px] uppercase tracking-[0.12em] text-[#8A8A86]";

export const captionClass = "text-[12px] text-[#6F6F6B]";

/** Selectable row (radio-style option). Selected = soft tint, no border. */
export const optionRowClass = (active: boolean, align: "start" | "center" = "center") =>
  `-mx-2 flex w-[calc(100%+1rem)] ${align === "start" ? "items-start" : "items-center"} gap-3 rounded-[6px] px-2 py-1.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8FB8DA]/40 ${
    active ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
  }`;

/** Underlined text tabs (segmented control replacement). */
export const tabListClass = "flex gap-5 border-b border-white/[0.08]";
export const tabClass = (active: boolean) =>
  `-mb-px border-b px-0 py-1.5 text-[12px] transition-colors focus:outline-none focus-visible:text-[#E8E8E6] ${
    active
      ? "border-[#E8E8E6] text-[#E8E8E6]"
      : "border-transparent text-[#8A8A86] hover:text-[#E8E8E6]"
  }`;

/** Nested settings group: hairline rule on the left instead of a box. */
export const nestedClass = "flex flex-col gap-3 border-l border-white/[0.1] pl-4";
