import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = false,
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: LucideIcon;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("panel relative overflow-hidden p-4 sm:p-5", className)}>
      <div className="flex items-center justify-between">
        <p className="eyebrow">{label}</p>
        {Icon && (
          <span
            className={cn(
              "grid h-7 w-7 place-items-center rounded-md",
              accent ? "bg-primary-soft text-primary" : "bg-surface-raised text-muted-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
      <p className="stat-num mt-3 text-2xl font-semibold sm:text-3xl">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
