import { useMemo, useState } from "react";
import { CaretDown } from "@phosphor-icons/react";
import { useUiStore } from "../../store/uiStore";
import { MOCK_PRESETS } from "@statusline/shared/mockStdin";

// Human-readable labels for the known preset keys. The option `value` stays
// the raw key so `onPreset` still resolves against MOCK_PRESETS.
const PRESET_LABELS: Record<string, string> = {
  fresh: "Fresh",
  deep: "Deep session",
  highTokens: "High tokens",
  mainBranch: "Main branch",
  noGit: "No git",
  thinkingOff: "Thinking off",
  fastMode: "Fast mode",
  defaultStyle: "Default style",
};

// Fallback for any preset key not in the map: camelCase → "Title case".
function humanizePresetKey(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  if (!spaced) return key;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function presetLabel(key: string): string {
  return PRESET_LABELS[key] ?? humanizePresetKey(key);
}

export function MockStdinEditor() {
  const mockStdinJson = useUiStore((s) => s.mockStdinJson);
  const setMockStdinJson = useUiStore((s) => s.setMockStdinJson);
  const [open, setOpen] = useState(false);

  const validationError = useMemo(() => {
    try {
      JSON.parse(mockStdinJson);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : "Invalid JSON";
    }
  }, [mockStdinJson]);

  function onChange(next: string) {
    // We always write the raw text so the editor stays editable even with
    // intermediate invalid states; consumers fall back to DEFAULT_MOCK_STDIN
    // when the JSON cannot be parsed.
    setMockStdinJson(next);
  }

  function onPreset(key: string) {
    if (key === "__custom") return;
    const preset = MOCK_PRESETS[key];
    if (!preset) return;
    setMockStdinJson(JSON.stringify(preset, null, 2));
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 text-[13px] text-[#8A8A86] transition-colors hover:text-[#E8E8E6] focus:outline-none focus-visible:text-[#E8E8E6]"
      >
        <CaretDown
          size={11}
          weight="bold"
          className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
        {open ? "Hide mock data" : "Edit mock data"}
      </button>
      {open ? (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-3">
            <label
              htmlFor="mock-preset"
              className="text-[11px] uppercase tracking-[0.12em] text-[#8A8A86]"
            >
              Preset
            </label>
            <select
              id="mock-preset"
              defaultValue="__custom"
              onChange={(e) => onPreset(e.target.value)}
              className="cursor-pointer border-0 border-b border-white/[0.12] bg-transparent py-1 pr-2 text-[13px] text-[#E8E8E6] transition-colors hover:border-white/[0.24] focus:border-[#8FB8DA] focus:outline-none"
            >
              <option value="__custom">Custom</option>
              {Object.keys(MOCK_PRESETS).map((k) => (
                <option key={k} value={k}>
                  {presetLabel(k)}
                </option>
              ))}
            </select>
          </div>
          <textarea
            value={mockStdinJson}
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
            aria-label="Mock statusline JSON"
            className="h-64 w-full resize-y rounded-[10px] border border-white/[0.08] bg-[#0A0A0B] p-4 font-mono text-[12px] leading-relaxed text-[#E8E8E6] transition-colors hover:border-white/[0.16] focus:border-[#8FB8DA] focus:outline-none"
          />
          {validationError ? (
            <p className="border-l-2 border-[#E89B9E]/60 pl-3 text-[12px] text-[#E89B9E]">
              Invalid JSON: {validationError}
            </p>
          ) : (
            <p className="text-[12px] text-[#6F6F6B]">JSON valid</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
