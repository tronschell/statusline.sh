import {
  ArrowCounterClockwise,
  ArrowClockwise,
  Globe,
  GearSix,
} from "@phosphor-icons/react";
import { useDesignStore } from "../../store/designStore";
import { ClaudeCodeLogo } from "../ClaudeCodeLogo";

export interface TopBarProps {
  slug: string | null;
  onOpenInstall(): void;
  onOpenPublish(): void;
  onOpenSettings(): void;
}

const btnBase =
  "flex items-center gap-1.5 rounded-[4px] border border-white/[0.06] bg-[#1C1C1F] px-3 py-2 text-xs uppercase tracking-wider text-[#E8E8E6] transition-transform hover:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40";
const btnPrimary =
  "flex items-center gap-1.5 rounded-[4px] border border-white/[0.06] bg-[#E8E8E6] px-3 py-2 text-xs uppercase tracking-wider text-[#0E0E10] transition-transform hover:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40";

function shortIdLabel(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id;
}

export default function TopBar({
  slug,
  onOpenInstall,
  onOpenPublish,
  onOpenSettings,
}: TopBarProps) {
  const design = useDesignStore((s) => s.design);
  const setName = useDesignStore((s) => s.setName);
  const undo = useDesignStore((s) => s.undo);
  const redo = useDesignStore((s) => s.redo);
  const past = useDesignStore((s) => s.past);
  const future = useDesignStore((s) => s.future);

  const status: string = slug ? `Published as ${shortIdLabel(slug)}` : "Auto-saved";

  return (
    <div className="sticky top-0 z-30 -mx-8 mb-6 border-b border-white/[0.06] bg-[#0E0E10]/85 px-8 py-3 backdrop-blur-sm">
      <div className="flex items-center gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <input
            type="text"
            value={design.name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Design name"
            placeholder="Untitled"
            className="min-w-0 flex-1 max-w-xs bg-transparent border-b border-transparent px-1 py-1 text-sm font-medium text-[#E8E8E6] focus:border-white/[0.12] focus:outline-none"
          />
        </div>

        <div className="hidden text-xs text-[#8A8A86] sm:block" aria-live="polite">
          {status}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={undo}
            disabled={past.length === 0}
            aria-label="Undo"
            title="Undo (Cmd/Ctrl+Z)"
            className={btnBase}
          >
            <ArrowCounterClockwise size={12} weight="bold" />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={future.length === 0}
            aria-label="Redo"
            title="Redo (Cmd/Ctrl+Shift+Z)"
            className={btnBase}
          >
            <ArrowClockwise size={12} weight="bold" />
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            className={btnBase}
            aria-label="Settings"
            title="Settings"
          >
            <GearSix size={12} weight="bold" />
            Settings
          </button>

          <button
            type="button"
            onClick={onOpenPublish}
            className={btnBase}
            aria-label="Publish to community"
          >
            <Globe size={12} weight="bold" />
            Publish
          </button>

          <button
            type="button"
            onClick={onOpenInstall}
            className={btnPrimary}
            aria-label="Install in Claude Code"
          >
            <>
              Install in
              <ClaudeCodeLogo size={12} className="ml-0.5" />
              Claude Code
            </>
          </button>
        </div>
      </div>
    </div>
  );
}
