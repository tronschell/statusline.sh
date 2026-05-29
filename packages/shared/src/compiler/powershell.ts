import { styleToSgr } from "../ansi";
import type { AnsiStyle, Design } from "../types";
import { compileToOps, type RenderOp } from "./ir";

const PS_HEADER = `# Statusline script (PowerShell)
$ErrorActionPreference = 'SilentlyContinue'
$__input = [Console]::In.ReadToEnd()
try { $j = $__input | ConvertFrom-Json } catch { $j = $null }

# Terminal width for flex-spacer math. STATUSLINE_COLS env var overrides;
# else WindowWidth (throws on redirected stdout / CI), else 80.
$STATUSLINE_COLS = if ($env:STATUSLINE_COLS) {
  try { [int]$env:STATUSLINE_COLS } catch { 80 }
} else {
  try { [Console]::WindowWidth } catch { 80 }
}

# Visible-character length: strip CSI SGR sequences then .Length.
# Wide glyphs (emoji, CJK) count as 1 column — same simplification as the
# interpret backend uses.
function __visibleLen([string]$s) {
  if ([string]::IsNullOrEmpty($s)) { return 0 }
  $stripped = $s -replace "$([char]27)\\[[0-9;]*m", ''
  return $stripped.Length
}

function __get($obj, [string]$path) {
  if ($null -eq $obj -or [string]::IsNullOrEmpty($path)) { return '' }
  $cur = $obj
  foreach ($p in $path.Split('.')) {
    if ($null -eq $cur) { return '' }
    $prop = $cur.PSObject.Properties[$p]
    if ($null -eq $prop) { return '' }
    $cur = $prop.Value
  }
  if ($null -eq $cur) { return '' }
  return $cur
}

function __field([string]$path) { [string](__get $j $path) }
function __sgr([string]$codes) {
  if ([string]::IsNullOrEmpty($codes)) { return '' }
  return "$([char]27)[\${codes}m"
}
function __reset() { return "$([char]27)[0m" }

# Output sink: when $__SINK is non-null, __emit/__write append to it
# (used for flex-spacer chunk capture). Otherwise bytes go straight to the
# raw standard-output stream as UTF-8.
#
# We deliberately bypass [Console]::Out.Write: that re-encodes through
# [Console]::OutputEncoding, which on Windows PowerShell 5.1 defaults to the
# console's OEM code page (e.g. IBM437 / CP1252). Those code pages can't
# represent the block-bar glyphs, box drawing, or emoji a statusline may emit,
# so they get mangled to '?' regardless of the terminal's own encoding. Writing
# UTF-8 bytes straight to the handle is independent of the console code page AND
# of host color handling. The compiled body below keeps all literals ASCII
# (non-ASCII is emitted as [char] escapes) so the in-memory strings are correct
# even when PowerShell 5.1 parses this BOM-less file as its OEM code page.
$__SINK = $null
$__stdout = [Console]::OpenStandardOutput()
function __write([string]$text) {
  if ($null -eq $script:__SINK) {
    $__b = [System.Text.Encoding]::UTF8.GetBytes($text)
    $script:__stdout.Write($__b, 0, $__b.Length)
  } else { $script:__SINK.Append($text) | Out-Null }
}
function __emit([string]$codes, [string]$text) {
  $out = ''
  if ($codes) { $out += __sgr $codes }
  $out += $text
  if ($codes) { $out += __reset }
  __write $out
}
function __basename([string]$s) {
  if ([string]::IsNullOrEmpty($s)) { return '' }
  $idx = [Math]::Max($s.LastIndexOf('/'), $s.LastIndexOf('\\'))
  if ($idx -ge 0) { return $s.Substring($idx + 1) } else { return $s }
}
function __compact([string]$s) {
  if ([string]::IsNullOrEmpty($s)) { return '' }
  $sep = '/'
  if (($s.IndexOf('\\') -ge 0) -and ($s.IndexOf('/') -lt 0)) { $sep = '\\' }
  $leading = ''
  $body = $s
  if ($s.StartsWith($sep)) { $leading = $sep; $body = $s.Substring(1) }
  if ($body -eq '') { return $leading }
  $parts = $body -split [regex]::Escape($sep)
  if ($parts.Length -le 1) { return $s }
  $last = $parts[$parts.Length - 1]
  $collapsed = New-Object System.Collections.Generic.List[string]
  for ($i = 0; $i -lt $parts.Length - 1; $i++) {
    $seg = $parts[$i]
    if ([string]::IsNullOrEmpty($seg)) { $collapsed.Add('') }
    else { $collapsed.Add($seg.Substring(0, 1)) }
  }
  $collapsed.Add($last)
  return $leading + ($collapsed -join $sep)
}
function __tildify([string]$s) {
  if ([string]::IsNullOrEmpty($s)) { return '' }
  $h = $env:USERPROFILE
  if (-not $h) { $h = $env:HOME }
  if ($h -and $s.StartsWith($h)) { return '~' + $s.Substring($h.Length) }
  return $s
}
function __truncate([string]$s, [int]$n) {
  if ($n -le 0 -or $s.Length -le $n) { return $s }
  if ($n -le 1) { return $s.Substring(0, $n) }
  return $s.Substring(0, $n - 1) + [char]0x2026
}
function __costFmt([string]$v, [int]$prec) {
  $n = 0.0
  [double]::TryParse($v, [ref]$n) | Out-Null
  return '$' + $n.ToString('F' + $prec)
}
function __durHms([string]$v) {
  $ms = 0; [int64]::TryParse($v, [ref]$ms) | Out-Null
  $total = [int]([math]::Floor($ms / 1000))
  $h = [math]::Floor($total / 3600)
  $m = [math]::Floor(($total % 3600) / 60)
  $s = $total % 60
  if ($h -gt 0) { return ('{0}:{1:D2}:{2:D2}' -f $h, $m, $s) }
  return ('{0}:{1:D2}' -f $m, $s)
}
function __durHuman([string]$v) {
  $ms = 0; [int64]::TryParse($v, [ref]$ms) | Out-Null
  $total = [int]([math]::Floor($ms / 1000))
  if ($total -lt 60) { return ('{0}s' -f $total) }
  $m = [math]::Floor($total / 60); $s = $total % 60
  if ($m -lt 60) { if ($s -gt 0) { return ('{0}m {1}s' -f $m, $s) } else { return ('{0}m' -f $m) } }
  $h = [math]::Floor($m / 60); $mm = $m % 60
  if ($mm -gt 0) { return ('{0}h {1}m' -f $h, $mm) } else { return ('{0}h' -f $h) }
}
function __bar([string]$v, [int]$width, [string]$filled, [string]$empty) {
  $p = 0.0; [double]::TryParse($v, [ref]$p) | Out-Null
  if ($p -lt 0) { $p = 0 } elseif ($p -gt 100) { $p = 100 }
  $n = [int][math]::Round(($p * $width) / 100)
  $e = $width - $n
  return ($filled * $n) + ($empty * $e)
}
function __normInt([string]$v) {
  if ([string]::IsNullOrEmpty($v)) { return 0 }
  $idx = $v.IndexOf('.')
  if ($idx -ge 0) { $v = $v.Substring(0, $idx) }
  $n = 0
  if (-not [int64]::TryParse($v, [ref]$n)) { return 0 }
  if ($n -lt 0) { return 0 }
  return $n
}
function __fmtTokenCompact([string]$v) {
  $n = __normInt $v
  if ($n -lt 1000) { return [string]$n }
  if ($n -lt 1000000) {
    $whole = [math]::Floor($n / 1000)
    $rem = $n - ($whole * 1000)
    $dec = [math]::Floor($rem / 100)
    if ($dec -eq 0) { return ('{0}k' -f $whole) }
    return ('{0}.{1}k' -f $whole, $dec)
  }
  $whole = [math]::Floor($n / 1000000)
  $rem = $n - ($whole * 1000000)
  $dec = [math]::Floor($rem / 100000)
  if ($dec -eq 0) { return ('{0}M' -f $whole) }
  return ('{0}.{1}M' -f $whole, $dec)
}
function __fmtTokenFull([string]$v) {
  $n = __normInt $v
  return $n.ToString('N0', [System.Globalization.CultureInfo]::InvariantCulture)
}
function __tokensUsed() { __field 'context_window.total_input_tokens' }
function __tokensTotal() { __field 'context_window.context_window_size' }
function __tokensRemaining() {
  $u = __normInt (__tokensUsed)
  $t = __normInt (__tokensTotal)
  $r = $t - $u
  if ($r -lt 0) { $r = 0 }
  return [string]$r
}
function __tokensPctInt() {
  $p = __field 'context_window.used_percentage'
  return [string](__normInt $p)
}
function __gitBranch() {
  $cwd = __field 'workspace.current_dir'
  if (-not $cwd) { $cwd = __field 'cwd' }
  if ($cwd -and (Get-Command git -ErrorAction SilentlyContinue)) {
    $b = & git -C "$cwd" rev-parse --abbrev-ref HEAD 2>$null
    if ($b) { return $b.Trim() }
  }
  return __field 'workspace.git_worktree'
}
function __gitDirty() {
  $cwd = __field 'workspace.current_dir'
  if (-not $cwd) { $cwd = __field 'cwd' }
  if ($cwd -and (Get-Command git -ErrorAction SilentlyContinue)) {
    $s = & git -C "$cwd" status --porcelain 2>$null
    if ($s) { return '1' }
  }
  return '0'
}
function __tick() {
  if ($env:STATUSLINE_CLOCK_OVERRIDE) {
    $o = 0
    if ([int64]::TryParse($env:STATUSLINE_CLOCK_OVERRIDE, [ref]$o)) { return $o }
  }
  return [DateTimeOffset]::Now.ToUnixTimeSeconds()
}
function __relTime([string]$v) {
  if ([string]::IsNullOrEmpty($v)) { return '' }
  $target = 0.0
  if (-not [double]::TryParse($v, [ref]$target)) { return '' }
  $now = __tick
  $diff = [int]([math]::Floor($target - $now))
  if ($diff -le 0) { return '' }
  if ($diff -lt 60) { return ('T-{0}s' -f $diff) }
  if ($diff -lt 3600) {
    $m = [math]::Floor($diff / 60); $s = $diff % 60
    return ('T-{0}m{1:D2}s' -f $m, $s)
  }
  $h = [math]::Floor($diff / 3600); $rem = [math]::Floor(($diff % 3600) / 60)
  return ('T-{0}h{1:D2}m' -f $h, $rem)
}
`;

