import { useState } from "react";
import { CheckIcon, TerminalWindowIcon } from "@phosphor-icons/react";
import { api } from "../../lib/api";

export interface CopyInstallButtonProps {
  /** Published design id, used to build the `/i/:id.{sh,ps1}` install URL. */
  id: string;
  /**
   * Which OS one-liner to copy. Defaults to the mac/linux
   * `curl -fsSL … | bash` command, which is the broadest single-line installer.
   */
  os?: "mac" | "linux" | "windows";
  className?: string;
}

/**
 * Compact "copy the install command" affordance for community cards. Copies the
 * one-line installer to the clipboard so a visitor can install a published
 * design straight from the gallery without opening its detail page — the
 * browse-intent shortcut that plain listicle galleries don't offer.
 *
 * Mirrors the copy pattern used by CommandBlock on the detail page
 * (navigator.clipboard.writeText + a transient "Copied" state).
 */
export function CopyInstallButton({
  id,
  os = "mac",
  className,
}: CopyInstallButtonProps) {
  const [copied, setCopied] = useState(false);
  const command = api.oneLiner(id, os, false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable (insecure context / denied) — no-op */
    }
  };

  return (
    <button
      type="button"
      onClick={onCopy}
      title={command}
      aria-label={
        copied ? "Install command copied" : `Copy install command: ${command}`
      }
      className={
        "inline-flex w-full items-center justify-between gap-2 rounded-[6px] border border-white/[0.06] bg-black/20 px-2.5 py-1.5 font-mono text-[11px] text-[#8A8A86] transition-colors hover:border-white/[0.14] hover:bg-black/30 hover:text-[#E8E8E6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 " +
        (className ?? "")
      }
    >
      <span className="inline-flex items-center gap-1.5">
        <TerminalWindowIcon size={12} weight="bold" className="shrink-0" />
        Copy install
      </span>
      {copied ? (
        <span className="inline-flex items-center gap-1 text-[#7FB88A]">
          <CheckIcon size={12} weight="bold" />
          Copied
        </span>
      ) : null}
    </button>
  );
}

export default CopyInstallButton;
