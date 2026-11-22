import { addDays, format, isAfter, startOfWeek } from "date-fns";
import { cn } from "@/lib/utils";

/** GitHub-style grid of training days for the last N weeks (Mon–Sun columns). */
export function ConsistencyGrid({ dates, weeks = 16 }: { dates: Date[]; weeks?: number }) {
  const counts = new Map<string, number>();
  for (const d of dates) {
    const k = format(d, "yyyy-MM-dd");
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const today = new Date();
  const first = addDays(startOfWeek(today, { weekStartsOn: 1 }), -(weeks - 1) * 7);
  const columns = Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => addDays(first, w * 7 + d)),
  );
  return (
    <div className="flex gap-1">
      <div className="mr-1 flex flex-col gap-1 text-[9px] leading-none text-muted-foreground">
        {["M", "", "W", "", "F", "", "S"].map((l, i) => (
          <span key={i} className="grid h-3 place-items-center sm:h-3.5">
            {l}
          </span>
        ))}
      </div>
      {columns.map((col, i) => (
        <div key={i} className="flex flex-1 flex-col gap-1">
          {col.map((day) => {
            const c = counts.get(format(day, "yyyy-MM-dd")) ?? 0;
            const future = isAfter(day, today);
            return (
              <span
                key={day.toISOString()}
                title={`${format(day, "EEE d MMM")}${c ? ` · ${c} workout${c > 1 ? "s" : ""}` : ""}`}
                className={cn(
                  "h-3 w-full rounded-[3px] sm:h-3.5",
                  future ? "bg-transparent" : c === 0 ? "bg-surface-raised" : c === 1 ? "bg-primary/70" : "bg-primary",
                )}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
