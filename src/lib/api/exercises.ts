import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Exercise = Tables<"exercises">;

export const exercisesQuery = () =>
  queryOptions({
    queryKey: ["exercises"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("exercises").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

export const exerciseQuery = (id: string) =>
  queryOptions({
    queryKey: ["exercise", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("exercises").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export const exerciseHistoryQuery = (id: string) =>
  queryOptions({
    queryKey: ["exercise-history", id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("exercise_history", { _exercise_id: id });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...r,
        max_weight: Number(r.max_weight ?? 0),
        est_1rm: Number(r.est_1rm ?? 0),
        volume: Number(r.volume ?? 0),
      }));
    },
  });

export type ExerciseInput = Omit<TablesInsert<"exercises">, "user_id" | "id" | "created_at">;

export async function createExercise(userId: string, input: ExerciseInput) {
  const { data, error } = await supabase
    .from("exercises")
    .insert({ ...input, user_id: userId })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateExercise(id: string, patch: TablesUpdate<"exercises">) {
  const { data, error } = await supabase.from("exercises").update(patch).eq("id", id).select("*").single();
  if (error) throw error;
  return data;
}

export async function deleteExercise(id: string) {
  const { error } = await supabase.from("exercises").delete().eq("id", id);
  if (error) throw error;
}
