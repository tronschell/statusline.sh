import { styleToSgr } from "../shared/ansi";
import type { AnsiStyle, Design } from "../shared/types";
import { compileToOps, type RenderOp } from "./ir";

const PS_HEADER = `# Statusline script (PowerShell)
$ErrorActionPreference = 'SilentlyContinue'
$__input = [Console]::In.ReadToEnd()
try { $j = $__input | ConvertFrom-Json } catch { $j = $null }

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
function __emit([string]$codes, [string]$text) {
  $out = ''
  if ($codes) { $out += __sgr $codes }
  $out += $text
  if ($codes) { $out += __reset }
  [Console]::Out.Write($out)
}
function __basename([string]$s) {
  if ([string]::IsNullOrEmpty($s)) { return '' }
  $idx = [Math]::Max($s.LastIndexOf('/'), $s.LastIndexOf('\\'))
  if ($idx -ge 0) { return $s.Substring($idx + 1) } else { return $s }
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
`;

function psEscapeSingle(s: string): string {
  return s.replace(/'/g, "''");
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
      return `${pad}__emit '${styleCodes}' '${psEscapeSingle(op.text)}'\n`;

    case "field": {
      const t = op.transform ?? "raw";
      let v = `(__field '${psEscapeSingle(op.path)}')`;
      if (t === "basename") v = `(__basename ${v})`;
      else if (t === "tilde") v = `(__tildify ${v})`;
      if (op.truncate) v = `(__truncate ${v} ${op.truncate})`;
      return `${pad}__emit '${styleCodes}' ${v}\n`;
    }

    case "cond": {
      let test = "";
      const expectedDirty =
        op.expr.op !== "exists" ? String(op.expr.value) : "1";
      if (op.expr.field === "__computed.git_dirty") {
        test = `((__gitDirty) -eq '${psEscapeSingle(expectedDirty)}')`;
      } else if (op.expr.op === "exists") {
        test = `((__field '${psEscapeSingle(op.expr.field)}') -ne '')`;
      } else if (op.expr.op === "eq") {
        test = `((__field '${psEscapeSingle(op.expr.field)}') -eq '${psEscapeSingle(String(op.expr.value))}')`;
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
      const f = psEscapeSingle(op.filled);
      const e = psEscapeSingle(op.empty);
      return `${pad}__emit '${styleCodes}' (__bar (__field '${psEscapeSingle(op.pctPath)}') ${op.width} '${f}' '${e}')\n`;
    }

    case "split": {
      const src = op.sourceOp;
      let prelude = "";
      if (src.op === "field") {
        const t = src.transform ?? "raw";
        let v = `(__field '${psEscapeSingle(src.path)}')`;
        if (t === "basename") v = `(__basename ${v})`;
        else if (t === "tilde") v = `(__tildify ${v})`;
        prelude = `${pad}$__v = ${v}\n`;
      } else if (src.op === "literal") {
        prelude = `${pad}$__v = '${psEscapeSingle(src.text)}'\n`;
      } else if (src.op === "compute" && src.expr === "git_branch") {
        prelude = `${pad}$__v = __gitBranch\n`;
      } else {
        prelude = `${pad}$__v = ''\n`;
      }
      let body = prelude;
      body += `${pad}$__delim = '${psEscapeSingle(op.delimiter)}'\n`;
      body += `${pad}$__join = '${psEscapeSingle(op.joinWith ?? op.delimiter)}'\n`;
      body += `${pad}$__parts = [string]$__v -split [regex]::Escape($__delim)\n`;
      body += `${pad}for ($__i = 0; $__i -lt $__parts.Length; $__i++) {\n`;
      body += `${pad}  if ($__i -gt 0) { [Console]::Out.Write($__join) }\n`;
      const lastIdx = op.segments.length - 1;
      body += `${pad}  switch ($__i) {\n`;
      for (let i = 0; i < op.segments.length; i++) {
        const seg = op.segments[i]!;
        const codes = sgrCodes(seg.style);
        const pre = psEscapeSingle(seg.prefix ?? "");
        const suf = psEscapeSingle(seg.suffix ?? "");
        if (i === lastIdx) {
          body += `${pad}    default { __emit '${codes}' ('${pre}' + $__parts[$__i] + '${suf}') }\n`;
        } else {
          body += `${pad}    ${i} { __emit '${codes}' ('${pre}' + $__parts[$__i] + '${suf}') }\n`;
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
      }
    }

    case "rotator": {
      const n = op.items.length;
      if (n === 0) return "";
      const interval = Math.max(1, Math.floor(op.intervalSeconds));
      const itemsLiteral =
        "@(" + op.items.map((s) => `'${psEscapeSingle(s)}'`).join(", ") + ")";
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
  }
}

export function compileToPS(design: Design): string {
  const ops = compileToOps(design);
  const body = ops.map((op) => emitOp(op, 0)).join("");
  return PS_HEADER + "\n" + body + "\nexit 0\n";
}
