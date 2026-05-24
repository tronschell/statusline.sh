import { useEffect, useMemo, useState } from "react";
import { Copy, Check, ArrowSquareOut, CaretDown, DownloadSimple } from "@phosphor-icons/react";
import { compileToBash } from "@statusline/shared/compiler/bash";
import { compileToPS } from "@statusline/shared/compiler/powershell";
import { bashInstallerTemplate } from "@statusline/shared/install/bashTemplate";
import { psInstallerTemplate } from "@statusline/shared/install/psTemplate";
import { api } from "../../lib/api";
import { TurnstileWidget } from "../../lib/turnstile";
import { useDesignStore } from "../../store/designStore";
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
  /**
   * If provided, the drawer uses this published design id directly. If null,
   * the drawer mints an anonymous install id from the live Zustand design
   * once the user solves Turnstile.
   */
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
  const design = useDesignStore((s) => s.design);
  const detected = useOsDetect();
  const [os, setOs] = useState<InstallOs>(() => detectedToInstall(detected));
  const [userPicked, setUserPicked] = useState(false);
  const [copied, setCopied] = useState(false);
  const [scriptOpen, setScriptOpen] = useState(false);
  const [scriptContent, setScriptContent] = useState<string | null>(null);
  const [scriptError, setScriptError] = useState<string | null>(null);

  // Anonymous install state (only used when designId is null).
  const [mintedId, setMintedId] = useState<string | null>(null);
  const [minting, setMinting] = useState(false);
  const [mintError, setMintError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [turnstileError, setTurnstileError] = useState<string | null>(null);

  const selfHeal = useUiStore((s) => s.selfHealOptIn);
  const setSelfHeal = useUiStore((s) => s.setSelfHealOptIn);

  // The effective id used for URL generation. Either the passed-in published
  // id or the anonymous id we minted in this session.
  const effectiveId = designId ?? mintedId;

  // Auto-update OS from detection until the user explicitly picks one.
  useEffect(() => {
    if (!userPicked) setOs(detectedToInstall(detected));
  }, [detected, userPicked]);

  // Reset transient UI when the drawer (re)opens.
  useEffect(() => {
    if (isOpen) setCopied(false);
  }, [isOpen]);

  // Mint an anonymous install id once we have a Turnstile token and no
  // designId. Cache the minted id so we don't re-mint on every render.
  useEffect(() => {
    if (!isOpen) return;
    if (designId) return; // published id provided — no mint needed
    if (mintedId) return; // already minted this session
    if (!token) return; // waiting for turnstile
    if (minting) return; // already in flight

    setMinting(true);
    setMintError(null);
    api
      .installAnonymous(design, token)
      .then((res) => {
        setMintedId(res.id);
      })
      .catch((e: unknown) => {
        setMintError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        setMinting(false);
      });
  }, [isOpen, designId, mintedId, token, minting, design]);

  const directUrl = useMemo(() => {
    if (!effectiveId) return "";
    return api.installUrl(effectiveId, os, selfHeal);
  }, [effectiveId, os, selfHeal]);

  // Invalidate the inspected script whenever the target URL changes.
  useEffect(() => {
    setScriptContent(null);
    setScriptError(null);
  }, [directUrl]);

  // Lazy-fetch the script body only when the user opens the inspector.
  useEffect(() => {
    if (!scriptOpen || !directUrl || scriptContent !== null) return;
    let cancelled = false;
    fetch(directUrl)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((t) => {
        if (!cancelled) setScriptContent(t);
      })
      .catch((e: unknown) => {
        if (!cancelled) setScriptError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [scriptOpen, directUrl, scriptContent]);

  const oneLiner = useMemo(() => {
    if (!effectiveId) return "";
    return api.oneLiner(effectiveId, os, selfHeal);
  }, [effectiveId, os, selfHeal]);

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

  // Turnstile-free fallback: compile the installer locally in the browser and
  // trigger a download. Used when the Cloudflare Turnstile widget can't reach
  // challenges.cloudflare.com (ad blocker, DNS filter, network block) and the
  // user therefore can't mint an anonymous install id via /install.
  function downloadInstaller(targetOs: InstallOs) {
    const isWindows = targetOs === "windows";
    const body = isWindows
      ? psInstallerTemplate(compileToPS(design))
      : bashInstallerTemplate(compileToBash(design));
    const mime = isWindows
      ? "text/plain;charset=utf-8"
      : "text/x-shellscript;charset=utf-8";
    const filename = isWindows ? "statusline-install.ps1" : "statusline-install.sh";
    const blob = new Blob([body], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Install statusline.sh"
      widthClass="max-w-lg"
    >
      <div className="flex flex-col gap-6">
        <BrandArt size="sm" className="text-[#E8E8E6]" />
        <div>
          <p className="text-sm text-[#8A8A86]">Run this in your terminal.</p>
        </div>

        {!effectiveId ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-[#8A8A86]">
              Complete the challenge below to generate your install command.
            </p>
            <TurnstileWidget
              key={turnstileError ?? "ok"}
              onToken={(t) => {
                setTurnstileError(null);
                setToken(t);
              }}
              onError={(code) => {
                setToken(null);
                setTurnstileError(code);
              }}
            />
            {turnstileError ? (
              <div
                className="flex flex-col gap-3 rounded-[4px] border border-[#E8A08A]/30 bg-[#E8A08A]/[0.06] px-3 py-3 text-xs text-[#E8A08A]"
                role="alert"
              >
                <div>
                  <p>
                    Turnstile couldn't connect (code{" "}
                    <code className="font-mono">{turnstileError}</code>).
                  </p>
                  <p className="mt-1 text-[#E8A08A]/80">
                    Most likely an ad blocker, DNS filter (NextDNS / Pi-hole),
                    or browser extension is blocking{" "}
                    <code className="font-mono">challenges.cloudflare.com</code>.
                    Allowlist it and reload — or use the fallback below.
                  </p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <p className="text-[#E8E8E6]">
                    Fallback — no challenge required:
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        downloadInstaller(detectedToInstall(detected))
                      }
                      className="flex items-center gap-1.5 rounded-[4px] border border-white/[0.12] bg-[#1C1C1F] px-3 py-1.5 text-xs text-[#E8E8E6] transition-transform hover:scale-[0.98]"
                    >
                      <DownloadSimple size={12} weight="bold" />
                      Download .sh
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadInstaller("windows")}
                      className="flex items-center gap-1.5 rounded-[4px] border border-white/[0.12] bg-[#1C1C1F] px-3 py-1.5 text-xs text-[#E8E8E6] transition-transform hover:scale-[0.98]"
                    >
                      <DownloadSimple size={12} weight="bold" />
                      Download .ps1
                    </button>
                  </div>
                  <p className="text-[#8A8A86]">
                    Then run <code className="font-mono">bash ~/Downloads/statusline-install.sh</code>
                    {" "}(or the equivalent for PowerShell).
                  </p>
                </div>
              </div>
            ) : null}
            {minting ? (
              <p className="text-xs text-[#8A8A86]">Preparing your install…</p>
            ) : null}
            {mintError ? (
              <p className="text-xs text-[#E8A08A]" role="alert">
                {mintError}
              </p>
            ) : null}
          </div>
        ) : (
          <>
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

            <div className="flex flex-col gap-1.5">
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

              <button
                type="button"
                onClick={() => setScriptOpen((o) => !o)}
                aria-expanded={scriptOpen}
                className="flex w-fit items-center gap-1.5 text-[11px] text-[#8A8A86] transition-colors hover:text-[#E8E8E6]"
              >
                <CaretDown
                  size={9}
                  weight="bold"
                  className={`shrink-0 transition-transform ${scriptOpen ? "rotate-0" : "-rotate-90"}`}
                />
                {scriptOpen ? "Hide script" : "Inspect exactly what runs"}
              </button>
              {scriptOpen && (
                <pre className="max-h-48 overflow-auto whitespace-pre rounded-[6px] border border-white/[0.06] bg-[#0E0E10] px-3 py-2 font-mono text-[11px] leading-relaxed text-[#8A8A86]">
                  {scriptError
                    ? `Failed to load: ${scriptError}`
                    : (scriptContent ?? "Loading…")}
                </pre>
              )}
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
                <span className="font-mono">/i/{effectiveId}.{ext}</span>
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
          </>
        )}
      </div>
    </Modal>
  );
}
