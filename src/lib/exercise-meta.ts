export const MUSCLE_CATEGORIES = [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "quadriceps",
  "hamstrings",
  "glutes",
  "calves",
  "abs",
] as const;

export type MuscleCategory = (typeof MUSCLE_CATEGORIES)[number];

export const CATEGORY_LABEL: Record<string, string> = {
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  biceps: "Biceps",
  triceps: "Triceps",
  quadriceps: "Quads",
  hamstrings: "Hamstrings",
  glutes: "Glutes",
  calves: "Calves",
  abs: "Abs",
};

/** Each muscle group maps to one of the five chart tokens. */
export const CATEGORY_TONE: Record<string, string> = {
  chest: "var(--chart-1)",
  back: "var(--chart-2)",
  shoulders: "var(--chart-3)",
  biceps: "var(--chart-4)",
  triceps: "var(--chart-5)",
  quadriceps: "var(--chart-1)",
  hamstrings: "var(--chart-2)",
  glutes: "var(--chart-3)",
  calves: "var(--chart-4)",
  abs: "var(--chart-5)",
};

export const EQUIPMENT = [
  "barbell",
  "dumbbell",
  "machine",
  "cable",
  "bodyweight",
  "ez bar",
  "kettlebell",
  "band",
  "smith machine",
  "other",
] as const;

export function categoryLabel(c: string): string {
  return CATEGORY_LABEL[c] ?? c;
}

export function equipmentLabel(e: string): string {
  return e.charAt(0).toUpperCase() + e.slice(1);
}

export const RECORD_LABEL: Record<string, string> = {
  max_weight: "Heaviest weight",
  max_reps: "Most reps",
  est_1rm: "Est. 1RM",
  max_volume: "Best volume",
};
