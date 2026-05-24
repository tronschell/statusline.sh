import type { Element } from "../../../../shared/types";

export interface FieldsProps<T extends Element = Element> {
  element: T;
  onPatch: (patch: Partial<Element>) => void;
}

export const inputClass =
  "w-full bg-[#1C1C1F] border border-white/[0.06] rounded-[4px] px-3 py-2 text-sm text-[#E8E8E6] focus:outline-none focus:border-[#8FB8DA]";

export const labelClass =
  "text-xs uppercase tracking-wider text-[#8A8A86]";

export const captionClass = "text-xs text-[#8A8A86]";
