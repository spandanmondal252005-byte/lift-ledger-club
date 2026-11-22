import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { QueryError } from "@/components/app/query-error";
import { Skeleton } from "@/components/ui/skeleton";
import { useUser } from "@/hooks/use-user";
import { useUnit } from "@/lib/api/profile";
import { currentBests, recordsQuery } from "@/lib/api/stats";
import { formatWeight } from "@/lib/units";

export const Route = createFileRoute("/_authenticated/records")({
  head: () => ({
    meta: [
      { title: "Personal records — IronLog" },
      { name: "description", content: "Your best lifts on every exercise." },
      { property: "og:title", content: "Personal records — IronLog" },
      { property: "og:description", content: "Your best lifts on every exercise." },
    ],
  }),
  component: RecordsPage,
});

function RecordsPage() {
  const user = useUser();
  const unit = useUnit(user.id);
  const q = useQuery(recordsQuery());
  const rows = q.data ?? [];
  const bests = currentBests(rows);
  const names = new Map(rows.map((r) => [r.exercise_id, r.exercises?.name ?? "Exercise"]));
  return (
    <div className="space-y-6 animate-rise">
      <PageHeader eyebrow="Progress" title="Personal records" />
      {q.isError ? (
        <QueryError error={q.error} onRetry={() => q.refetch()} />
      ) : q.isLoading ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : bests.size === 0 ? (
        <EmptyState icon={Trophy} title="No records yet" description="Finish a workout and your PRs appear here automatically." />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {[...bests.entries()].map(([id, b]) => (
            <Link key={id} to="/exercises/$exerciseId" params={{ exerciseId: id }} className="panel p-4 hover:border-border-strong">
              <p className="font-medium">{names.get(id)}</p>
              <div className="stat-num mt-2 grid grid-cols-3 gap-2 text-sm">
                <span><span className="eyebrow block">Top</span>{formatWeight(b.get("max_weight")?.value, unit)}</span>
                <span><span className="eyebrow block">1RM</span>{formatWeight(b.get("est_1rm")?.value, unit)}</span>
                <span><span className="eyebrow block">Reps</span>{b.get("max_reps")?.value ?? "—"}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
