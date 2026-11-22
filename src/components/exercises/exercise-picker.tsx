import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MuscleChip } from "@/components/app/muscle-chip";
import { exercisesQuery, type Exercise } from "@/lib/api/exercises";
import { equipmentLabel } from "@/lib/exercise-meta";
import { cn } from "@/lib/utils";
import { ExerciseFilters, filterExercises, type ExerciseFilter } from "./exercise-filters";
import { ExerciseFormDialog } from "./exercise-form-dialog";

export function ExercisePicker({
  open,
  onOpenChange,
  userId,
  onAdd,
  title = "Add exercises",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  userId: string;
  onAdd: (list: Exercise[]) => void;
  title?: string;
}) {
  const q = useQuery(exercisesQuery());
  const [filter, setFilter] = useState<ExerciseFilter>({ q: "", category: "all", customOnly: false });
  const [selected, setSelected] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const list = useMemo(() => filterExercises(q.data ?? [], filter), [q.data, filter]);

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  function confirm() {
    const byId = new Map((q.data ?? []).map((e) => [e.id, e]));
    onAdd(selected.map((id) => byId.get(id)).filter((e): e is Exercise => !!e));
    setSelected([]);
    onOpenChange(false);
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!o) setSelected([]);
          onOpenChange(o);
        }}
      >
        <DialogContent className="flex h-[92vh] max-h-[92vh] flex-col gap-0 p-0 sm:h-[80vh] sm:max-w-xl">
          <DialogHeader className="border-b border-border p-5 pb-4">
            <div className="flex items-center justify-between pr-8">
              <DialogTitle className="font-display text-xl">{title}</DialogTitle>
              <Button size="sm" variant="ghost" onClick={() => setCreating(true)}>
                <Plus /> Custom
              </Button>
            </div>
            <div className="pt-3 text-left">
              <ExerciseFilters value={filter} onChange={setFilter} />
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-2 py-2">
            {q.isLoading ? (
              Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="m-2 h-14" />)
            ) : list.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">
                No exercises match.{" "}
                <button className="text-primary hover:underline" onClick={() => setCreating(true)}>
                  Create a custom one
                </button>
              </div>
            ) : (
              list.map((e) => {
                const on = selected.includes(e.id);
                const order = selected.indexOf(e.id) + 1;
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => toggle(e.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors",
                      on ? "bg-primary-soft" : "hover:bg-surface-raised",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{e.name}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <MuscleChip category={e.category} />
                        <span className="text-xs text-muted-foreground">{equipmentLabel(e.equipment)}</span>
                        {e.user_id && <span className="text-xs text-primary">Custom</span>}
                      </div>
                    </div>
                    <span
                      className={cn(
                        "grid h-6 w-6 shrink-0 place-items-center rounded-md border text-xs font-semibold",
                        on ? "border-primary bg-primary text-primary-foreground" : "border-border-strong",
                      )}
                    >
                      {on ? order : null}
                    </span>
                  </button>
                );
              })
            )}
          </div>
          <div className="border-t border-border p-4">
            <Button variant="hero" size="lg" className="w-full" disabled={selected.length === 0} onClick={confirm}>
              <Check />
              {selected.length === 0 ? "Select exercises" : `Add ${selected.length} exercise${selected.length > 1 ? "s" : ""}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <ExerciseFormDialog
        open={creating}
        onOpenChange={setCreating}
        userId={userId}
        onSaved={(e) => setSelected((s) => [...s, e.id])}
      />
    </>
  );
}
