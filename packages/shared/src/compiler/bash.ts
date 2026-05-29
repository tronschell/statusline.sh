import { styleToSgr, SGR_RESET } from "../ansi";
import type { AnsiStyle, Design } from "../types";
import { compileToOps, type RenderOp } from "./ir";

const BASH_HEADER = `#!/usr/bin/env bash
set -u
INPUT="$(cat)"
export INPUT_JSON="$INPUT"

# Terminal width for flex-spacer math. Honors STATUSLINE_COLS env override
# (used by parity tests); otherwise tries tput, finally falls back to 80.
STATUSLINE_COLS=\${STATUSLINE_COLS:-$(tput cols 2>/dev/null || echo 80)}

# Visible-character length: strip CSI SGR sequences then count chars.
# Wide glyphs (emoji, CJK) count as 1 column — same simplification as the
# interpret backend uses.
__visible_len() {
  printf '%s' "$1" | sed 's/\\x1b\\[[0-9;]*m//g' | awk '{ printf "%s", length($0) }'
}

__repeat_char() {
  local ch="$1" n="$2" out=""
  if [ "$n" -le 0 ]; then printf ''; return; fi
  local i=0
  while [ "$i" -lt "$n" ]; do out+="$ch"; i=$((i+1)); done
  printf '%s' "$out"
}

__sgr() { printf '\\033[%sm' "$1"; }
__reset() { printf '\\033[0m'; }

if command -v jq >/dev/null 2>&1; then
  __field() {
    printf '%s' "$INPUT_JSON" | jq -r --arg p "$1" '
      ($p | split(".")) as $parts
      | reduce $parts[] as $k (.; if type == "object" and has($k) then .[$k] else null end)
      | if . == null then "" else (if type == "string" then . else tostring end) end
    ' 2>/dev/null
  }
else
  if command -v python3 >/dev/null 2>&1 && python3 -c 'import sys' >/dev/null 2>&1; then
    __PY=python3
  elif command -v python >/dev/null 2>&1; then
    __PY=python
  else
    __PY=""
  fi
  __field() {
    if [ -z "$__PY" ]; then printf ''; return; fi
    PATH_ARG="$1" "$__PY" - <<'PYEOF' 2>/dev/null
import json, os
d = json.loads(os.environ.get('INPUT_JSON','{}') or '{}')
p = os.environ.get('PATH_ARG','')
cur = d
for part in p.split('.'):
    if isinstance(cur, dict) and part in cur:
        cur = cur[part]
    else:
        cur = None
        break
if cur is None:
    print('', end='')
elif isinstance(cur, bool):
    print('true' if cur else 'false', end='')
else:
    print(cur, end='')
PYEOF
  }
fi

__basename() { local s="$1"; printf '%s' "\${s##*/}"; }
__compact() {
  local s="$1"
  if [ -z "$s" ]; then printf ''; return; fi
  # Use awk so we don't depend on bash arrays. Split on '/', take the first
  # char of every segment except the last; preserve a leading slash by
  # emitting an empty initial element when the path starts with '/'.
  printf '%s' "$s" | awk 'BEGIN{FS="/"} {
    out=""
    for (i=1; i<=NF; i++) {
      if (i==NF) { piece = $i }
      else if ($i == "") { piece = "" }
      else { piece = substr($i, 1, 1) }
      if (i==1) { out = piece } else { out = out "/" piece }
    }
    printf "%s", out
  }'
}
__tildify() {
  local s="$1"
  local home="\${HOME%/}"
  if [ -n "$home" ] && [[ "$s" == "$home"* ]]; then
    printf '~%s' "\${s#$home}"
    return
  fi
  if [[ "$s" =~ ^/(Users|home)/[^/]+(.*)$ ]]; then
    printf '~%s' "\${BASH_REMATCH[2]}"
    return
  fi
  printf '%s' "$s"
}
__truncate() {
  local s="$1" n="$2"
  if [ "$n" -le 0 ] || [ "\${#s}" -le "$n" ]; then printf '%s' "$s"; return; fi
  if [ "$n" -le 1 ]; then printf '%s' "\${s:0:$n}"; return; fi
  printf '%s…' "\${s:0:$((n-1))}"
}
__cost_fmt() { printf '$%.*f' "$2" "$1"; }
__dur_hms() {
  local ms="$1" total h m s
  total=$((ms/1000)); h=$((total/3600)); m=$(((total%3600)/60)); s=$((total%60))
  if [ "$h" -gt 0 ]; then printf '%d:%02d:%02d' "$h" "$m" "$s"
  else printf '%d:%02d' "$m" "$s"; fi
}
__dur_human() {
  local ms="$1" total m s h mm
  total=$((ms/1000))
  if [ "$total" -lt 60 ]; then printf '%ds' "$total"; return; fi
  m=$((total/60)); s=$((total%60))
  if [ "$m" -lt 60 ]; then
    if [ "$s" -gt 0 ]; then printf '%dm %ds' "$m" "$s"; else printf '%dm' "$m"; fi
    return
  fi
  h=$((m/60)); mm=$((m%60))
  if [ "$mm" -gt 0 ]; then printf '%dh %dm' "$h" "$mm"; else printf '%dh' "$h"; fi
}
__bar() {
  local pct="$1" width="$2" filled="$3" empty="$4"
  local p i n=0 e=0
  p=\${pct%.*}
  [ -z "$p" ] && p=0
  if [ "$p" -lt 0 ]; then p=0; fi
  if [ "$p" -gt 100 ]; then p=100; fi
  n=$(( (p * width + 50) / 100 ))
  e=$((width - n))
  local out=""
  for ((i=0; i<n; i++)); do out+="$filled"; done
  for ((i=0; i<e; i++)); do out+="$empty"; done
  printf '%s' "$out"
}
__git_branch() {
  local cwd dir
  cwd="$(__field workspace.current_dir)"
  if [ -z "$cwd" ]; then cwd="$(__field cwd)"; fi
  if [ -n "$cwd" ] && command -v git >/dev/null 2>&1; then
    git -C "$cwd" rev-parse --abbrev-ref HEAD 2>/dev/null
  else
    __field workspace.git_worktree
  fi
}
__git_dirty() {
  local cwd
  cwd="$(__field workspace.current_dir)"
  if [ -z "$cwd" ]; then cwd="$(__field cwd)"; fi
  if [ -n "$cwd" ] && command -v git >/dev/null 2>&1; then
    if [ -n "$(git -C "$cwd" status --porcelain 2>/dev/null)" ]; then printf '1'; else printf '0'; fi
  else
    printf '0'
  fi
}
__emit() {
  local style="$1" text="$2"
  if [ -n "$style" ]; then __sgr "$style"; fi
  printf '%s' "$text"
  if [ -n "$style" ]; then __reset; fi
}
__norm_int() {
  # Coerce a possibly-decimal/empty/garbage field value to a non-negative
  # integer string. Used by token-display helpers.
  local v="$1"
  v="\${v%%.*}"
  case "$v" in
    ''|*[!0-9]*) printf '0' ;;
    *) printf '%s' "$v" ;;
  esac
}
__fmt_token_compact() {
  local n
  n="$(__norm_int "$1")"
  if [ "$n" -lt 1000 ]; then printf '%s' "$n"; return; fi
  if [ "$n" -lt 1000000 ]; then
    local whole=$((n / 1000))
    local rem=$((n - whole * 1000))
    local dec=$((rem / 100))
    if [ "$dec" -eq 0 ]; then printf '%dk' "$whole"; else printf '%d.%dk' "$whole" "$dec"; fi
    return
  fi
  local whole=$((n / 1000000))
  local rem=$((n - whole * 1000000))
  local dec=$((rem / 100000))
  if [ "$dec" -eq 0 ]; then printf '%dM' "$whole"; else printf '%d.%dM' "$whole" "$dec"; fi
}
__fmt_token_full() {
  local n
  n="$(__norm_int "$1")"
  printf '%s' "$n" | awk '{
    s=$0; out=""; n=length(s)
    while (n > 3) { out=","substr(s,n-2,3) out; n -= 3 }
    out=substr(s,1,n) out
    printf "%s", out
  }'
}
__tokens_used() { __field 'context_window.total_input_tokens'; }
__tokens_total() { __field 'context_window.context_window_size'; }
__tokens_remaining() {
  local u t
  u="$(__norm_int "$(__tokens_used)")"
  t="$(__norm_int "$(__tokens_total)")"
  local r=$((t - u))
  if [ "$r" -lt 0 ]; then r=0; fi
  printf '%d' "$r"
}
__tokens_pct_int() {
  local p="$(__field 'context_window.used_percentage')"
  __norm_int "$p"
}
__tick() {
  if [ -n "\${STATUSLINE_CLOCK_OVERRIDE:-}" ]; then
    printf '%s' "$STATUSLINE_CLOCK_OVERRIDE"
  else
    date +%s
  fi
}
__rel_time() {
  local target="$1"
  if [ -z "$target" ]; then printf ''; return; fi
  case "$target" in
    ''|*[!0-9.-]*) printf ''; return ;;
  esac
  local t_int="\${target%.*}"
  if [ -z "$t_int" ] || [ "$t_int" = "-" ]; then printf ''; return; fi
  local now diff h m s rem
  now=$(__tick)
  diff=$((t_int - now))
  if [ "$diff" -le 0 ]; then printf ''; return; fi
  if [ "$diff" -lt 60 ]; then printf 'T-%ds' "$diff"; return; fi
  if [ "$diff" -lt 3600 ]; then
    m=$((diff/60)); s=$((diff%60))
    printf 'T-%dm%02ds' "$m" "$s"; return
  fi
  h=$((diff/3600)); rem=$(((diff%3600)/60))
  printf 'T-%dh%02dm' "$h" "$rem"
}
`;

