import type { ClaudeStdin } from "./types";

// Fixed baseline computed at module load so mock `resets_at` values are
// always a sensible offset into the future for inspector previews, but
// stay stable across calls within a session.
const __NOW = Math.floor(Date.now() / 1000);
const RESET_5H = __NOW + 3700;        // ~1h 1m
const RESET_7D = __NOW + 100000;      // ~27h 46m

export const DEFAULT_MOCK_STDIN: ClaudeStdin = {
  model: { id: "claude-opus-4-7", display_name: "Opus 4.7" },
  cwd: "/Users/dev/projects/statusline-maker",
  workspace: {
    current_dir: "/Users/dev/projects/statusline-maker",
    project_dir: "/Users/dev/projects/statusline-maker",
    git_worktree: "feature/auth-refactor",
  },
  session_id: "ses_2026_05_23_abc",
  transcript_path: "/Users/dev/.claude/transcripts/ses_2026_05_23_abc.jsonl",
  version: "1.42.0",
  cost: {
    total_cost_usd: 0.4231,
    total_duration_ms: 8 * 60 * 1000 + 47 * 1000,
    total_api_duration_ms: 5 * 60 * 1000 + 12 * 1000,
    total_lines_added: 247,
    total_lines_removed: 89,
  },
  context_window: {
    used_percentage: 47.2,
    remaining_percentage: 52.8,
    total_input_tokens: 94400,
    total_output_tokens: 12800,
    context_window_size: 200000,
  },
  rate_limits: {
    five_hour: { used_percentage: 32, resets_at: RESET_5H },
    seven_day: { used_percentage: 18, resets_at: RESET_7D },
  },
  output_style: { name: "explanatory" },
  thinking: { enabled: true },
  effort: { level: "high" },
  fast_mode: false,
  // Browser-preview terminal width. Consumed by the interpret backend's
  // flex-spacer math; bash/PS scripts ignore this and read the real
  // terminal width at runtime via tput / [Console]::WindowWidth.
  _terminalWidth: 120,
};

export const MOCK_PRESETS: Record<string, ClaudeStdin> = {
  fresh: {
    ...DEFAULT_MOCK_STDIN,
    cost: {
      total_cost_usd: 0,
      total_duration_ms: 1500,
      total_api_duration_ms: 800,
      total_lines_added: 0,
      total_lines_removed: 0,
    },
    context_window: {
      used_percentage: 4.1,
      remaining_percentage: 95.9,
      total_input_tokens: 8200,
      total_output_tokens: 320,
      context_window_size: 200000,
    },
    rate_limits: {
      five_hour: { used_percentage: 3, resets_at: RESET_5H },
      seven_day: { used_percentage: 8, resets_at: RESET_7D },
    },
  },
  deep: {
    ...DEFAULT_MOCK_STDIN,
    cost: {
      total_cost_usd: 2.84,
      total_duration_ms: 47 * 60 * 1000,
      total_api_duration_ms: 31 * 60 * 1000,
      total_lines_added: 1842,
      total_lines_removed: 612,
    },
    context_window: {
      used_percentage: 89.4,
      remaining_percentage: 10.6,
      total_input_tokens: 178800,
      total_output_tokens: 22400,
      context_window_size: 200000,
    },
    rate_limits: {
      five_hour: { used_percentage: 76, resets_at: RESET_5H },
      seven_day: { used_percentage: 64, resets_at: RESET_7D },
    },
  },
  // High-token preset for absolute-mode threshold testing — drives the
  // contextBar/contextPct into the red zone (>150K default threshold).
  highTokens: {
    ...DEFAULT_MOCK_STDIN,
    context_window: {
      used_percentage: 90,
      remaining_percentage: 10,
      total_input_tokens: 180000,
      total_output_tokens: 24000,
      context_window_size: 200000,
    },
    rate_limits: {
      five_hour: { used_percentage: 61, resets_at: RESET_5H },
      seven_day: { used_percentage: 89, resets_at: RESET_7D },
    },
  },
  mainBranch: {
    ...DEFAULT_MOCK_STDIN,
    workspace: { ...DEFAULT_MOCK_STDIN.workspace, git_worktree: "main" },
  },
  noGit: {
    ...DEFAULT_MOCK_STDIN,
    workspace: {
      current_dir: "/Users/dev/scratch",
      project_dir: "/Users/dev/scratch",
    },
  },
  thinkingOff: {
    ...DEFAULT_MOCK_STDIN,
    thinking: { enabled: false },
  },
  fastMode: {
    ...DEFAULT_MOCK_STDIN,
    fast_mode: true,
  },
  defaultStyle: {
    ...DEFAULT_MOCK_STDIN,
    output_style: { name: "default" },
  },
};

export function getField(obj: unknown, path: string): unknown {
  if (!path) return undefined;
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur === null || cur === undefined) return undefined;
    if (typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}
