import { addWeeks, addMonths, format, startOfMonth, startOfWeek, differenceInCalendarWeeks } from "date-fns";

/** Epley estimated one-rep max. Mirrors the database function public.est_1rm. */
export function estimateOneRepMax(weight: number | null | undefined, reps: number | null | undefined): number | null {
  if (weight == null || reps == null || reps <= 0) return null;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 100) / 100;
}

const WEEK = { weekStartsOn: 1 as const };

/**
 * Consecutive training weeks (Mon–Sun) with at least one workout.
 * The current week keeps the streak alive even before you train in it.
 */
export function weeklyStreak(dates: Date[], now: Date = new Date()): number {
  if (dates.length === 0) return 0;
  const weeks = new Set(dates.map((d) => startOfWeek(d, WEEK).getTime()));
  let cursor = startOfWeek(now, WEEK);
  if (!weeks.has(cursor.getTime())) cursor = addWeeks(cursor, -1);
  let streak = 0;
  while (weeks.has(cursor.getTime())) {
    streak += 1;
    cursor = addWeeks(cursor, -1);
  }
  return streak;
}

export type SessionLike = { started_at: string; total_volume: number | null; duration_seconds?: number | null };
export type Bucket = { key: string; label: string; volume: number; workouts: number; minutes: number };

export function weeklyBuckets(sessions: SessionLike[], weeks: number, now: Date = new Date()): Bucket[] {
  const current = startOfWeek(now, WEEK);
  const buckets: Bucket[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = addWeeks(current, -i);
    buckets.push({ key: start.toISOString(), label: format(start, "d MMM"), volume: 0, workouts: 0, minutes: 0 });
  }
  for (const s of sessions) {
    const idx = weeks - 1 - differenceInCalendarWeeks(current, new Date(s.started_at), WEEK);
    const b = buckets[idx];
    if (!b) continue;
    b.volume += Number(s.total_volume ?? 0);
    b.workouts += 1;
    b.minutes += Math.round((s.duration_seconds ?? 0) / 60);
  }
  return buckets;
}

export function monthlyBuckets(sessions: SessionLike[], months: number, now: Date = new Date()): Bucket[] {
  const current = startOfMonth(now);
  const buckets: Bucket[] = [];
  const index = new Map<string, Bucket>();
  for (let i = months - 1; i >= 0; i--) {
    const start = addMonths(current, -i);
    const b: Bucket = { key: format(start, "yyyy-MM"), label: format(start, "MMM"), volume: 0, workouts: 0, minutes: 0 };
    buckets.push(b);
    index.set(b.key, b);
  }
  for (const s of sessions) {
    const b = index.get(format(new Date(s.started_at), "yyyy-MM"));
    if (!b) continue;
    b.volume += Number(s.total_volume ?? 0);
    b.workouts += 1;
    b.minutes += Math.round((s.duration_seconds ?? 0) / 60);
  }
  return buckets;
}

export function percentChange(from: number | null | undefined, to: number | null | undefined): number | null {
  if (from == null || to == null || from === 0) return null;
  return Math.round(((to - from) / from) * 1000) / 10;
}

/** Free accounts can save this many routines; Premium is unlimited. Mirrors the database trigger. */
export const FREE_ROUTINE_LIMIT = 3;

export function canCreateRoutine(existing: number, isPremium: boolean): boolean {
  return isPremium || existing < FREE_ROUTINE_LIMIT;
}
