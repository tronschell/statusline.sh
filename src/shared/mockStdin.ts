import type { ClaudeStdin } from "./types";

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
    five_hour: { used_percentage: 32, resets_at: 1748120400 },
    seven_day: { used_percentage: 18, resets_at: 1748725200 },
  },
  output_style: { name: "default" },
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
      five_hour: { used_percentage: 3, resets_at: 1748120400 },
      seven_day: { used_percentage: 8, resets_at: 1748725200 },
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
      five_hour: { used_percentage: 76, resets_at: 1748120400 },
      seven_day: { used_percentage: 64, resets_at: 1748725200 },
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