function psEscapeSingle(s: string): string {
  return s.replace(/'/g, "''");
}

/**
 * Render an arbitrary string as an ASCII-only PowerShell expression that
 * evaluates to that exact string at runtime.
 *
 * Printable-ASCII runs become single-quoted literals; every other code point
 * is emitted as a `[char]0xHHHH` escape (or `[char]::ConvertFromUtf32` for
 * astral chars like emoji). Keeping the compiled script pure ASCII means the
 * parser can't corrupt user glyphs no matter what encoding the host uses to
 * read the file — the critical fix for Windows PowerShell 5.1, which parses a
 * BOM-less .ps1 as the OEM code page and would otherwise split each multi-byte
 * UTF-8 glyph into several garbage chars (inflating bar widths and breaking
 * flex-spacer math). The result is always safe to drop into argument position
 * (escaped forms are parenthesised).
 */
function psLit(s: string): string {
  if (s === "") return "''";
  const parts: string[] = [];
  let ascii = "";
  let hasEscape = false;
  const flushAscii = () => {
    if (ascii !== "") {
      parts.push(`'${ascii.replace(/'/g, "''")}'`);
      ascii = "";
    }
  };
  // Iterate by code point so surrogate pairs (emoji) are handled atomically.
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (cp >= 0x20 && cp <= 0x7e) {
      ascii += ch;
    } else {
      flushAscii();
      hasEscape = true;
      const hex = cp.toString(16).toUpperCase();
      parts.push(cp <= 0xffff ? `[char]0x${hex}` : `[char]::ConvertFromUtf32(0x${hex})`);
    }
  }
  flushAscii();
  if (!hasEscape) return parts[0]!;
  return `(${parts.join(" + ")})`;
}

