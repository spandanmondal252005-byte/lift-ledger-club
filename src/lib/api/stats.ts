import { queryOptions } from "@tanstack/react-query";
import { subDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

export const muscleStatsQuery = (days: number) =>
  queryOptions({
    queryKey: ["muscle-stats", days],
    queryFn: async () => {
      const since = subDays(new Date(), days).toISOString();
      const { data, error } = await supabase.rpc("muscle_group_stats", { _since: since });
      if (error) throw error;
      return (data ?? [])
        .map((r) => ({ ...r, volume: Number(r.volume ?? 0) }))
        .sort((a, b) => b.sets - a.sets);
    },
  });

export const topExercisesQuery = (limit = 6) =>
  queryOptions({
    queryKey: ["top-exercises", limit],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("top_exercises", { _limit: limit });
      if (error) throw error;
      return data ?? [];
    },
  });

export type RecordRow = {
  id: string;
  exercise_id: string;
  record_type: string;
  value: number;
  weight: number | null;
  reps: number | null;
  session_id: string | null;
  achieved_at: string;
  exercises: { name: string; category: string } | null;
};

export const recordsQuery = () =>
  queryOptions({
    queryKey: ["records"],
    queryFn: async (): Promise<RecordRow[]> => {
      const { data, error } = await supabase
        .from("personal_records")
        .select("id, exercise_id, record_type, value, weight, reps, session_id, achieved_at, exercises(name, category)")
        .order("achieved_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...r,
        value: Number(r.value),
        weight: r.weight == null ? null : Number(r.weight),
      }));
    },
  });

export const exerciseRecordsQuery = (exerciseId: string) =>
  queryOptions({
    queryKey: ["records", exerciseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personal_records")
        .select("id, record_type, value, weight, reps, achieved_at, session_id")
        .eq("exercise_id", exerciseId)
        .order("achieved_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({ ...r, value: Number(r.value), weight: r.weight == null ? null : Number(r.weight) }));
    },
  });

/** Current best of each record type per exercise. */
export function currentBests<T extends { exercise_id: string; record_type: string; value: number }>(rows: T[]) {
  const map = new Map<string, Map<string, T>>();
  for (const r of rows) {
    const byType = map.get(r.exercise_id) ?? new Map<string, T>();
    const prev = byType.get(r.record_type);
    if (!prev || r.value > prev.value) byType.set(r.record_type, r);
    map.set(r.exercise_id, byType);
  }
  return map;
}
