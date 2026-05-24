import { styleToSgr, SGR_RESET } from "../ansi";
import type { AnsiStyle, Design } from "../types";
import { compileToOps, type RenderOp } from "./ir";

const BASH_HEADER = `#!/usr/bin/env bash
set -u
INPUT="$(cat)"
export INPUT_JSON="$INPUT"

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
__tick() {
  if [ -n "\${STATUSLINE_CLOCK_OVERRIDE:-}" ]; then
    printf '%s' "$STATUSLINE_CLOCK_OVERRIDE"
  else
    date +%s
  fi
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
      for (const child of op.then) out += emitOp(child, depth + 1);
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
          (t === "tilde" ? `${pad}__v="$(__tildify "$__v")"\n` : "");
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
      }
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
  }
}

export function compileToBash(design: Design): string {
  const ops = compileToOps(design);
  const body = ops.map((op) => emitOp(op, 0)).join("");
  return BASH_HEADER + body + "\nexit 0\n";
}

export { sgrCodes as __sgrCodes };