function bashEscapeSingleQuoted(s: string): string {
  return s.replace(/'/g, "'\\''");
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
    case "literal": {
      const text = bashEscapeSingleQuoted(op.text);
      return `${pad}__emit '${styleCodes}' '${text}'\n`;
    }
    case "field": {
      const path = bashEscapeSingleQuoted(op.path);
      const t = op.transform ?? "raw";
      const truncateLine = op.truncate
        ? `__v="$(__truncate "$__v" ${op.truncate})"`
        : "";
      const transformLine =
        t === "basename"
          ? `__v="$(__basename "$__v")"`
          : t === "tilde"
            ? `__v="$(__tildify "$__v")"`
            : t === "compact"
              ? `__v="$(__compact "$__v")"`
              : "";
      return (
        `${pad}__v="$(__field '${path}')"\n` +
        (transformLine ? `${pad}${transformLine}\n` : "") +
        (truncateLine ? `${pad}${truncateLine}\n` : "") +
        `${pad}__emit '${styleCodes}' "$__v"\n`
      );
    }
    case "cond": {
      const path = bashEscapeSingleQuoted(op.expr.field);
      const isComputedDirty = op.expr.field === "__computed.git_dirty";
      let test = "";
      const expectedDirty =
        op.expr.op !== "exists" ? String(op.expr.value) : "1";
      if (isComputedDirty) {
        test = `[ "$(__git_dirty)" = '${bashEscapeSingleQuoted(expectedDirty)}' ]`;
      } else if (op.expr.op === "exists") {
        test = `[ -n "$(__field '${path}')" ]`;
      } else if (op.expr.op === "eq") {
        test = `[ "$(__field '${path}')" = '${bashEscapeSingleQuoted(String(op.expr.value))}' ]`;
      } else if (op.expr.op === "gt") {
        test = `awk -v v="$(__field '${path}')" 'BEGIN{exit !(v+0 > ${Number(op.expr.value)})}'`;
      } else if (op.expr.op === "lt") {
        test = `awk -v v="$(__field '${path}')" 'BEGIN{exit !(v+0 < ${Number(op.expr.value)})}'`;
      }
      let out = `${pad}if ${test}; then\n`;
      if (op.then.length === 0) {
        // Bash requires at least one statement in the `then` branch — emit
        // a no-op so an inverted/empty conditional (used e.g. by
        // `outputStyle` to mean "show unless equal to default") parses.
        out += `${pad}  :\n`;
      } else {
        for (const child of op.then) out += emitOp(child, depth + 1);
      }
      if (op.else && op.else.length > 0) {
        out += `${pad}else\n`;
        for (const child of op.else) out += emitOp(child, depth + 1);
      }
      out += `${pad}fi\n`;
      return out;
    }
    case "progressBar": {
      const path = bashEscapeSingleQuoted(op.pctPath);
      const f = bashEscapeSingleQuoted(op.filled);
      const e = bashEscapeSingleQuoted(op.empty);
      return (
        `${pad}__v="$(__field '${path}')"\n` +
        `${pad}__bar_out="$(__bar "$__v" ${op.width} '${f}' '${e}')"\n` +
        `${pad}__emit '${styleCodes}' "$__bar_out"\n`
      );
    }
    case "split": {
      const src = op.sourceOp;
      const join = bashEscapeSingleQuoted(op.joinWith ?? op.delimiter);
      const delim = bashEscapeSingleQuoted(op.delimiter);
      let prelude = "";
      if (src.op === "field") {
        const t = src.transform ?? "raw";
        prelude =
          `${pad}__v="$(__field '${bashEscapeSingleQuoted(src.path)}')"\n` +
          (t === "basename" ? `${pad}__v="$(__basename "$__v")"\n` : "") +
          (t === "tilde" ? `${pad}__v="$(__tildify "$__v")"\n` : "") +
          (t === "compact" ? `${pad}__v="$(__compact "$__v")"\n` : "");
      } else if (src.op === "literal") {
        prelude = `${pad}__v='${bashEscapeSingleQuoted(src.text)}'\n`;
      } else if (src.op === "compute" && src.expr === "git_branch") {
        prelude = `${pad}__v="$(__git_branch)"\n`;
      } else {
        prelude = `${pad}__v=''\n`;
      }
      let body = prelude;
      body += `${pad}__sep='${delim}'\n`;
      body += `${pad}__join='${join}'\n`;
      body += `${pad}IFS="$__sep" read -r -a __parts <<< "$__v"\n`;
      body += `${pad}__first=1\n`;
      body += `${pad}for __idx in "\${!__parts[@]}"; do\n`;
      body += `${pad}  if [ "$__first" -eq 0 ]; then printf '%s' "$__join"; fi\n`;
      body += `${pad}  __first=0\n`;
      body += `${pad}  __piece="\${__parts[$__idx]}"\n`;
      const lastIdx = op.segments.length - 1;
      body += `${pad}  case "$__idx" in\n`;
      for (let i = 0; i < op.segments.length; i++) {
        const seg = op.segments[i]!;
        const codes = sgrCodes(seg.style);
        const pre = bashEscapeSingleQuoted(seg.prefix ?? "");
        const suf = bashEscapeSingleQuoted(seg.suffix ?? "");
        const match = i === lastIdx ? "*" : `${i}`;
        body += `${pad}    ${match})\n`;
        body += `${pad}      __pre='${pre}'\n`;
        body += `${pad}      __suf='${suf}'\n`;
        body += `${pad}      __emit '${codes}' "\${__pre}\${__piece}\${__suf}"\n`;
        body += `${pad}      ;;\n`;
      }
      body += `${pad}  esac\n`;
      body += `${pad}done\n`;
      return body;
    }
    case "compute": {
      const arg = op.argPath ? bashEscapeSingleQuoted(op.argPath) : "";
      switch (op.expr) {
        case "duration_human":
          return (
            `${pad}__v="$(__field '${arg}')"\n` +
            `${pad}__out="$(__dur_human "\${__v:-0}")"\n` +
            `${pad}__emit '${styleCodes}' "$__out"\n`
          );
        case "duration_hms":
          return (
            `${pad}__v="$(__field '${arg}')"\n` +
            `${pad}__out="$(__dur_hms "\${__v:-0}")"\n` +
            `${pad}__emit '${styleCodes}' "$__out"\n`
          );
        case "cost_fmt":
          return (
            `${pad}__v="$(__field '${arg}')"\n` +
            `${pad}__out="$(__cost_fmt "\${__v:-0}" ${op.precision ?? 2})"\n` +
            `${pad}__emit '${styleCodes}' "$__out"\n`
          );
        case "git_branch":
          return (
            `${pad}__out="$(__git_branch)"\n` +
            `${pad}__emit '${styleCodes}' "$__out"\n`
          );
        case "git_dirty":
          return (
            `${pad}__out="$(__git_dirty)"\n` +
            `${pad}__emit '${styleCodes}' "$__out"\n`
          );
        case "relative_time":
          return (
            `${pad}__v="$(__field '${arg}')"\n` +
            `${pad}__out="$(__rel_time "$__v")"\n` +
            `${pad}__emit '${styleCodes}' "$__out"\n`
          );
      }
    }
    case "tokenDisplay": {
      const fnFmt = op.compact ? "__fmt_token_compact" : "__fmt_token_full";
      switch (op.variant) {
        case "used":
          return (
            `${pad}__v="$(__tokens_used)"\n` +
            `${pad}__out="$(${fnFmt} "$__v")"\n` +
            `${pad}__emit '${styleCodes}' "$__out"\n`
          );
        case "remaining":
          return (
            `${pad}__v="$(__tokens_remaining)"\n` +
            `${pad}__out="$(${fnFmt} "$__v")"\n` +
            `${pad}__emit '${styleCodes}' "$__out"\n`
          );
        case "ratio":
          return (
            `${pad}__u="$(__tokens_used)"\n` +
            `${pad}__t="$(__tokens_total)"\n` +
            `${pad}__uf="$(${fnFmt} "$__u")"\n` +
            `${pad}__tf="$(${fnFmt} "$__t")"\n` +
            `${pad}__emit '${styleCodes}' "$__uf/$__tf"\n`
          );
        case "ratioPct":
          return (
            `${pad}__u="$(__tokens_used)"\n` +
            `${pad}__t="$(__tokens_total)"\n` +
            `${pad}__p="$(__tokens_pct_int)"\n` +
            `${pad}__uf="$(${fnFmt} "$__u")"\n` +
            `${pad}__tf="$(${fnFmt} "$__t")"\n` +
            `${pad}__emit '${styleCodes}' "$__uf/$__tf ($__p%)"\n`
          );
      }
      return "";
    }
    case "rotator": {
      const n = op.items.length;
      if (n === 0) return "";
      const interval = Math.max(1, Math.floor(op.intervalSeconds));
      let pickLine: string;
      if (op.pickMode === "random") {
        pickLine = `${pad}__idx=$(( RANDOM % ${n} ))\n`;
      } else {
        pickLine =
          `${pad}__now=$(__tick)\n` +
          `${pad}__idx=$(( (__now / ${interval}) % ${n} ))\n`;
      }
      let body = `${pad}__items=(`;
      body += op.items
        .map((s) => `'${bashEscapeSingleQuoted(s)}'`)
        .join(" ");
      body += ")\n";
      body += pickLine;
      body += `${pad}__emit '${styleCodes}' "\${__items[$__idx]}"\n`;
      return body;
    }
    case "lineBreak":
      // Reset SGR state, emit a real LF byte, then reset again. The first reset
      // prevents bg colors bleeding past the line; the second makes the next
      // line begin with an ANSI escape, which shields its leading whitespace
      // from Claude Code's per-line leading-whitespace trimming.
      return `${pad}__reset\n${pad}printf '\\n'\n${pad}__reset\n`;
    case "fixedSpacer": {
      if (op.width <= 0) return "";
      const ch = bashEscapeSingleQuoted(op.char);
      return `${pad}__repeat_char '${ch}' ${op.width}\n`;
    }
    case "flexSpacer":
      // Top-level flex spacers are handled by the deck partitioner in
      // compileToBash. If we reach this branch we're nested inside a
      // cond, where flex resolution is undefined — emit nothing.
      return "";
  }
}

