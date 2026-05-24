export type AnsiColor =
  | { kind: "default" }
  | { kind: "ansi16"; index: number }
  | { kind: "ansi256"; index: number }
  | { kind: "rgb"; r: number; g: number; b: number };

export interface AnsiStyle {
  fg?: AnsiColor;
  bg?: AnsiColor;
  bold?: boolean;
  italic?: boolean;
  dim?: boolean;
  underline?: boolean;
}

export type ConditionExpr =
  | { field: string; op: "exists" }
  | { field: string; op: "gt" | "lt" | "eq"; value: string | number };

export interface BaseElement {
  id: string;
  style: AnsiStyle;
  prefix?: string;
  suffix?: string;
  maxLength?: number;
  showWhen?: ConditionExpr;
}

export type SegmentStyle = {
  style: AnsiStyle;
  prefix?: string;
  suffix?: string;
};

export type Element =
  | (BaseElement & { type: "static"; text: string })
  | (BaseElement & { type: "model" })
  | (BaseElement & { type: "cwd"; mode: "basename" | "full" | "tilde" })
  | (BaseElement & { type: "gitBranch" })
  | (BaseElement & {
      type: "gitStatus";
      dirtyText?: string;
      cleanText?: string;
      dirtyStyle?: AnsiStyle;
      cleanStyle?: AnsiStyle;
    })
  | (BaseElement & { type: "linesAdded" })
  | (BaseElement & { type: "linesRemoved" })
  | (BaseElement & { type: "contextPct" })
  | (BaseElement & {
      type: "contextBar";
      width: number;
      filledChar: string;
      emptyChar: string;
    })
  | (BaseElement & { type: "rateLimit5hPct" })
  | (BaseElement & {
      type: "rateLimit5hBar";
      width: number;
      filledChar: string;
      emptyChar: string;
    })
  | (BaseElement & { type: "rateLimit7dPct" })
  | (BaseElement & {
      type: "rateLimit7dBar";
      width: number;
      filledChar: string;
      emptyChar: string;
    })
  | (BaseElement & { type: "cost"; precision: number })
  | (BaseElement & { type: "sessionDuration"; format: "hms" | "human" })
  | (BaseElement & { type: "glyph"; char: string })
  | (BaseElement & { type: "separator"; text: string })
  | (BaseElement & {
      type: "rotator";
      items: string[];
      intervalSeconds: number;
      pickMode: "cycle" | "random";
    })
  | (BaseElement & {
      type: "segmentSplit";
      source: ElementRef;
      delimiter: string;
      segments: SegmentStyle[];
      joinWith?: string;
    });

export type ElementType = Element["type"];

export type ElementRef =
  | { kind: "literal"; text: string }
  | { kind: "field"; path: string }
  | { kind: "element"; refId: string };

export interface Design {
  version: 1;
  name: string;
  elements: Element[];
  refreshInterval?: number;
  background?: AnsiColor;
}

export interface ClaudeStdin {
  model?: { id?: string; display_name?: string };
  cwd?: string;
  workspace?: {
    current_dir?: string;
    project_dir?: string;
    git_worktree?: string;
  };
  session_id?: string;
  transcript_path?: string;
  version?: string;
  cost?: {
    total_cost_usd?: number;
    total_duration_ms?: number;
    total_api_duration_ms?: number;
    total_lines_added?: number;
    total_lines_removed?: number;
  };
  context_window?: {
    used_percentage?: number;
    remaining_percentage?: number;
    total_input_tokens?: number;
    total_output_tokens?: number;
    context_window_size?: number;
  };
  rate_limits?: {
    five_hour?: { used_percentage?: number; resets_at?: number };
    seven_day?: { used_percentage?: number; resets_at?: number };
  };
  output_style?: { name?: string };
  [k: string]: unknown;
}

export interface TemplateMeta {
  id: string;
  name: string;
  description: string;
  authorCredit?: string;
  design: Design;
}

export interface CommunityCardSummary {
  id: string;
  slug: string;
  name: string;
  author_name: string | null;
  description: string | null;
  forks: number;
  views: number;
  published_at: number;
  forked_from: string | null;
  design: Design;
}
