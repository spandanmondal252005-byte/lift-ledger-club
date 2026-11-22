import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/app/query-error";
import { useUser } from "@/hooks/use-user";
import { useUnit } from "@/lib/api/profile";
import { sessionDetailQuery, sessionRecordsQuery } from "@/lib/api/workouts";
import { formatDuration, formatWorkoutDate } from "@/lib/format";
import { formatVolume, formatWeight } from "@/lib/units";
import { RECORD_LABEL } from "@/lib/exercise-meta";

export const Route = createFileRoute("/_authenticated/history/$sessionId")({
  head: () => ({
    meta: [
      { title: "Workout details — IronLog" },
      { name: "description", content: "Sets, reps and records from this workout." },
      { property: "og:title", content: "Workout details — IronLog" },
      { property: "og:description", content: "Sets, reps and records from this workout." },
    ],
  }),
  component: SessionPage,
});

function SessionPage() {
  const { sessionId } = Route.useParams();
  const user = useUser();
  const unit = useUnit(user.id);
  const q = useQuery(sessionDetailQuery(sessionId));
  const prs = useQuery(sessionRecordsQuery(sessionId));
  if (q.isError) return <QueryError error={q.error} onRetry={() => q.refetch()} />;
  if (q.isLoading) return <Skeleton className="h-64 rounded-xl" />;
  const s = q.data;
  if (!s) return <p className="py-20 text-center text-muted-foreground">Workout not found.</p>;
  return (
    <div className="space-y-6 animate-rise">
      <Link to="/history" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> History</Link>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">{s.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{formatWorkoutDate(s.started_at)} · {formatDuration(s.duration_seconds)} · {formatVolume(s.total_volume, unit)} · {s.total_sets} sets</p>
        </div>
        <Button asChild variant="subtle" size="sm"><Link to="/workout/$sessionId" params={{ sessionId }}><Pencil /> Edit</Link></Button>
      </div>
      {(prs.data ?? []).length > 0 && (
        <div className="panel p-4">
          <p className="eyebrow mb-2 flex items-center gap-1.5"><Trophy className="h-3 w-3 text-gold" /> Records set</p>
          {(prs.data ?? []).map((r) => (
            <p key={r.id} className="text-sm">{r.exercises?.name} — {RECORD_LABEL[r.record_type]}: {r.record_type === "max_reps" ? `${r.value} reps` : formatWeight(Number(r.value), unit)}</p>
          ))}
        </div>
      )}
      {s.notes && <p className="text-sm text-muted-foreground">{s.notes}</p>}
      {s.workout_exercises.map((we) => (
        <div key={we.id} className="panel p-4">
          <Link to="/exercises/$exerciseId" params={{ exerciseId: we.exercise_id }} className="font-semibold text-primary hover:underline">{we.exercises?.name}</Link>
          {we.notes && <p className="mt-1 text-xs text-muted-foreground">{we.notes}</p>}
          <div className="mt-2 space-y-1">
            {we.workout_sets.map((set, i) => (
              <p key={set.id} className="stat-num text-sm"><span className="mr-3 text-muted-foreground">{set.set_type === "warmup" ? "W" : i + 1}</span>{formatWeight(set.weight, unit)} × {set.reps ?? "—"}</p>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
