import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Plus, Trash2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ExercisePicker } from "@/components/exercises/exercise-picker";
import { ExerciseCard } from "@/components/workout/exercise-card";
import { RestTimerBar, useRestTimer } from "@/components/workout/rest-timer";
import { draftFromDetail, newSet, uid, useWorkoutDraft } from "@/components/workout/draft";
import { useUser } from "@/hooks/use-user";
import { useUnit } from "@/lib/api/profile";
import { deleteWorkout, finalizeWorkout, lastPerformanceQuery, sessionDetailQuery } from "@/lib/api/workouts";
import { errorMessage, formatClock } from "@/lib/format";
import { RECORD_LABEL } from "@/lib/exercise-meta";
import { formatWeight } from "@/lib/units";

export const Route = createFileRoute("/_authenticated/workout/$sessionId")({
  head: () => ({
    meta: [
      { title: "Workout — IronLog" },
      { name: "description", content: "Log your sets, reps and rest in real time." },
      { property: "og:title", content: "Workout — IronLog" },
      { property: "og:description", content: "Log your sets, reps and rest in real time." },
    ],
  }),
  component: WorkoutPage,
});

function WorkoutPage() {
  const { sessionId } = Route.useParams();
  const user = useUser();
  const unit = useUnit(user.id);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const detail = useQuery(sessionDetailQuery(sessionId));
  const editing = detail.data?.status === "completed";
  const initial = useMemo(() => (detail.data ? draftFromDetail(detail.data, unit) : null), [detail.data, unit]);
  const { draft, update, status, flush, clearLocal, markDirty } = useWorkoutDraft(sessionId, initial, unit, !editing);
  const timer = useRestTimer();
  const [picker, setPicker] = useState(false);
  const [notesOpen, setNotesOpen] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const exerciseIds = useMemo(() => [...new Set((draft?.exercises ?? []).map((e) => e.exercise_id))], [draft]);
  const prev = useQuery(lastPerformanceQuery(exerciseIds, sessionId));

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (detail.isLoading || (detail.data && !draft)) return <div className="mx-auto max-w-3xl space-y-3 p-4"><Skeleton className="h-16" /><Skeleton className="h-48" /></div>;
  if (!detail.data || !draft)
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground">Workout not found.</p>
        <Button asChild variant="subtle" className="mt-4"><Link to="/dashboard">Back to dashboard</Link></Button>
      </div>
    );

  const completedSets = draft.exercises.reduce((a, e) => a + e.sets.filter((s) => s.completed).length, 0);
  const elapsed = (now - new Date(detail.data.started_at).getTime()) / 1000;

  async function finish() {
    if (completedSets === 0) {
      toast.error("Complete at least one set before finishing.");
      return;
    }
    setBusy(true);
    try {
      markDirty();
      await flush();
      const prs = await finalizeWorkout(sessionId);
      clearLocal();
      timer.stop();
      await qc.invalidateQueries();
      if (prs.length) {
        toast.success(`${prs.length} new personal record${prs.length > 1 ? "s" : ""}!`, {
          description: prs.slice(0, 3).map((p) => `${p.exercise_name}: ${RECORD_LABEL[p.record_type]} ${p.record_type === "max_reps" ? p.value + " reps" : formatWeight(p.value, unit)}`).join(" · "),
          icon: <Trophy className="h-4 w-4" />,
        });
      } else toast.success(editing ? "Workout updated" : "Workout saved");
      navigate({ to: "/history/$sessionId", params: { sessionId } });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function discard() {
    if (!confirm(editing ? "Delete this workout permanently?" : "Discard this workout? Logged sets will be lost.")) return;
    try {
      await deleteWorkout(sessionId);
      clearLocal();
      timer.stop();
      await qc.invalidateQueries();
      navigate({ to: "/dashboard" });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <div className="mx-auto max-w-3xl pb-40">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-xl">
        <Button asChild size="icon-sm" variant="ghost" aria-label="Back"><Link to={editing ? "/history" : "/dashboard"}><ArrowLeft /></Link></Button>
        <div className="min-w-0 flex-1">
          <input value={draft.name} onChange={(e) => update((d) => ({ ...d, name: e.target.value }))} aria-label="Workout name" className="w-full truncate bg-transparent font-semibold outline-none" />
          <p className="stat-num text-xs text-muted-foreground">
            {editing ? "Editing" : formatClock(elapsed)} · {completedSets} sets ·{" "}
            {editing ? "unsaved changes save on finish" : status === "saved" ? "Saved" : status === "error" ? "Offline — kept on device" : "Saving…"}
          </p>
        </div>
        <Button variant="success" size="sm" onClick={finish} disabled={busy}>
          {busy && <Loader2 className="animate-spin" />}
          {editing ? "Save" : "Finish"}
        </Button>
      </header>

      <div className="space-y-3 p-4">
        {draft.exercises.map((ex, i) => (
          <ExerciseCard
            key={ex.id}
            exercise={ex}
            index={i}
            count={draft.exercises.length}
            unit={unit}
            previous={prev.data?.get(ex.exercise_id)}
            defaultCompleted={editing}
            showNotes={!!notesOpen[ex.id]}
            onToggleNotes={() => setNotesOpen((n) => ({ ...n, [ex.id]: !n[ex.id] }))}
            onChange={(next) => update((d) => ({ ...d, exercises: d.exercises.map((x) => (x.id === next.id ? next : x)) }))}
            onRemove={() => update((d) => ({ ...d, exercises: d.exercises.filter((x) => x.id !== ex.id) }))}
            onMove={(dir) =>
              update((d) => {
                const list = [...d.exercises];
                const j = i + dir;
                const a = list[i];
                const b = list[j];
                if (!a || !b) return d;
                list[i] = b;
                list[j] = a;
                return { ...d, exercises: list };
              })
            }
            onSetCompleted={(e) => {
              if (e.sets.length === 0) {
                toast.error("Enter reps first");
                return;
              }
              if (!editing) timer.start(e.rest_seconds, e.name);
            }}
          />
        ))}

        <Button variant="subtle" size="lg" className="w-full" onClick={() => setPicker(true)}>
          <Plus /> Add exercises
        </Button>
        <Textarea value={draft.notes} onChange={(e) => update((d) => ({ ...d, notes: e.target.value }))} placeholder="Workout notes" rows={2} />
        <Button variant="ghost" className="w-full text-destructive" onClick={discard}>
          <Trash2 /> {editing ? "Delete workout" : "Discard workout"}
        </Button>
      </div>

      <ExercisePicker
        open={picker}
        onOpenChange={setPicker}
        userId={user.id}
        onAdd={(list) =>
          update((d) => ({
            ...d,
            exercises: [
              ...d.exercises,
              ...list.map((e) => ({
                id: uid(),
                exercise_id: e.id,
                name: e.name,
                category: e.category,
                equipment: e.equipment,
                notes: "",
                rest_seconds: 90,
                sets: [newSet(undefined, editing)],
              })),
            ],
          }))
        }
      />
      <RestTimerBar timer={timer} />
    </div>
  );
}
