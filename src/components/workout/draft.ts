import { useCallback, useEffect, useRef, useState } from "react";
import { saveWorkout, type SessionDetail, type WorkoutPayload } from "@/lib/api/workouts";
import { toDisplayWeight, toKg, trimNumber, type Unit } from "@/lib/units";

export type SetType = "normal" | "warmup" | "drop" | "failure";
export type DraftSet = { id: string; weight: string; reps: string; completed: boolean; set_type: SetType };
export type DraftExercise = {
  id: string;
  exercise_id: string;
  name: string;
  category: string;
  equipment: string;
  notes: string;
  rest_seconds: number;
  sets: DraftSet[];
};
export type Draft = { name: string; notes: string; exercises: DraftExercise[] };
export type SaveStatus = "saved" | "pending" | "saving" | "error";

export const uid = () => crypto.randomUUID();

export function newSet(prev?: DraftSet, completed = false): DraftSet {
  return { id: uid(), weight: prev?.weight ?? "", reps: prev?.reps ?? "", completed, set_type: "normal" };
}

export function draftFromDetail(detail: SessionDetail, unit: Unit): Draft {
  return {
    name: detail.name,
    notes: detail.notes ?? "",
    exercises: detail.workout_exercises.map((we) => ({
      id: we.id,
      exercise_id: we.exercise_id,
      name: we.exercises?.name ?? "Exercise",
      category: we.exercises?.category ?? "chest",
      equipment: we.exercises?.equipment ?? "",
      notes: we.notes ?? "",
      rest_seconds: we.rest_seconds,
      sets: we.workout_sets.map((s) => ({
        id: s.id,
        weight: trimNumber(toDisplayWeight(s.weight, unit), 2),
        reps: s.reps == null ? "" : String(s.reps),
        completed: s.completed,
        set_type: (s.set_type as SetType) ?? "normal",
      })),
    })),
  };
}

function parseNum(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function draftToPayload(d: Draft, unit: Unit): WorkoutPayload {
  return {
    name: d.name.trim() || "Workout",
    notes: d.notes.trim() || null,
    exercises: d.exercises.map((e, i) => ({
      id: e.id,
      exercise_id: e.exercise_id,
      position: i,
      notes: e.notes.trim() || null,
      rest_seconds: e.rest_seconds,
      sets: e.sets.map((s, j) => {
        const w = parseNum(s.weight);
        const r = parseNum(s.reps);
        return {
          id: s.id,
          set_number: j + 1,
          weight: w == null ? null : toKg(w, unit),
          reps: r == null ? null : Math.round(r),
          completed: s.completed,
          set_type: s.set_type,
        };
      }),
    })),
  };
}

type Stored = { synced: boolean; unit: Unit; draft: Draft; at: number };

/**
 * Holds the workout being edited. Every change is mirrored to localStorage instantly and,
 * when autosave is on, pushed to the database after a short pause. On reload, an unsynced
 * local copy wins over the server copy so nothing typed is lost.
 */
export function useWorkoutDraft(sessionId: string, initial: Draft | null, unit: Unit, autosave: boolean) {
  const key = `ironlog:workout:${sessionId}`;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const latest = useRef<Draft | null>(null);
  const dirty = useRef(false);
  const inFlight = useRef<Promise<void> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistLocal = useCallback(
    (d: Draft, synced: boolean) => {
      try {
        const v: Stored = { synced, unit, draft: d, at: Date.now() };
        localStorage.setItem(key, JSON.stringify(v));
      } catch {
        /* storage full or unavailable */
      }
    },
    [key, unit],
  );

  const flush = useCallback(async (): Promise<void> => {
    if (timer.current) clearTimeout(timer.current);
    if (inFlight.current) await inFlight.current;
    if (!dirty.current || !latest.current) return;
    const snapshot = latest.current;
    dirty.current = false;
    setStatus("saving");
    const p = saveWorkout(sessionId, draftToPayload(snapshot, unit))
      .then(() => {
        if (!dirty.current) {
          persistLocal(snapshot, true);
          setStatus("saved");
        }
      })
      .catch((e: unknown) => {
        dirty.current = true;
        setStatus("error");
        throw e;
      })
      .finally(() => {
        inFlight.current = null;
      });
    inFlight.current = p.catch(() => undefined);
    await p;
  }, [sessionId, unit, persistLocal]);

  const schedule = useCallback(
    (ms: number) => {
      if (!autosave) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        flush().catch(() => {
          // retry later while offline / erroring
          schedule(5000);
        });
      }, ms);
    },
    [autosave, flush],
  );

  // Initialise from local unsynced copy or server data
  useEffect(() => {
    if (!initial || latest.current) return;
    let start = initial;
    let restored = false;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as Stored;
        if (parsed && parsed.synced === false && parsed.unit === unit && parsed.draft) {
          start = parsed.draft;
          restored = true;
        }
      }
    } catch {
      /* ignore corrupt storage */
    }
    latest.current = start;
    setDraft(start);
    if (restored) {
      dirty.current = true;
      setStatus("pending");
      schedule(300);
    }
  }, [initial, key, unit, schedule]);

  const update = useCallback(
    (fn: (d: Draft) => Draft) => {
      if (!latest.current) return;
      const next = fn(latest.current);
      latest.current = next;
      dirty.current = true;
      setDraft(next);
      persistLocal(next, false);
      setStatus("pending");
      schedule(800);
    },
    [persistLocal, schedule],
  );

  // Flush when coming back online or when the tab is hidden
  useEffect(() => {
    if (!autosave) return;
    const onOnline = () => flush().catch(() => undefined);
    const onHide = () => {
      if (document.visibilityState === "hidden") flush().catch(() => undefined);
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onHide);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [autosave, flush]);

  const clearLocal = useCallback(() => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }, [key]);

  const markDirty = useCallback(() => {
    dirty.current = true;
  }, []);

  return { draft, update, status, flush, clearLocal, markDirty, hasUnsaved: () => dirty.current };
}