function sgrCodes(style: AnsiStyle): string {
  const sgr = styleToSgr(style);
  if (!sgr) return "";
  const m = sgr.match(/\[([0-9;]*)m$/);
  return m ? m[1]! : "";
}

function emitOp(op: RenderOp, depth = 0): string {
  const pad = "  ".repeat(depth);
  const style = "style" in op ? op.style : undefined;
  const styleCodes = style ? sgrCodes(style) : "";

  switch (op.op) {
    case "literal":
      return `${pad}__emit '${styleCodes}' ${psLit(op.text)}\n`;

    case "field": {
      const t = op.transform ?? "raw";
      let v = `(__field '${psEscapeSingle(op.path)}')`;
      if (t === "basename") v = `(__basename ${v})`;
      else if (t === "tilde") v = `(__tildify ${v})`;
      else if (t === "compact") v = `(__compact ${v})`;
      if (op.truncate) v = `(__truncate ${v} ${op.truncate})`;
      return `${pad}__emit '${styleCodes}' ${v}\n`;
    }

    case "cond": {
      let test = "";
      const expectedDirty =
        op.expr.op !== "exists" ? String(op.expr.value) : "1";
      if (op.expr.field === "__computed.git_dirty") {
        test = `((__gitDirty) -eq ${psLit(expectedDirty)})`;
      } else if (op.expr.op === "exists") {
        test = `((__field '${psEscapeSingle(op.expr.field)}') -ne '')`;
      } else if (op.expr.op === "eq") {
        test = `((__field '${psEscapeSingle(op.expr.field)}') -eq ${psLit(String(op.expr.value))})`;
      } else if (op.expr.op === "gt") {
        test = `([double](__field '${psEscapeSingle(op.expr.field)}') -gt ${Number(op.expr.value)})`;
      } else if (op.expr.op === "lt") {
        test = `([double](__field '${psEscapeSingle(op.expr.field)}') -lt ${Number(op.expr.value)})`;
      }
      let out = `${pad}if (${test}) {\n`;
      for (const c of op.then) out += emitOp(c, depth + 1);
      out += `${pad}}`;
      if (op.else && op.else.length > 0) {
        out += ` else {\n`;
        for (const c of op.else) out += emitOp(c, depth + 1);
        out += `${pad}}`;
      }
      out += `\n`;
      return out;
    }

    case "progressBar": {
      const f = psLit(op.filled);
      const e = psLit(op.empty);
      return `${pad}__emit '${styleCodes}' (__bar (__field '${psEscapeSingle(op.pctPath)}') ${op.width} ${f} ${e})\n`;
    }

    case "split": {
      const src = op.sourceOp;
      let prelude = "";
      if (src.op === "field") {
        const t = src.transform ?? "raw";
        let v = `(__field '${psEscapeSingle(src.path)}')`;
        if (t === "basename") v = `(__basename ${v})`;
        else if (t === "tilde") v = `(__tildify ${v})`;
        else if (t === "compact") v = `(__compact ${v})`;
        prelude = `${pad}$__v = ${v}\n`;
      } else if (src.op === "literal") {
        prelude = `${pad}$__v = ${psLit(src.text)}\n`;
      } else if (src.op === "compute" && src.expr === "git_branch") {
        prelude = `${pad}$__v = __gitBranch\n`;
      } else {
        prelude = `${pad}$__v = ''\n`;
      }
      let body = prelude;
      body += `${pad}$__delim = ${psLit(op.delimiter)}\n`;
      body += `${pad}$__join = ${psLit(op.joinWith ?? op.delimiter)}\n`;
      body += `${pad}$__parts = [string]$__v -split [regex]::Escape($__delim)\n`;
      body += `${pad}for ($__i = 0; $__i -lt $__parts.Length; $__i++) {\n`;
      body += `${pad}  if ($__i -gt 0) { __write $__join }\n`;
      const lastIdx = op.segments.length - 1;
      body += `${pad}  switch ($__i) {\n`;
      for (let i = 0; i < op.segments.length; i++) {
        const seg = op.segments[i]!;
        const codes = sgrCodes(seg.style);
        const pre = psLit(seg.prefix ?? "");
        const suf = psLit(seg.suffix ?? "");
        if (i === lastIdx) {
          body += `${pad}    default { __emit '${codes}' (${pre} + $__parts[$__i] + ${suf}) }\n`;
        } else {
          body += `${pad}    ${i} { __emit '${codes}' (${pre} + $__parts[$__i] + ${suf}) }\n`;
        }
      }
      body += `${pad}  }\n`;
      body += `${pad}}\n`;
      return body;
    }

    case "compute": {
      const arg = op.argPath ? psEscapeSingle(op.argPath) : "";
      switch (op.expr) {
        case "duration_human":
          return `${pad}__emit '${styleCodes}' (__durHuman (__field '${arg}'))\n`;
        case "duration_hms":
          return `${pad}__emit '${styleCodes}' (__durHms (__field '${arg}'))\n`;
        case "cost_fmt":
          return `${pad}__emit '${styleCodes}' (__costFmt (__field '${arg}') ${op.precision ?? 2})\n`;
        case "git_branch":
          return `${pad}__emit '${styleCodes}' (__gitBranch)\n`;
        case "git_dirty":
          return `${pad}__emit '${styleCodes}' (__gitDirty)\n`;
        case "relative_time":
          return `${pad}__emit '${styleCodes}' (__relTime (__field '${arg}'))\n`;
      }
    }

    case "tokenDisplay": {
      const fnFmt = op.compact ? "__fmtTokenCompact" : "__fmtTokenFull";
      switch (op.variant) {
        case "used":
          return `${pad}__emit '${styleCodes}' (${fnFmt} (__tokensUsed))\n`;
        case "remaining":
          return `${pad}__emit '${styleCodes}' (${fnFmt} (__tokensRemaining))\n`;
        case "ratio":
          return `${pad}__emit '${styleCodes}' ((${fnFmt} (__tokensUsed)) + '/' + (${fnFmt} (__tokensTotal)))\n`;
        case "ratioPct":
          return `${pad}__emit '${styleCodes}' ((${fnFmt} (__tokensUsed)) + '/' + (${fnFmt} (__tokensTotal)) + ' (' + (__tokensPctInt) + '%)')\n`;
      }
      return "";
    }
    case "rotator": {
      const n = op.items.length;
      if (n === 0) return "";
      const interval = Math.max(1, Math.floor(op.intervalSeconds));
      const itemsLiteral =
        "@(" + op.items.map((s) => psLit(s)).join(", ") + ")";
      let body = `${pad}$__items = ${itemsLiteral}\n`;
      if (op.pickMode === "random") {
        body += `${pad}$__idx = Get-Random -Maximum ${n}\n`;
      } else {
        body +=
          `${pad}$__now = __tick\n` +
          `${pad}$__idx = [int]([math]::Floor($__now / ${interval}) % ${n})\n`;
      }
      body += `${pad}__emit '${styleCodes}' $__items[$__idx]\n`;
      return body;
    }
    case "lineBreak":
      // Reset SGR state, then emit a real LF byte (PowerShell backtick-n).
      // Writes via __write so the chunk-capture sink (used by flex spacers)
      // also catches it; in normal flow __write falls through to
      // [Console]::Out.Write so neither the reset nor the newline are
      // mangled by host color handling.
      return `${pad}__write ((__reset) + "\`n")\n`;
    case "fixedSpacer": {
      if (op.width <= 0) return "";
      return `${pad}__write (${psLit(op.char)} * ${op.width})\n`;
    }
    case "flexSpacer":
      // Top-level flex spacers are handled by the deck partitioner in
      // compileToPS. If we reach this branch we are nested inside a
      // cond, where flex resolution is undefined — emit nothing.
      return "";
  }
}

function emitDeckPS(deckOps: RenderOp[]): string {
  const flexCount = deckOps.filter((op) => op.op === "flexSpacer").length;
  if (flexCount === 0) {
    return deckOps.map((op) => emitOp(op, 0)).join("");
  }

  // Partition into chunks at each flexSpacer.
  const chunks: RenderOp[][] = [[]];
  const spacerChars: string[] = [];
  for (const op of deckOps) {
    if (op.op === "flexSpacer") {
      spacerChars.push(op.char);
      chunks.push([]);
    } else {
      chunks[chunks.length - 1]!.push(op);
    }
  }

  // Drop trailing empty chunk + spacer (spacer-at-EOL no-op).
  let activeSpacerCount = spacerChars.length;
  let lastIdx = chunks.length - 1;
  if (activeSpacerCount > 0 && chunks[lastIdx]!.length === 0) {
    activeSpacerCount--;
    lastIdx--;
  }

  let body = "";
  // Capture each chunk into a StringBuilder by swapping the __SINK.
  for (let i = 0; i <= lastIdx; i++) {
    body += `$__chunkSb_${i} = New-Object System.Text.StringBuilder\n`;
    body += `$__SINK = $__chunkSb_${i}\n`;
    body += chunks[i]!.map((op) => emitOp(op, 0)).join("");
    body += `$__SINK = $null\n`;
    body += `$__chunk_${i} = $__chunkSb_${i}.ToString()\n`;
  }

  body += `$__totalLen = 0\n`;
  for (let i = 0; i <= lastIdx; i++) {
    body += `$__len_${i} = __visibleLen $__chunk_${i}\n`;
    body += `$__totalLen += $__len_${i}\n`;
  }
  body += `$__remaining = [Math]::Max(0, $STATUSLINE_COLS - $__totalLen)\n`;
  if (activeSpacerCount > 0) {
    body += `$__padBase = [int][Math]::Floor($__remaining / ${activeSpacerCount})\n`;
    body += `$__padExtra = $__remaining - $__padBase * ${activeSpacerCount}\n`;
  } else {
    body += `$__padBase = 0\n$__padExtra = 0\n`;
  }

  let spacerSeen = 0;
  for (let i = 0; i <= lastIdx; i++) {
    body += `__write $__chunk_${i}\n`;
    if (i < lastIdx) {
      const ch = psLit(spacerChars[i] ?? " ");
      body += `if (${spacerSeen} -lt $__padExtra) {\n`;
      body += `  __write (${ch} * ($__padBase + 1))\n`;
      body += `} else {\n`;
      body += `  if ($__padBase -gt 0) { __write (${ch} * $__padBase) }\n`;
      body += `}\n`;
      spacerSeen++;
    }
  }
  return body;
}

export function compileToPS(design: Design): string {
  const ops = compileToOps(design);

  // Partition by lineBreak; each deck compiles independently.
  const decks: RenderOp[][] = [[]];
  for (const op of ops) {
    if (op.op === "lineBreak") {
      decks.push([]);
    } else {
      decks[decks.length - 1]!.push(op);
    }
  }

  let body = "";
  for (let d = 0; d < decks.length; d++) {
    body += emitDeckPS(decks[d]!);
    if (d < decks.length - 1) {
      body += `__write ((__reset) + "\`n")\n`;
    }
  }
  // Flush the raw stdout stream before exit — when stdout is redirected (as it
  // is under Claude Code) the underlying FileStream is buffered, and an abrupt
  // `exit` could otherwise drop the tail of the line.
  return PS_HEADER + "\n" + body + "\n$__stdout.Flush()\nexit 0\n";
}
