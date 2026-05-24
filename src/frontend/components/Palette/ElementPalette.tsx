import { useState, type ComponentType } from "react";
import {
  TextT,
  Cube,
  Folder,
  GitBranch,
  ListChecks,
  Plus,
  Minus,
  Percent,
  ChartBar,
  CurrencyDollar,
  Clock,
  Sparkle,
  DotsThree,
  TextColumns,
  Shuffle,
  CaretDown,
  CaretRight,
  Gauge,
  Hourglass,
  CalendarBlank,
  type IconProps,
} from "@phosphor-icons/react";
import type { ElementType } from "../../../shared/types";
import { PaletteItem } from "./PaletteItem";

export interface PaletteEntry {
  type: ElementType;
  label: string;
  description: string;
  Icon: ComponentType<IconProps>;
}

interface PaletteGroup {
  id: string;
  label: string;
  Icon: ComponentType<IconProps>;
  entries: PaletteEntry[];
}

const PALETTE_GROUPS: ReadonlyArray<PaletteGroup> = [
  {
    id: "identity",
    label: "Identity",
    Icon: Cube,
    entries: [
      { type: "model", label: "Model", description: "Current Claude model", Icon: Cube },
      { type: "cwd", label: "Working dir", description: "Current directory", Icon: Folder },
    ],
  },
  {
    id: "git",
    label: "Git",
    Icon: GitBranch,
    entries: [
      { type: "gitBranch", label: "Branch", description: "Current branch name", Icon: GitBranch },
      { type: "gitStatus", label: "Status", description: "Clean or dirty marker", Icon: ListChecks },
    ],
  },
  {
    id: "context",
    label: "Context",
    Icon: ChartBar,
    entries: [
      { type: "contextPct", label: "Percentage", description: "Context window %", Icon: Percent },
      { type: "contextBar", label: "Progress bar", description: "Filled / empty bar", Icon: ChartBar },
    ],
  },
  {
    id: "rateLimits",
    label: "Rate limits",
    Icon: Gauge,
    entries: [
      {
        type: "rateLimit5hPct",
        label: "5-hour %",
        description: "Claude.ai 5-hour usage",
        Icon: Hourglass,
      },
      {
        type: "rateLimit5hBar",
        label: "5-hour bar",
        description: "5-hour usage meter",
        Icon: Gauge,
      },
      {
        type: "rateLimit7dPct",
        label: "7-day %",
        description: "Claude.ai 7-day usage",
        Icon: CalendarBlank,
      },
      {
        type: "rateLimit7dBar",
        label: "7-day bar",
        description: "7-day usage meter",
        Icon: ChartBar,
      },
    ],
  },
  {
    id: "session",
    label: "Session",
    Icon: Clock,
    entries: [
      { type: "linesAdded", label: "Lines added", description: "+ this session", Icon: Plus },
      { type: "linesRemoved", label: "Lines removed", description: "- this session", Icon: Minus },
      { type: "cost", label: "Cost", description: "USD so far", Icon: CurrencyDollar },
      { type: "sessionDuration", label: "Duration", description: "Elapsed time", Icon: Clock },
    ],
  },
  {
    id: "text",
    label: "Text",
    Icon: TextT,
    entries: [
      { type: "static", label: "Static text", description: "A fixed string", Icon: TextT },
      { type: "glyph", label: "Glyph", description: "Single unicode char", Icon: Sparkle },
      { type: "separator", label: "Separator", description: "Fixed delimiter", Icon: DotsThree },
    ],
  },
  {
    id: "alive",
    label: "Alive",
    Icon: Shuffle,
    entries: [
      {
        type: "rotator",
        label: "Rotator",
        description: "Cycles emoji/text over time",
        Icon: Shuffle,
      },
    ],
  },
  {
    id: "advanced",
    label: "Advanced",
    Icon: TextColumns,
    entries: [
      { type: "segmentSplit", label: "Split", description: "Split & style parts", Icon: TextColumns },
    ],
  },
];

// Flattened export kept for backwards-compat with any consumer that imported
// PALETTE_ENTRIES (tests, etc.).
export const PALETTE_ENTRIES: ReadonlyArray<PaletteEntry> = PALETTE_GROUPS.flatMap(
  (g) => g.entries,
);

export const ELEMENT_ICONS: Record<ElementType, ComponentType<IconProps>> =
  PALETTE_ENTRIES.reduce(
    (acc, entry) => {
      acc[entry.type] = entry.Icon;
      return acc;
    },
    {} as Record<ElementType, ComponentType<IconProps>>,
  );

export const ELEMENT_LABELS: Record<ElementType, string> = PALETTE_ENTRIES.reduce(
  (acc, entry) => {
    acc[entry.type] = entry.label;
    return acc;
  },
  {} as Record<ElementType, string>,
);

const DEFAULT_OPEN: ReadonlyArray<string> = [
  "identity",
  "git",
  "context",
  "rateLimits",
  "session",
  "alive",
];

export function ElementPalette() {
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(
    () => new Set(DEFAULT_OPEN),
  );

  const toggle = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-3" aria-label="Element palette">
      <div className="px-1">
        <h2 className="text-xs uppercase tracking-wider text-[#8A8A86]">
          Elements
        </h2>
      </div>
      {PALETTE_GROUPS.map((group) => {
        const open = openIds.has(group.id);
        return (
          <section key={group.id} className="flex flex-col">
            <button
              type="button"
              onClick={() => toggle(group.id)}
              aria-expanded={open}
              aria-controls={`palette-group-${group.id}`}
              className="flex items-center gap-2 px-2 py-1.5 rounded-[6px] text-left text-[11px] uppercase tracking-wider text-[#8A8A86] hover:text-[#E8E8E6] hover:bg-white/[0.02] transition-colors"
            >
              {open ? (
                <CaretDown size={10} weight="bold" />
              ) : (
                <CaretRight size={10} weight="bold" />
              )}
              <group.Icon size={12} weight="bold" />
              <span>{group.label}</span>
              <span className="ml-auto text-[10px] text-[#8A8A86]/60">
                {group.entries.length}
              </span>
            </button>
            {open && (
              <div
                id={`palette-group-${group.id}`}
                className="flex flex-col gap-1 mt-1 ml-2 pl-2 border-l border-white/[0.04]"
              >
                {group.entries.map((entry) => (
                  <PaletteItem
                    key={entry.type}
                    type={entry.type}
                    label={entry.label}
                    description={entry.description}
                    Icon={entry.Icon}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
