import {
  ArrowCounterClockwise,
  ArrowClockwise,
  ShareNetwork,
  CheckIcon,
  GearSix,
} from "@phosphor-icons/react";
import { useDesignStore } from "../../store/designStore";
import { ClaudeCodeLogo } from "../ClaudeCodeLogo";
import { SaveToLibraryButton } from "../Account/SaveToLibraryButton";
import { ACCOUNTS_ENABLED } from "../../lib/config";
import { useCloudStore } from "../../store/cloudStore";
import { GooglePrivacyChoices } from "../Legal/GooglePrivacyChoices";

export interface TopBarProps {
  slug: string | null;
  onOpenInstall(): void;
  onOpenPublish(): void;
  onOpenSettings(): void;
}

const btnGhost =
  "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[6px] px-2 text-[13px] text-[#A8A8A4] transition-colors hover:bg-white/[0.05] hover:text-[#E8E8E6] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-[#A8A8A4] lg:px-2.5";
const btnPrimary =
  "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[6px] bg-[#E8E8E6] px-3 text-[13px] font-medium text-[#0E0E10] transition-transform duration-150 hover:scale-[0.98] active:scale-[0.96] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E0E10] lg:px-3.5";

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

  const cloud = useCloudStore((s) => s.current);
  const status: string = slug
    ? `Published as ${shortIdLabel(slug)}`
    : ACCOUNTS_ENABLED && cloud
      ? cloud.teamId
        ? `Team design · v${cloud.version}`
        : `Library · v${cloud.version}`
      : "Auto-saved";

  return (
    <div className="z-30 border-b border-white/[0.06] bg-[#0E0E10] sm:sticky sm:top-[61px]">
      <div className="mx-auto flex max-w-[1560px] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 sm:px-6 lg:h-14 lg:flex-nowrap lg:px-8 lg:py-0">
        <div className="flex min-w-0 flex-1 basis-[14rem] items-center gap-x-3">
          <input
            type="text"
            value={design.name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Design name"
            placeholder="Untitled"
            className="min-w-[3rem] max-w-[22rem] [field-sizing:content] border-0 border-b border-transparent bg-transparent px-0 py-1 font-serif text-[24px] leading-none tracking-tight text-[#F2F2F0] placeholder:text-[#5A5A57] transition-colors hover:border-white/[0.14] focus:border-[#8FB8DA] focus:outline-none"
          />
          <div
            className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[12px] text-[#6F6F6B]"
            aria-live="polite"
          >
            <CheckIcon size={12} weight="bold" aria-hidden />
            {status}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-0.5 lg:gap-1">
          <button
            type="button"
            onClick={undo}
            disabled={past.length === 0}
            aria-label="Undo"
            title="Undo (Cmd/Ctrl+Z)"
            className={btnGhost}
          >
            <ArrowCounterClockwise size={14} weight="bold" />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={future.length === 0}
            aria-label="Redo"
            title="Redo (Cmd/Ctrl+Shift+Z)"
            className={btnGhost}
          >
            <ArrowClockwise size={14} weight="bold" />
          </button>

          <span aria-hidden="true" className="mx-1.5 h-4 w-px bg-white/[0.1]" />

          <button
            type="button"
            onClick={onOpenSettings}
            className={btnGhost}
            aria-label="Settings"
            title="Settings"
          >
            <GearSix size={14} weight="bold" />
            <span className="hidden lg:inline">Settings</span>
          </button>

          {ACCOUNTS_ENABLED ? <SaveToLibraryButton /> : null}

          <button
            type="button"
            onClick={onOpenPublish}
            className={btnGhost}
            aria-label="Publish to community"
            title="Publish to community"
          >
            <ShareNetwork size={14} weight="bold" />
            <span className="hidden lg:inline">Publish</span>
          </button>

          <button
            type="button"
            onClick={onOpenInstall}
            className={`${btnPrimary} ml-2`}
            aria-label="Install in Claude Code"
          >
            Install
            <span className="hidden sm:inline">in</span>
            <ClaudeCodeLogo size={13} />
            <span className="hidden sm:inline">Claude Code</span>
          </button>
        </div>
        <GooglePrivacyChoices as="div" />
      </div>
    </div>
  );
}
