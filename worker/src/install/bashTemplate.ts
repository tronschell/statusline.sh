import { BRAND_ART_STATUSLINE_SH } from "@statusline/shared/brandArt";

export function bashInstallerTemplate(compiledStatuslineScript: string): string {
  const safe = compiledStatuslineScript.replace(/STATUSLINE_EOF/g, "STATUSLINE_EOF_X");
  return `#!/usr/bin/env bash
set -euo pipefail

CLAUDE_DIR="\${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
mkdir -p "$CLAUDE_DIR"
SL="$CLAUDE_DIR/statusline.sh"

__banner() {
  local color="$1"
  local msg="$2"
  printf '\\n\\033[%sm' "$color"
  cat <<'BANNER_EOF'
${BRAND_ART_STATUSLINE_SH}
BANNER_EOF
  printf '\\033[0m\\n\\033[%sm  %s\\033[0m\\n\\n' "$color" "$msg"
}

cat > "$SL" <<'STATUSLINE_EOF'
${safe}
STATUSLINE_EOF
chmod +x "$SL"

SETTINGS="$CLAUDE_DIR/settings.json"
[ -f "$SETTINGS" ] || echo '{}' > "$SETTINGS"
cp "$SETTINGS" "$SETTINGS.bak.$(date +%s)"

__offer_self_heal() {
  local err_msg="$1"
  if [ "\${STATUSLINE_SELFHEAL:-0}" = "1" ] && command -v claude >/dev/null 2>&1; then
    echo "STATUSLINE_SELFHEAL=1 — invoking 'claude' to repair settings.json" >&2
    local snippet
    snippet="$(head -c 4096 "$SETTINGS" 2>/dev/null || printf '')"
    claude -p "Fix my settings.json at $SETTINGS so it has a top-level statusLine={type:'command',command:'$SL'} while preserving every other key. Current contents:
\`\`\`
$snippet
\`\`\`
Error: $err_msg" || true
    return 0
  fi
  echo "" >&2
  echo "Could not merge settings.json automatically." >&2
  echo "Install 'jq' (brew install jq / apt-get install jq) or python3 and re-run." >&2
  echo "Or set STATUSLINE_SELFHEAL=1 and ensure 'claude' is on PATH to auto-repair." >&2
  echo "Your previous settings.json is backed up at $SETTINGS.bak.*" >&2
  return 1
}

__merge_with_jq() {
  local tmp
  tmp="$(mktemp)"
  jq --arg cmd "$SL" '. + { statusLine: { type:"command", command:$cmd } }' "$SETTINGS" > "$tmp"
  mv "$tmp" "$SETTINGS"
}

__merge_with_python() {
  local py="$1"
  STATUSLINE_PATH="$SL" SETTINGS_PATH="$SETTINGS" "$py" - <<'PYEOF'
import json, os, sys
p = os.environ['SETTINGS_PATH']
sl = os.environ['STATUSLINE_PATH']
try:
    with open(p, 'r', encoding='utf-8') as f:
        d = json.load(f)
except Exception:
    d = {}
if not isinstance(d, dict):
    d = {}
d['statusLine'] = {'type': 'command', 'command': sl}
with open(p, 'w', encoding='utf-8') as f:
    json.dump(d, f, indent=2)
PYEOF
}

__merge_ok=0
if [ "$__merge_ok" = "0" ] && command -v jq >/dev/null 2>&1; then
  if __merge_with_jq 2>/dev/null; then __merge_ok=1; fi
fi
if [ "$__merge_ok" = "0" ] && command -v python3 >/dev/null 2>&1; then
  if __merge_with_python python3 2>/dev/null; then __merge_ok=1; fi
fi
if [ "$__merge_ok" = "0" ] && command -v python >/dev/null 2>&1; then
  if __merge_with_python python 2>/dev/null; then __merge_ok=1; fi
fi
if [ "$__merge_ok" = "0" ]; then
  if __offer_self_heal "all JSON merge backends failed (need jq or python)"; then
    __banner 33 "installed with errors — restart Claude Code to verify"
    exit 0
  fi
  __banner 31 "error: install failed"
  exit 1
fi

__banner 32 "installed successfully — restart Claude Code to see it"
exit 0
`;
}
