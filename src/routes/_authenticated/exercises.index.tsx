import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ChevronRight, Library, Plus } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { QueryError } from "@/components/app/query-error";
import { MuscleChip } from "@/components/app/muscle-chip";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ExerciseFilters, filterExercises, type ExerciseFilter } from "@/components/exercises/exercise-filters";
import { ExerciseFormDialog } from "@/components/exercises/exercise-form-dialog";
import { useUser } from "@/hooks/use-user";
import { exercisesQuery } from "@/lib/api/exercises";
import { equipmentLabel } from "@/lib/exercise-meta";

export const Route = createFileRoute("/_authenticated/exercises/")({
  head: () => ({
    meta: [
      { title: "Exercise library — IronLog" },
      { name: "description", content: "Search exercises by muscle group and equipment, or create your own." },
      { property: "og:title", content: "Exercise library — IronLog" },
      { property: "og:description", content: "Search exercises by muscle group and equipment." },
    ],
  }),
  component: ExercisesPage,
});

function ExercisesPage() {
  const user = useUser();
  const q = useQuery(exercisesQuery());
  const [filter, setFilter] = useState<ExerciseFilter>({ q: "", category: "all", customOnly: false });
  const [creating, setCreating] = useState(false);
  const list = useMemo(() => filterExercises(q.data ?? [], filter), [q.data, filter]);

  return (
    <div className="space-y-6 animate-rise">
      <PageHeader
        eyebrow="Library"
        title="Exercises"
        description={q.data ? `${q.data.length} exercises · ${q.data.filter((e) => e.user_id).length} custom` : undefined}
        actions={
          <Button variant="subtle" onClick={() => setCreating(true)}>
            <Plus /> Custom exercise
          </Button>
        }
      />
      <ExerciseFilters value={filter} onChange={setFilter} />

      {q.isError ? (
        <QueryError error={q.error} onRetry={() => q.refetch()} />
      ) : q.isLoading ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-[72px] rounded-xl" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={Library}
          title="No exercises found"
          description="Try a different search, or add it as a custom exercise."
          action={
            <Button variant="hero" onClick={() => setCreating(true)}>
              <Plus /> Create exercise
            </Button>
          }
        />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {list.map((e) => (
            <Link
              key={e.id}
              to="/exercises/$exerciseId"
              params={{ exerciseId: e.id }}
              className="panel group flex items-center gap-3 p-4 transition-colors hover:border-border-strong"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium group-hover:text-primary">{e.name}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <MuscleChip category={e.category} />
                  <span className="text-xs text-muted-foreground">{e.primary_muscle}</span>
                  <span className="text-xs text-muted-foreground">· {equipmentLabel(e.equipment)}</span>
                  {e.user_id && <span className="text-xs font-medium text-primary">Custom</span>}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      )}
      <ExerciseFormDialog open={creating} onOpenChange={setCreating} userId={user.id} />
    </div>
  );
}
