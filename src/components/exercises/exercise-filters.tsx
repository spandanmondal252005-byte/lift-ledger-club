import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { MUSCLE_CATEGORIES, categoryLabel } from "@/lib/exercise-meta";
import { cn } from "@/lib/utils";
import type { Exercise } from "@/lib/api/exercises";

export type ExerciseFilter = { q: string; category: string; customOnly: boolean };

export function filterExercises(list: Exercise[], f: ExerciseFilter): Exercise[] {
  const q = f.q.trim().toLowerCase();
  return list.filter((e) => {
    if (f.category !== "all" && e.category !== f.category) return false;
    if (f.customOnly && !e.user_id) return false;
    if (!q) return true;
    return (
      e.name.toLowerCase().includes(q) ||
      e.primary_muscle.toLowerCase().includes(q) ||
      e.equipment.toLowerCase().includes(q) ||
      e.secondary_muscles.some((m) => m.toLowerCase().includes(q))
    );
  });
}

export function ExerciseFilters({
  value,
  onChange,
  showCustomToggle = true,
  autoFocus = false,
}: {
  value: ExerciseFilter;
  onChange: (f: ExerciseFilter) => void;
  showCustomToggle?: boolean;
  autoFocus?: boolean;
}) {
  const chips = [{ v: "all", l: "All" }, ...MUSCLE_CATEGORIES.map((c) => ({ v: c, l: categoryLabel(c) }))];
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus={autoFocus}
          value={value.q}
          onChange={(e) => onChange({ ...value, q: e.target.value })}
          placeholder="Search exercises, muscles or equipment"
          className="h-11 pl-9"
        />
      </div>
      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {showCustomToggle && (
          <button
            type="button"
            onClick={() => onChange({ ...value, customOnly: !value.customOnly })}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              value.customOnly
                ? "border-primary/50 bg-primary-soft text-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            My exercises
          </button>
        )}
        {chips.map((c) => (
          <button
            key={c.v}
            type="button"
            onClick={() => onChange({ ...value, category: c.v })}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              value.category === c.v
                ? "border-foreground/30 bg-surface-raised text-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {c.l}
          </button>
        ))}
      </div>
    </div>
  );
}
