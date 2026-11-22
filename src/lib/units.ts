export type Unit = "kg" | "lb";

export const KG_TO_LB = 2.20462262;

/** Weights are stored in kilograms. Convert a stored kg value to the user's display unit. */
export function toDisplayWeight(kg: number | null | undefined, unit: Unit): number | null {
  if (kg == null || Number.isNaN(Number(kg))) return null;
  const n = Number(kg);
  return unit === "kg" ? n : n * KG_TO_LB;
}

/** Convert a value typed in the user's unit back to kilograms for storage. */
export function toKg(value: number, unit: Unit): number {
  const kg = unit === "kg" ? value : value / KG_TO_LB;
  return Math.round(kg * 100) / 100;
}

/** Trim a number for an input field: at most 2 decimals, no trailing zeros. */
export function trimNumber(n: number | null | undefined, decimals = 2): string {
  if (n == null || Number.isNaN(n)) return "";
  return String(Number(n.toFixed(decimals)));
}

export function formatWeight(kg: number | null | undefined, unit: Unit, decimals = 1): string {
  const v = toDisplayWeight(kg, unit);
  if (v == null) return "—";
  return `${Number(v.toFixed(decimals)).toLocaleString("en-IN")} ${unit}`;
}

/** Compact volume, e.g. "12.4k kg". */
export function formatVolume(kg: number | null | undefined, unit: Unit): string {
  const v = toDisplayWeight(kg ?? 0, unit) ?? 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M ${unit}`;
  if (v >= 10_000) return `${(v / 1000).toFixed(1)}k ${unit}`;
  return `${Math.round(v).toLocaleString("en-IN")} ${unit}`;
}
