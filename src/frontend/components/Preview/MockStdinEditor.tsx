import { useMemo, useState } from "react";
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
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs uppercase tracking-wider text-[#8A8A86] hover:text-[#E8E8E6] transition-colors"
      >
        {open ? "Hide ▴" : "Edit mock data ▾"}
      </button>
      {open ? (
        <div className="mt-2 space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-xs uppercase tracking-wider text-[#8A8A86]">
              Preset
            </label>
            <select
              defaultValue="__custom"
              onChange={(e) => onPreset(e.target.value)}
              className="cursor-pointer bg-[#161618] border border-white/[0.06] rounded-[6px] text-xs px-2.5 py-1.5 text-[#E8E8E6] transition-colors hover:border-white/[0.18] focus:border-white/[0.18] focus:outline-none"
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
            className="w-full h-64 bg-[#161618] border border-white/[0.06] rounded-[6px] p-3 font-mono text-xs text-[#E8E8E6] resize-y"
          />
          {validationError ? (
            <p className="text-xs text-[#E89B9E]">
              Invalid JSON: {validationError}
            </p>
          ) : (
            <p className="text-xs text-[#8A8A86]">JSON valid</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
