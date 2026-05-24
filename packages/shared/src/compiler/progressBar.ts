export interface BarSpec {
  width: number;
  filled: string;
  empty: string;
}

export function barCells(pct: number, width: number): { filled: number; empty: number } {
  const clamped = Math.max(0, Math.min(100, pct));
  const filled = Math.round((clamped / 100) * width);
  return { filled, empty: width - filled };
}

export function renderBar(pct: number, spec: BarSpec): string {
  const { filled, empty } = barCells(pct, spec.width);
  return spec.filled.repeat(filled) + spec.empty.repeat(empty);
}
