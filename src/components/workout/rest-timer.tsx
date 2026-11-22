import { useCallback, useEffect, useRef, useState } from "react";
import { Minus, Plus, Timer, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatClock } from "@/lib/format";

const KEY = "ironlog:rest";
type RestState = { endsAt: number; total: number; label: string } | null;

function load(): RestState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as RestState;
    return v && v.endsAt > Date.now() ? v : null;
  } catch {
    return null;
  }
}

export function useRestTimer() {
  const [state, setState] = useState<RestState>(null);
  const [now, setNow] = useState(() => Date.now());
  const notified = useRef(false);

  useEffect(() => setState(load()), []);

  const save = useCallback((s: RestState) => {
    setState(s);
    notified.current = false;
    try {
      if (s) localStorage.setItem(KEY, JSON.stringify(s));
      else localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!state) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [state]);

  const remaining = state ? Math.max(0, Math.ceil((state.endsAt - now) / 1000)) : 0;

  useEffect(() => {
    if (state && remaining === 0 && !notified.current) {
      notified.current = true;
      try {
        navigator.vibrate?.([200, 100, 200]);
      } catch {
        /* unsupported */
      }
      toast("Rest complete — next set!", { icon: "⏱️" });
      save(null);
    }
  }, [remaining, state, save]);

  return {
    active: !!state,
    remaining,
    total: state?.total ?? 0,
    label: state?.label ?? "",
    start: (seconds: number, label: string) => {
      if (seconds <= 0) return;
      setNow(Date.now());
      save({ endsAt: Date.now() + seconds * 1000, total: seconds, label });
    },
    adjust: (delta: number) => {
      if (!state) return;
      const endsAt = Math.max(Date.now() + 1000, state.endsAt + delta * 1000);
      save({ ...state, endsAt, total: Math.max(state.total + delta, 1) });
    },
    stop: () => save(null),
  };
}

export function RestTimerBar({ timer }: { timer: ReturnType<typeof useRestTimer> }) {
  if (!timer.active) return null;
  const pct = timer.total ? (timer.remaining / timer.total) * 100 : 0;
  return (
    <div className="pb-safe fixed inset-x-0 bottom-0 z-40 animate-rise">
      <div className="mx-auto max-w-3xl px-3 pb-3">
        <div className="panel overflow-hidden border-primary/30 shadow-glow">
          <div className="h-1 bg-surface-raised">
            <div className="h-full bg-primary transition-[width] duration-300 ease-linear" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            <Timer className="h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="eyebrow">Rest</p>
              <p className="truncate text-xs text-muted-foreground">{timer.label}</p>
            </div>
            <Button size="icon-sm" variant="subtle" onClick={() => timer.adjust(-15)} aria-label="Subtract 15 seconds">
              <Minus />
            </Button>
            <span className="stat-num w-16 text-center text-2xl font-semibold text-primary">{formatClock(timer.remaining)}</span>
            <Button size="icon-sm" variant="subtle" onClick={() => timer.adjust(15)} aria-label="Add 15 seconds">
              <Plus />
            </Button>
            <Button size="icon-sm" variant="ghost" onClick={timer.stop} aria-label="Skip rest">
              <X />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
