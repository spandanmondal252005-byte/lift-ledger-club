import { CATEGORY_TONE, categoryLabel } from "@/lib/exercise-meta";
import { cn } from "@/lib/utils";

export function MuscleChip({ category, className }: { category: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-raised px-2 py-0.5 text-[11px] font-medium text-muted-foreground",
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: CATEGORY_TONE[category] }} />
      {categoryLabel(category)}
    </span>
  );
}
