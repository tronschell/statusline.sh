import type { TemplateMeta } from "./types";

// Each template lives in its own file under ./templates/ (one design per file)
// so this catalogue stays small and a template can be edited in isolation. The
// shared `el`/`s` helpers live in ./templates/_shared. This module only orders
// them for the gallery and exposes the lookup.
import { template as minimal } from "./templates/minimal";
import { template as neonPulse } from "./templates/neon-pulse";
import { template as verboseDev } from "./templates/verbose-dev";
import { template as twoLineCockpit } from "./templates/two-line-cockpit";
import { template as pastelDashboard } from "./templates/pastel-dashboard";
import { template as triptych } from "./templates/triptych";
import { template as powerline } from "./templates/powerline";
import { template as vitalSigns } from "./templates/vital-signs";
import { template as branchSplit } from "./templates/branch-split";
import { template as modeSwitcher } from "./templates/mode-switcher";
import { template as twoTonePath } from "./templates/two-tone-path";
import { template as oceanWave } from "./templates/ocean-wave";
import { template as contextWatch } from "./templates/context-watch";
import { template as justTheBar } from "./templates/just-the-bar";

// Order is gallery-facing. Interleave by visual density (single-line / multi-line),
// palette family (mono / warm / cool / neon), and feature focus so adjacent
// cards feel distinct. Tests assert membership, not ordering — feel free to
// re-shuffle without breaking anything.
export const TEMPLATES: TemplateMeta[] = [
  minimal,
  neonPulse,
  verboseDev,
  twoLineCockpit,
  pastelDashboard,
  triptych,
  powerline,
  vitalSigns,
  branchSplit,
  modeSwitcher,
  twoTonePath,
  oceanWave,
  contextWatch,
  justTheBar,
];

export function getTemplate(id: string): TemplateMeta | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
