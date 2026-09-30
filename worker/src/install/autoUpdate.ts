/**
 * Auto-update prelude for permanent (cloud) install links.
 *
 * Applied to the *compiled* script in the Worker only. The compilers, the
 * shared installer templates, and every existing `/i/:id` link are untouched,
 * so statuslines installed before accounts existed keep behaving exactly as
 * they do today — they contain no updater and never phone home.
 *
 * Contract of the injected code:
 *  - runs at most once per 6 hours (stamp file next to the script)
 *  - bash: entirely in a detached background subshell — never delays a render,
 *    never touches stdin/stdout, never fails the statusline
 *  - fetches only the fixed URL baked in at install time
 *  - only replaces the script if the response looks like a statusline (has the
 *    marker) and differs; replacement is write-temp + atomic rename
 *  - any failure (offline, 4xx/5xx, lapsed subscription) is a silent no-op
 *  - opt out with STATUSLINE_NO_UPDATE=1
 */

export const AUTO_UPDATE_MARKER = "statusline.sh auto-update";
export const UPDATE_INTERVAL_MINUTES = 360;

/** Ids are nanoid (A-Za-z0-9_-) and origins are ours; refuse anything else. */
function assertSafeUrl(url: string): void {
  if (!/^https?:\/\/[A-Za-z0-9.:-]+\/u\/[A-Za-z0-9_-]+\.(sh|ps1)$/.test(url)) {
    throw new Error("unsafe update url");
  }
}

function bashPrelude(url: string): string {
  return `# >>> ${AUTO_UPDATE_MARKER} (set STATUSLINE_NO_UPDATE=1 to disable) >>>
if [ -z "\${STATUSLINE_NO_UPDATE:-}" ]; then
  __sl_self="\${BASH_SOURCE[0]:-$0}"
  __sl_stamp="$__sl_self.update-check"
  if [ -z "$(find "$__sl_stamp" -mmin -${UPDATE_INTERVAL_MINUTES} 2>/dev/null)" ]; then
    (
      touch "$__sl_stamp" 2>/dev/null || exit 0
      command -v curl >/dev/null 2>&1 || exit 0
      __sl_tmp="$(mktemp "$__sl_self.XXXXXX" 2>/dev/null)" || exit 0
      if curl -fsS --max-time 8 -o "$__sl_tmp" '${url}' 2>/dev/null \\
        && head -n 1 "$__sl_tmp" | grep -q '^#!' \\
        && grep -q '${AUTO_UPDATE_MARKER}' "$__sl_tmp" \\
        && ! cmp -s "$__sl_tmp" "$__sl_self"; then
        chmod +x "$__sl_tmp" && mv -f "$__sl_tmp" "$__sl_self"
      else
        rm -f "$__sl_tmp"
      fi
    ) </dev/null >/dev/null 2>&1 &
  fi
fi
# <<< ${AUTO_UPDATE_MARKER} <<<
`;
}

function psPrelude(url: string): string {
  // ponytail: PowerShell has no cheap fire-and-forget, so this is synchronous
  // (4s timeout, once per 6h). Move to Start-Job/Start-Process if it's felt.
  return `# >>> ${AUTO_UPDATE_MARKER} (set $env:STATUSLINE_NO_UPDATE=1 to disable) >>>
try {
  if (-not $env:STATUSLINE_NO_UPDATE -and $PSCommandPath) {
    $slStamp = "$PSCommandPath.update-check"
    $slDue = -not (Test-Path -LiteralPath $slStamp)
    if (-not $slDue) { $slDue = ((Get-Date) - (Get-Item -LiteralPath $slStamp).LastWriteTime).TotalMinutes -gt ${UPDATE_INTERVAL_MINUTES} }
    if ($slDue) {
      Set-Content -LiteralPath $slStamp -Value '' -ErrorAction Stop
      $slNew = (Invoke-WebRequest -Uri '${url}' -UseBasicParsing -TimeoutSec 4 -ErrorAction Stop).Content
      if ($slNew -is [byte[]]) { $slNew = [Text.Encoding]::UTF8.GetString($slNew) }
      if ($slNew -like '*${AUTO_UPDATE_MARKER}*' -and $slNew -ne [IO.File]::ReadAllText($PSCommandPath)) {
        $slTmp = "$PSCommandPath.new"
        [IO.File]::WriteAllText($slTmp, $slNew, (New-Object System.Text.UTF8Encoding $false))
        Move-Item -LiteralPath $slTmp -Destination $PSCommandPath -Force -ErrorAction Stop
      }
    }
  }
} catch { }
# <<< ${AUTO_UPDATE_MARKER} <<<
`;
}

/**
 * Insert the updater right after the first line of a compiled script (the
 * bash shebang / the PowerShell header comment), so it runs before the script
 * body but leaves the compiler output otherwise byte-identical.
 */
export function withAutoUpdate(
  compiled: string,
  ext: "sh" | "ps1",
  updateUrl: string,
): string {
  assertSafeUrl(updateUrl);
  const prelude = ext === "sh" ? bashPrelude(updateUrl) : psPrelude(updateUrl);
  const nl = compiled.indexOf("\n");
  if (nl === -1) return compiled + "\n" + prelude;
  return compiled.slice(0, nl + 1) + prelude + compiled.slice(nl + 1);
}
