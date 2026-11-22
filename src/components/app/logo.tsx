import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("h-7 w-7", className)}>
      <rect width="32" height="32" rx="9" className="fill-primary" />
      <rect x="6" y="12" width="3" height="8" rx="1" className="fill-primary-foreground" />
      <rect x="10" y="9.5" width="3" height="13" rx="1" className="fill-primary-foreground" />
      <rect x="13" y="15" width="6" height="2" className="fill-primary-foreground" />
      <rect x="19" y="9.5" width="3" height="13" rx="1" className="fill-primary-foreground" />
      <rect x="23" y="12" width="3" height="8" rx="1" className="fill-primary-foreground" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="font-display text-lg font-bold tracking-tight">IronLog</span>
    </span>
  );
}