/**
 * Emit a deck slice as bash. If the slice contains no flex spacers, emit
 * the ops straight through (preserving the old fast path so non-spacer
 * designs are byte-equivalent to before). Otherwise, capture each chunk
 * to a variable via command substitution, measure visible widths, and
 * emit pad spans between them computed from STATUSLINE_COLS.
 */
function emitDeck(deckOps: RenderOp[]): string {
  const flexCount = deckOps.filter((op) => op.op === "flexSpacer").length;
  if (flexCount === 0) {
    return deckOps.map((op) => emitOp(op, 0)).join("");
  }

  // Partition into chunks at each flexSpacer. spacerChars[i] is the
  // padding character to use after chunk i.
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

  let body = "";
  // Compile each chunk into a subshell-renderable form: capture via
  //   __chunk_N="$(...statements...)"
  // The statements are the normal emitOp output for that chunk.
  const chunkVars: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const name = `__chunk_${i}`;
    chunkVars.push(name);
    const chunkBody = chunks[i]!.map((op) => emitOp(op, 1)).join("");
    body += `${name}="$( {\n${chunkBody}} )"\n`;
  }

  // Drop trailing flex spacer if the last chunk is empty (spacer at EOL).
  let activeSpacerCount = spacerChars.length;
  let lastIdx = chunks.length - 1;
  // We can't know chunk emptiness statically (it depends on runtime
  // fields), but the documented edge case is "spacer at end of line"
  // which means the AST chunk list is `[ops, ..., []]` — an empty array
  // of ops. Detect that here.
  if (
    activeSpacerCount > 0 &&
    chunks[lastIdx]!.length === 0
  ) {
    activeSpacerCount--;
    lastIdx--;
  }

  // Compute lengths and emit padding. We rely on bash arithmetic for
  // floor + distribute-leftover.
  body += `__total_len=0\n`;
  for (let i = 0; i <= lastIdx; i++) {
    body += `__len_${i}=$(__visible_len "$${chunkVars[i]}")\n`;
    body += `__total_len=$((__total_len + __len_${i}))\n`;
  }
  body += `__remaining=$((STATUSLINE_COLS - __total_len))\n`;
  body += `if [ "$__remaining" -lt 0 ]; then __remaining=0; fi\n`;
  if (activeSpacerCount > 0) {
    body += `__pad_base=$((__remaining / ${activeSpacerCount}))\n`;
    body += `__pad_extra=$((__remaining - __pad_base * ${activeSpacerCount}))\n`;
  } else {
    body += `__pad_base=0\n__pad_extra=0\n`;
  }

  let spacerSeen = 0;
  for (let i = 0; i <= lastIdx; i++) {
    body += `printf '%s' "$${chunkVars[i]}"\n`;
    if (i < lastIdx) {
      const ch = bashEscapeSingleQuoted(spacerChars[i] ?? " ");
      // First `__pad_extra` paddings get one bonus char.
      body += `if [ ${spacerSeen} -lt "$__pad_extra" ]; then\n`;
      body += `  __repeat_char '${ch}' $((__pad_base + 1))\n`;
      body += `else\n`;
      body += `  __repeat_char '${ch}' "$__pad_base"\n`;
      body += `fi\n`;
      spacerSeen++;
    }
  }

  return body;
}

export function compileToBash(design: Design): string {
  const ops = compileToOps(design);

  // Partition into decks at each top-level lineBreak. Each deck gets
  // compiled independently so flex-spacer math is per-line.
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
    body += emitDeck(decks[d]!);
    if (d < decks.length - 1) {
      // Same contract as a lineBreak op: reset, newline, reset — the trailing
      // reset makes the next line start with an ANSI escape so Claude Code's
      // per-line leading-whitespace trim can't drop a leading indent.
      body += `__reset\nprintf '\\n'\n__reset\n`;
    }
  }

  return BASH_HEADER + body + "\nexit 0\n";
}

export { sgrCodes as __sgrCodes };
