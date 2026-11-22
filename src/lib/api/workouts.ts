import { queryOptions, infiniteQueryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export type SessionSummary = {
  id: string;
  name: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  total_volume: number;
  total_sets: number;
};

const SUMMARY_COLS = "id,name,started_at,ended_at,duration_seconds,total_volume,total_sets";

/** All completed sessions (lightweight columns) for stats and charts. */
export const completedSessionsQuery = () =>
  queryOptions({
    queryKey: ["sessions", "completed"],
    queryFn: async (): Promise<SessionSummary[]> => {
      const { data, error } = await supabase
        .from("workout_sessions")
        .select(SUMMARY_COLS)
        .eq("status", "completed")
        .order("started_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []).map((s) => ({ ...s, total_volume: Number(s.total_volume ?? 0) }));
    },
  });

const PAGE = 20;
export type HistoryItem = SessionSummary & { exercises: string[] };

export const historyQuery = () =>
  infiniteQueryOptions({
    queryKey: ["sessions", "history"],
    initialPageParam: 0,
    queryFn: async ({ pageParam }): Promise<HistoryItem[]> => {
      const { data, error } = await supabase
        .from("workout_sessions")
        .select(`${SUMMARY_COLS}, workout_exercises(position, exercises(name))`)
        .eq("status", "completed")
        .order("started_at", { ascending: false })
        .range(pageParam, pageParam + PAGE - 1);
      if (error) throw error;
      return (data ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        started_at: s.started_at,
        ended_at: s.ended_at,
        duration_seconds: s.duration_seconds,
        total_sets: s.total_sets,
        total_volume: Number(s.total_volume ?? 0),
        exercises: [...(s.workout_exercises ?? [])]
          .sort((a, b) => a.position - b.position)
          .map((we) => we.exercises?.name ?? "Exercise"),
      }));
    },
    getNextPageParam: (last, all) => (last.length === PAGE ? all.length * PAGE : undefined),
  });

export const activeSessionQuery = () =>
  queryOptions({
    queryKey: ["sessions", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workout_sessions")
        .select("id,name,started_at")
        .eq("status", "in_progress")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export type SessionDetail = NonNullable<Awaited<ReturnType<typeof fetchSessionDetail>>>;

async function fetchSessionDetail(id: string) {
  const { data, error } = await supabase
    .from("workout_sessions")
    .select(
      "*, workout_exercises(id, exercise_id, position, notes, rest_seconds, exercises(id, name, category, equipment), workout_sets(id, set_number, weight, reps, completed, set_type))",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const exercises = [...(data.workout_exercises ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((we) => ({
      ...we,
      workout_sets: [...(we.workout_sets ?? [])]
        .sort((a, b) => a.set_number - b.set_number)
        .map((s) => ({ ...s, weight: s.weight == null ? null : Number(s.weight) })),
    }));
  return { ...data, total_volume: Number(data.total_volume ?? 0), workout_exercises: exercises };
}

export const sessionDetailQuery = (id: string) =>
  queryOptions({ queryKey: ["session", id], queryFn: () => fetchSessionDetail(id) });

export const sessionRecordsQuery = (id: string) =>
  queryOptions({
    queryKey: ["session-records", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personal_records")
        .select("id, record_type, value, weight, reps, exercise_id, exercises(name)")
        .eq("session_id", id);
      if (error) throw error;
      return data ?? [];
    },
  });

export const lastPerformanceQuery = (exerciseIds: string[], excludeSession: string) =>
  queryOptions({
    queryKey: ["last-performance", excludeSession, [...exerciseIds].sort().join(",")],
    enabled: exerciseIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("last_performance", {
        _exercise_ids: exerciseIds,
        _exclude_session: excludeSession,
      });
      if (error) throw error;
      const map = new Map<string, { weight: number | null; reps: number | null }[]>();
      for (const row of data ?? []) {
        const list = map.get(row.exercise_id) ?? [];
        list.push({ weight: row.weight == null ? null : Number(row.weight), reps: row.reps });
        map.set(row.exercise_id, list);
      }
      return map;
    },
  });

export type WorkoutPayload = {
  name: string;
  notes: string | null;
  exercises: {
    id: string;
    exercise_id: string;
    position: number;
    notes: string | null;
    rest_seconds: number;
    sets: {
      id: string;
      set_number: number;
      weight: number | null;
      reps: number | null;
      completed: boolean;
      set_type: string;
    }[];
  }[];
};

/** Start a new workout (or return the one already in progress). Optionally pre-fill exercises. */
export async function startWorkout(name = "Workout", template?: WorkoutPayload["exercises"]): Promise<string> {
  const { data: existing } = await supabase
    .from("workout_sessions")
    .select("id")
    .eq("status", "in_progress")
    .maybeSingle();
  if (existing) return existing.id;

  const { data, error } = await supabase
    .from("workout_sessions")
    .insert({ name, started_at: new Date().toISOString() })
    .select("id")
    .single();
  if (error) throw error;
  if (template && template.length > 0) {
    await saveWorkout(data.id, { name, notes: null, exercises: template });
  }
  return data.id;
}

export async function saveWorkout(sessionId: string, payload: WorkoutPayload) {
  const { error } = await supabase.rpc("save_workout", {
    _session_id: sessionId,
    _payload: payload as unknown as Json,
  });
  if (error) throw error;
}

export async function finalizeWorkout(sessionId: string) {
  const { data, error } = await supabase.rpc("finalize_workout", { _session_id: sessionId });
  if (error) throw error;
  return (data ?? []).map((r) => ({ ...r, value: Number(r.value) }));
}

export async function deleteWorkout(sessionId: string) {
  const { error } = await supabase.rpc("delete_workout", { _session_id: sessionId });
  if (error) throw error;
}

export async function updateSessionMeta(
  sessionId: string,
  patch: { started_at?: string; duration_seconds?: number },
) {
  const { error } = await supabase.from("workout_sessions").update(patch).eq("id", sessionId);
  if (error) throw error;
}
