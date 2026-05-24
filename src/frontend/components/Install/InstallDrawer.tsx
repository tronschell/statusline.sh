import { useEffect, useMemo, useState } from "react";
import { Copy, Check, ArrowSquareOut } from "@phosphor-icons/react";
import { api } from "../../lib/api";
import { useOsDetect, type DetectedOs } from "../../hooks/useOsDetect";
import { useUiStore } from "../../store/uiStore";
import Modal from "../Modal/Modal";
import { BrandArt } from "../Brand/BrandArt";
import { ClaudeCodeLogo } from "../ClaudeCodeLogo";
import macosIcon from "./icons/macos.webp";
import linuxIcon from "./icons/linux.webp";
import windowsIcon from "./icons/windows.webp";

export type InstallOs = "mac" | "linux" | "windows";

export interface InstallDrawerProps {
  designId: string | null;
  isOpen: boolean;
  onClose(): void;
}

const TABS: { value: InstallOs; label: string; icon: string }[] = [
  { value: "mac", label: "macOS", icon: macosIcon },
  { value: "linux", label: "Linux", icon: linuxIcon },
  { value: "windows", label: "Windows", icon: windowsIcon },
];

function detectedToInstall(d: DetectedOs): InstallOs {
  if (d === "mac" || d === "linux" || d === "windows") return d;
  return "mac";
}

export default function InstallDrawer({
  designId,
  isOpen,
  onClose,
}: InstallDrawerProps) {
  const detected = useOsDetect();
  const [os, setOs] = useState<InstallOs>(() => detectedToInstall(detected));
  const [userPicked, setUserPicked] = useState(false);
  const [copied, setCopied] = useState(false);

  const selfHeal = useUiStore((s) => s.selfHealOptIn);
  const setSelfHeal = useUiStore((s) => s.setSelfHealOptIn);

  // Auto-update OS from detection until the user explicitly picks one.
  useEffect(() => {
    if (!userPicked) setOs(detectedToInstall(detected));
  }, [detected, userPicked]);

  // Reset transient UI when the drawer (re)opens.
  useEffect(() => {
    if (isOpen) setCopied(false);
  }, [isOpen]);

  const oneLiner = useMemo(() => {
    if (!designId) return "";
    return api.oneLiner(designId, os, selfHeal);
  }, [designId, os, selfHeal]);

  const directUrl = useMemo(() => {
    if (!designId) return "";
    return api.installUrl(designId, os, selfHeal);
  }, [designId, os, selfHeal]);

  const ext = os === "windows" ? "ps1" : "sh";

  async function onCopy() {
    if (!oneLiner) return;
    try {
      await navigator.clipboard.writeText(oneLiner);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Install statusline.sh"
      widthClass="max-w-lg"
    >
      {!designId ? (
        <p className="text-sm text-[#8A8A86]">
          Save the design first to get an install command.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          <BrandArt size="sm" className="text-[#E8E8E6]" />
          <div>
            <p className="text-sm text-[#8A8A86]">Run this in your terminal.</p>
          </div>

          <div className="flex border-b border-white/[0.06]">
            {TABS.map((t) => {
              const active = t.value === os;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => {
                    setOs(t.value);
                    setUserPicked(true);
                  }}
                  className={
                    "flex items-center gap-2 px-4 py-2 text-sm transition-colors " +
                    (active
                      ? "border-b-2 border-[#E8E8E6] text-[#E8E8E6] -mb-px"
                      : "border-b-2 border-transparent text-[#8A8A86] hover:text-[#E8E8E6]")
                  }
                  aria-pressed={active}
                >
                  <img
                    src={t.icon}
                    alt=""
                    aria-hidden="true"
                    width={16}
                    height={16}
                    className={
                      "h-4 w-4 transition-opacity " +
                      (active ? "opacity-100" : "opacity-60")
                    }
                  />
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-start gap-2">
            <code className="flex-1 font-mono bg-[#0E0E10] border border-white/[0.06] rounded-[6px] px-3 py-2 text-sm overflow-x-auto select-all whitespace-pre">
              {oneLiner}
            </code>
            <button
              type="button"
              onClick={onCopy}
              aria-label="Copy install command"
              className="flex items-center gap-1.5 rounded-[4px] border border-white/[0.06] bg-[#1C1C1F] px-3 py-2 text-xs uppercase tracking-wider text-[#E8E8E6] transition-transform hover:scale-[0.98]"
            >
              {copied ? (
                <>
                  <Check size={12} weight="bold" />
                  Copied
                </>
              ) : (
                <>
                  <Copy size={12} weight="bold" />
                  Copy
                </>
              )}
            </button>
          </div>

          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm text-[#E8E8E6]">
              <input
                type="checkbox"
                checked={selfHeal}
                onChange={(e) => setSelfHeal(e.target.checked)}
                className="h-3.5 w-3.5 accent-[#8FB8DA]"
              />
              <span>Self-heal opt-in</span>
            </label>
            <p className="text-xs text-[#8A8A86] pl-6">
              If anything goes wrong, runs <code className="font-mono">claude -p</code> to fix your settings.json. Uses Claude credits.
            </p>
          </div>

          <section className="flex flex-col gap-2">
            <h3 className="text-xs uppercase tracking-wider text-[#8A8A86]">
              Or download the script directly
            </h3>
            <a
              href={directUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-[#8FB8DA] hover:underline"
            >
              <span className="font-mono">/i/{designId}.{ext}</span>
              <ArrowSquareOut size={12} weight="bold" />
            </a>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-xs uppercase tracking-wider text-[#8A8A86]">
              What this does
            </h3>
            <ul className="flex flex-col gap-1.5 text-sm text-[#E8E8E6]">
              <li className="flex gap-2">
                <span className="text-[#8A8A86]">·</span>
                <span>Writes statusline script to <code className="font-mono">~/.claude/</code>.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#8A8A86]">·</span>
                <span>Backs up your existing <code className="font-mono">settings.json</code>.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#8A8A86]">·</span>
                <span>Patches <code className="font-mono">settings.json</code> to use the new statusline.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#8A8A86]">·</span>
                <span className="inline-flex flex-wrap items-center gap-x-1.5">
                  Restart
                  <ClaudeCodeLogo size={12} title="Claude Code" />
                  Claude Code to see it.
                </span>
              </li>
            </ul>
          </section>
        </div>
      )}
    </Modal>
  );
}
