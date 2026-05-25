import type { Element } from "@statusline/shared/types";
import { type FieldsProps, captionClass, labelClass } from "./common";

type OutputStyleElement = Extract<Element, { type: "outputStyle" }>;

export default function OutputStyleFields({
  element,
  onPatch,
}: FieldsProps<OutputStyleElement>) {
  const alwaysShow = element.alwaysShow === true;
  const toggle = () =>
    onPatch({ alwaysShow: !alwaysShow } as Partial<Element>);

  return (
    <div className="flex flex-col gap-3">
      <p className={captionClass}>
        Renders <code className="font-mono text-[11px]">output_style.name</code>
        . By default the chip is hidden when the active style is{" "}
        <code className="font-mono text-[11px]">"default"</code>.
      </p>

      <div className="flex items-center justify-between gap-2 rounded-[4px] border border-white/[0.06] bg-[#1C1C1F] px-3 py-2">
        <div className="flex flex-col">
          <span className={labelClass}>Always show</span>
          <span className="text-xs text-[#8A8A86]">
            Render the chip even when the active style is{" "}
            <code className="font-mono text-[11px]">"default"</code>.
          </span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={alwaysShow}
          onClick={toggle}
          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors ${
            alwaysShow
              ? "border-[#8FB8DA] bg-[#1E2A36]"
              : "border-white/[0.06] bg-[#1C1C1F]"
          }`}
        >
          <span
            className={`inline-block h-3 w-3 transform rounded-full transition-transform ${
              alwaysShow
                ? "translate-x-5 bg-[#8FB8DA]"
                : "translate-x-1 bg-[#8A8A86]"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
