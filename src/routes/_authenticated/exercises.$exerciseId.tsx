import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Trash2, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import { AreaTrend } from "@/components/charts/charts";
import { MuscleChip } from "@/components/app/muscle-chip";
import { QueryError } from "@/components/app/query-error";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ExerciseFormDialog } from "@/components/exercises/exercise-form-dialog";
import { useUser } from "@/hooks/use-user";
import { useUnit } from "@/lib/api/profile";
import { deleteExercise, exerciseHistoryQuery, exerciseQuery } from "@/lib/api/exercises";
import { exerciseRecordsQuery, currentBests } from "@/lib/api/stats";
import { equipmentLabel, RECORD_LABEL } from "@/lib/exercise-meta";
import { formatWeight, formatVolume, toDisplayWeight } from "@/lib/units";
import { errorMessage, formatWorkoutDate } from "@/lib/format";
import { percentChange } from "@/lib/training";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/exercises/$exerciseId")({
  head: () => ({
    meta: [
      { title: "Exercise progress — IronLog" },
      { name: "description", content: "Personal records and performance history for this exercise." },
      { property: "og:title", content: "Exercise progress — IronLog" },
      { property: "og:description", content: "Personal records and performance history." },
    ],
  }),
  component: ExerciseDetail,
});

type Metric = "est_1rm" | "max_weight" | "volume" | "max_reps";
const METRICS: { value: Metric; label: string }[] = [
  { value: "est_1rm", label: "Est. 1RM" },
  { value: "max_weight", label: "Top weight" },
  { value: "volume", label: "Volume" },
  { value: "max_reps", label: "Top reps" },
];

function ExerciseDetail() {
  const { exerciseId } = Route.useParams();
  const user = useUser();
  const unit = useUnit(user.id);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const ex = useQuery(exerciseQuery(exerciseId));
  const hist = useQuery(exerciseHistoryQuery(exerciseId));
  const recs = useQuery(exerciseRecordsQuery(exerciseId));
  const [metric, setMetric] = useState<Metric>("est_1rm");
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const remove = useMutation({
    mutationFn: () => deleteExercise(exerciseId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exercises"] });
      toast.success("Exercise deleted");
      navigate({ to: "/exercises" });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (ex.isError) return <QueryError error={ex.error} onRetry={() => ex.refetch()} />;
  if (ex.isLoading) return <Skeleton className="h-64 w-full rounded-xl" />;
  if (!ex.data)
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground">This exercise doesn't exist or isn't yours.</p>
        <Button asChild variant="subtle" className="mt-4">
          <Link to="/exercises">Back to library</Link>
        </Button>
      </div>
    );

  const e = ex.data;
  const history = hist.data ?? [];
  const points = history.map((h) => {
    const raw = metric === "max_reps" ? h.max_reps : metric === "volume" ? h.volume : metric === "max_weight" ? h.max_weight : h.est_1rm;
    const v = metric === "max_reps" ? raw : (toDisplayWeight(raw, unit) ?? 0);
    return {
      label: new Date(h.started_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      value: Math.round(Number(v) * 10) / 10,
    };
  });
  const change = percentChange(points[0]?.value, points[points.length - 1]?.value);
  const bests = currentBests((recs.data ?? []).map((r) => ({ ...r, exercise_id: exerciseId }))).get(exerciseId);
  const fmt = (v: number) => (metric === "max_reps" ? `${v} reps` : `${v.toLocaleString("en-IN")} ${unit}`);

  return (
    <div className="space-y-6 animate-rise">
      <Link to="/exercises" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Library
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <MuscleChip category={e.category} />
            {e.user_id && <span className="text-xs font-medium text-primary">Custom</span>}
          </div>
          <h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl">{e.name}</h1>
        </div>
        {e.user_id && (
          <div className="flex gap-2">
            <Button variant="subtle" size="sm" onClick={() => setEditing(true)}>
              <Pencil /> Edit
            </Button>
            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 /> Delete
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(["max_weight", "est_1rm", "max_reps", "max_volume"] as const).map((t) => {
          const r = bests?.get(t);
          return (
            <div key={t} className="panel p-4">
              <p className="eyebrow flex items-center gap-1.5">
                <Trophy className="h-3 w-3 text-gold" /> {RECORD_LABEL[t]}
              </p>
              <p className="stat-num mt-2 text-xl font-semibold sm:text-2xl">
                {!r ? "—" : t === "max_reps" ? `${r.value} reps` : t === "max_volume" ? formatVolume(r.value, unit) : formatWeight(r.value, unit)}
              </p>
              {r && (t === "max_weight" || t === "est_1rm" || t === "max_reps") && r.reps != null && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatWeight(r.weight, unit)} × {r.reps}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Performance history</h2>
            {change != null && points.length > 1 && (
              <p className={cn("mt-1 flex items-center gap-1.5 text-sm", change >= 0 ? "text-success" : "text-destructive")}>
                {change >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {change >= 0 ? "Getting stronger" : "Below your starting point"} · {change >= 0 ? "+" : ""}
                {change}% since first session
              </p>
            )}
          </div>
          <div className="inline-flex flex-wrap rounded-lg border border-border bg-surface p-0.5">
            {METRICS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMetric(m.value)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  metric === m.value ? "bg-surface-raised text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-5">
          {hist.isLoading ? (
            <Skeleton className="h-[240px] w-full" />
          ) : points.length === 0 ? (
            <p className="grid h-[200px] place-items-center text-center text-sm text-muted-foreground">
              No completed sets yet. Add this exercise to a workout to start tracking.
            </p>
          ) : (
            <AreaTrend id={`ex-${metric}`} data={points} format={fmt} height={240} />
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="panel space-y-4 p-5">
          <h2 className="font-semibold">About</h2>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="eyebrow">Target</dt>
              <dd className="mt-1">{e.primary_muscle}</dd>
            </div>
            <div>
              <dt className="eyebrow">Equipment</dt>
              <dd className="mt-1">{equipmentLabel(e.equipment)}</dd>
            </div>
            <div className="col-span-2">
              <dt className="eyebrow">Secondary</dt>
              <dd className="mt-1">{e.secondary_muscles.length ? e.secondary_muscles.join(", ") : "—"}</dd>
            </div>
          </dl>
          {e.instructions && (
            <div>
              <p className="eyebrow">Instructions</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{e.instructions}</p>
            </div>
          )}
        </div>

        <div className="panel p-5">
          <h2 className="font-semibold">Previous sessions</h2>
          {history.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nothing logged yet.</p>
          ) : (
            <div className="mt-3 divide-y divide-border">
              {[...history]
                .reverse()
                .slice(0, 10)
                .map((h) => (
                  <Link
                    key={h.session_id}
                    to="/history/$sessionId"
                    params={{ sessionId: h.session_id }}
                    className="grid grid-cols-[1fr_auto_auto] items-center gap-4 py-3 text-sm hover:text-primary"
                  >
                    <span>{formatWorkoutDate(h.started_at)}</span>
                    <span className="stat-num text-muted-foreground">{h.sets} sets</span>
                    <span className="stat-num w-24 text-right font-medium">{formatWeight(h.max_weight, unit)}</span>
                  </Link>
                ))}
            </div>
          )}
        </div>
      </div>

      <ExerciseFormDialog open={editing} onOpenChange={setEditing} userId={user.id} exercise={e} />
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {e.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This also removes it from any logged workouts and deletes its personal records. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => remove.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
