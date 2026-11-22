import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { QueryError } from "@/components/app/query-error";
import { StartButton } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useUser } from "@/hooks/use-user";
import { useUnit } from "@/lib/api/profile";
import { historyQuery } from "@/lib/api/workouts";
import { formatDuration, formatWorkoutDate } from "@/lib/format";
import { formatVolume } from "@/lib/units";

export const Route = createFileRoute("/_authenticated/history/")({
  head: () => ({
    meta: [
      { title: "Workout history — IronLog" },
      { name: "description", content: "Every workout you've logged." },
      { property: "og:title", content: "Workout history — IronLog" },
      { property: "og:description", content: "Every workout you've logged." },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const user = useUser();
  const unit = useUnit(user.id);
  const q = useInfiniteQuery(historyQuery());
  const items = q.data?.pages.flat() ?? [];
  return (
    <div className="space-y-6 animate-rise">
      <PageHeader eyebrow="Log" title="History" />
      {q.isError ? (
        <QueryError error={q.error} onRetry={() => q.refetch()} />
      ) : q.isLoading ? (
        Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
      ) : items.length === 0 ? (
        <EmptyState icon={History} title="No workouts yet" description="Finished workouts appear here." action={<StartButton />} />
      ) : (
        <div className="space-y-2">
          {items.map((s) => (
            <Link key={s.id} to="/history/$sessionId" params={{ sessionId: s.id }} className="panel block p-4 transition-colors hover:border-border-strong">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{formatWorkoutDate(s.started_at)} · {formatDuration(s.duration_seconds)}</p>
                </div>
                <div className="text-right">
                  <p className="stat-num text-sm font-semibold">{formatVolume(s.total_volume, unit)}</p>
                  <p className="text-xs text-muted-foreground">{s.total_sets} sets</p>
                </div>
              </div>
              <p className="mt-2 truncate text-xs text-muted-foreground">{s.exercises.join(" · ")}</p>
            </Link>
          ))}
          {q.hasNextPage && (
            <Button variant="subtle" className="w-full" onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage}>
              Load more
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
