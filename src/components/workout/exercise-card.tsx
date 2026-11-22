import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Check, MoreHorizontal, NotebookPen, Plus, Timer, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MuscleChip } from "@/components/app/muscle-chip";
import { cn } from "@/lib/utils";
import { formatClock } from "@/lib/format";
import { toDisplayWeight, trimNumber, type Unit } from "@/lib/units";
import { newSet, type DraftExercise, type DraftSet, type SetType } from "./draft";

const SET_TYPE_LABEL: Record<SetType, string> = { normal: "Normal", warmup: "Warm-up", drop: "Drop set", failure: "Failure" };
const SET_TYPE_SHORT: Record<SetType, string> = { normal: "", warmup: "W", drop: "D", failure: "F" };
const REST_OPTIONS = [0, 30, 45, 60, 90, 120, 150, 180, 240, 300];

export function ExerciseCard({
  exercise,
  index,
  count,
  unit,
  previous,
  defaultCompleted,
  showNotes,
  onToggleNotes,
  onChange,
  onRemove,
  onMove,
  onSetCompleted,
}: {
  exercise: DraftExercise;
  index: number;
  count: number;
  unit: Unit;
  previous: { weight: number | null; reps: number | null }[] | undefined;
  defaultCompleted: boolean;
  showNotes: boolean;
  onToggleNotes: () => void;
  onChange: (e: DraftExercise) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  onSetCompleted: (e: DraftExercise) => void;
}) {
  const setSet = (i: number, patch: Partial<DraftSet>) =>
    onChange({ ...exercise, sets: exercise.sets.map((s, j) => (j === i ? { ...s, ...patch } : s)) });

  let workingNumber = 0;

  return (
    <section className="panel overflow-hidden">
      <header className="flex items-start justify-between gap-3 px-4 pb-2 pt-4">
        <div className="min-w-0">
          <Link
            to="/exercises/$exerciseId"
            params={{ exerciseId: exercise.exercise_id }}
            className="block truncate font-semibold text-primary hover:underline"
          >
            {exercise.name}
          </Link>
          <div className="mt-1.5 flex items-center gap-2">
            <MuscleChip category={exercise.category} />
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Timer className="h-3 w-3" /> {exercise.rest_seconds ? formatClock(exercise.rest_seconds) : "Off"}
            </span>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label="Exercise options">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onSelect={onToggleNotes}>
              <NotebookPen /> {showNotes ? "Hide note" : "Add note"}
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Timer className="mr-2 h-4 w-4" /> Rest timer
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup
                  value={String(exercise.rest_seconds)}
                  onValueChange={(v) => onChange({ ...exercise, rest_seconds: Number(v) })}
                >
                  {REST_OPTIONS.map((r) => (
                    <DropdownMenuRadioItem key={r} value={String(r)}>
                      {r === 0 ? "Off" : formatClock(r)}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={index === 0} onSelect={() => onMove(-1)}>
              <ArrowUp /> Move up
            </DropdownMenuItem>
            <DropdownMenuItem disabled={index === count - 1} onSelect={() => onMove(1)}>
              <ArrowDown /> Move down
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onRemove} className="text-destructive focus:text-destructive">
              <Trash2 /> Remove exercise
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {(showNotes || exercise.notes) && (
        <div className="px-4 pb-2">
          <Textarea
            value={exercise.notes}
            onChange={(e) => onChange({ ...exercise, notes: e.target.value })}
            placeholder="Notes: seat height, grip, how it felt…"
            rows={2}
            className="min-h-0 resize-none bg-surface text-sm"
          />
        </div>
      )}

      <div className="px-2 pb-2 sm:px-3">
        <div className="grid grid-cols-[2.25rem_1fr_4.75rem_4rem_2.5rem] items-center gap-1.5 px-1 pb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:grid-cols-[2.5rem_1fr_5.5rem_5rem_2.75rem] sm:gap-2">
          <span className="text-center">Set</span>
          <span>Previous</span>
          <span className="text-center">{unit}</span>
          <span className="text-center">Reps</span>
          <span />
        </div>
        {exercise.sets.map((s, i) => {
          if (s.set_type !== "warmup") workingNumber += 1;
          const prev = previous?.[i];
          const prevText =
            prev && prev.reps != null
              ? `${prev.weight != null ? trimNumber(toDisplayWeight(prev.weight, unit), 1) : "BW"} × ${prev.reps}`
              : "—";
          return (
            <div
              key={s.id}
              className={cn(
                "grid grid-cols-[2.25rem_1fr_4.75rem_4rem_2.5rem] items-center gap-1.5 rounded-lg px-1 py-1 transition-colors sm:grid-cols-[2.5rem_1fr_5.5rem_5rem_2.75rem] sm:gap-2",
                s.completed && "bg-success-soft",
              )}
            >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "stat-num h-8 rounded-md text-sm font-semibold transition-colors hover:bg-surface-raised",
                      s.set_type === "warmup" && "text-gold",
                      s.set_type === "drop" && "text-steel",
                      s.set_type === "failure" && "text-destructive",
                    )}
                    aria-label={`Set ${i + 1} options`}
                  >
                    {SET_TYPE_SHORT[s.set_type] || workingNumber}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>Set type</DropdownMenuLabel>
                  <DropdownMenuRadioGroup value={s.set_type} onValueChange={(v) => setSet(i, { set_type: v as SetType })}>
                    {(Object.keys(SET_TYPE_LABEL) as SetType[]).map((t) => (
                      <DropdownMenuRadioItem key={t} value={t}>
                        {SET_TYPE_LABEL[t]}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={exercise.sets.length <= 1}
                    onSelect={() => onChange({ ...exercise, sets: exercise.sets.filter((_, j) => j !== i) })}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 /> Delete set
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <button
                type="button"
                disabled={!prev || prev.reps == null}
                onClick={() =>
                  prev &&
                  setSet(i, {
                    weight: prev.weight != null ? trimNumber(toDisplayWeight(prev.weight, unit), 2) : "",
                    reps: prev.reps != null ? String(prev.reps) : "",
                  })
                }
                className="stat-num truncate text-left text-xs text-muted-foreground enabled:hover:text-foreground"
                title={prev ? "Tap to copy" : undefined}
              >
                {prevText}
              </button>

              <input
                inputMode="decimal"
                type="text"
                value={s.weight}
                onChange={(e) => setSet(i, { weight: e.target.value.replace(/[^0-9.,]/g, "") })}
                onFocus={(e) => e.currentTarget.select()}
                placeholder={prev?.weight != null ? trimNumber(toDisplayWeight(prev.weight, unit), 1) : "0"}
                aria-label={`Set ${i + 1} weight`}
                className="stat-num h-9 w-full rounded-md border border-transparent bg-surface-raised text-center text-sm font-medium outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary/60"
              />
              <input
                inputMode="numeric"
                type="text"
                value={s.reps}
                onChange={(e) => setSet(i, { reps: e.target.value.replace(/[^0-9]/g, "") })}
                onFocus={(e) => e.currentTarget.select()}
                placeholder={prev?.reps != null ? String(prev.reps) : "0"}
                aria-label={`Set ${i + 1} reps`}
                className="stat-num h-9 w-full rounded-md border border-transparent bg-surface-raised text-center text-sm font-medium outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary/60"
              />
              <button
                type="button"
                onClick={() => {
                  const willComplete = !s.completed;
                  let patch: Partial<DraftSet> = { completed: willComplete };
                  // Completing an empty set uses the placeholder (previous) values
                  if (willComplete && s.reps === "" && prev?.reps != null) {
                    patch = {
                      ...patch,
                      reps: String(prev.reps),
                      weight: s.weight || (prev.weight != null ? trimNumber(toDisplayWeight(prev.weight, unit), 2) : ""),
                    };
                  }
                  const next = { ...exercise, sets: exercise.sets.map((x, j) => (j === i ? { ...x, ...patch } : x)) };
                  if (willComplete && (next.sets[i]?.reps ?? "") === "") {
                    onChange({ ...exercise });
                    onSetCompleted({ ...exercise, sets: [] });
                    return;
                  }
                  onChange(next);
                  if (willComplete) onSetCompleted(next);
                }}
                aria-label={s.completed ? `Mark set ${i + 1} incomplete` : `Complete set ${i + 1}`}
                aria-pressed={s.completed}
                className={cn(
                  "mx-auto grid h-8 w-8 place-items-center rounded-md transition-all active:scale-90",
                  s.completed
                    ? "bg-success text-primary-foreground"
                    : "border border-border-strong text-muted-foreground hover:border-success hover:text-success",
                )}
              >
                <Check className="h-4 w-4" strokeWidth={3} />
              </button>
            </div>
          );
        })}
        <Button
          variant="ghost"
          size="sm"
          className="mt-1 w-full text-muted-foreground"
          onClick={() =>
            onChange({ ...exercise, sets: [...exercise.sets, newSet(exercise.sets[exercise.sets.length - 1], defaultCompleted)] })
          }
        >
          <Plus /> Add set
        </Button>
      </div>
    </section>
  );
}
