import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { subDays } from "date-fns";
import { CalendarCheck, ChevronRight, Dumbbell, Flame, Layers, Play, Trophy, Weight } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { EmptyState } from "@/components/app/empty-state";
import { QueryError } from "@/components/app/query-error";
import { StartButton } from "@/components/app/app-shell";
import { BarTrend, AreaTrend } from "@/components/charts/charts";
import { ConsistencyGrid } from "@/components/charts/consistency-grid";
import { Skeleton } from "@/components/ui/skeleton";
import { useUser } from "@/hooks/use-user";
import { useProfile, useUnit } from "@/lib/api/profile";
import { completedSessionsQuery } from "@/lib/api/workouts";
import { muscleStatsQuery, recordsQuery, topExercisesQuery } from "@/lib/api/stats";
import { exerciseHistoryQuery } from "@/lib/api/exercises";
import { monthlyBuckets, percentChange, weeklyBuckets, weeklyStreak } from "@/lib/training";
import { formatVolume, formatWeight, toDisplayWeight } from "@/lib/units";
import { formatDuration, formatWorkoutDate, timeAgo } from "@/lib/format";
import { CATEGORY_TONE, RECORD_LABEL, categoryLabel } from "@/lib/exercise-meta";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — IronLog" },
      { name: "description", content: "Your training overview: volume, streak, records and progression." },
      { property: "og:title", content: "Dashboard — IronLog" },
      { property: "og:description", content: "Your training overview on IronLog." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const user = useUser();
  const unit = useUnit(user.id);
  const { data: profile } = useProfile(user.id);
  const sessionsQ = useQuery(completedSessionsQuery());
  const sessions = sessionsQ.data ?? [];

  const stats = useMemo(() => {
    const dates = sessions.map((s) => new Date(s.started_at));
    const totalVolume = sessions.reduce((a, s) => a + s.total_volume, 0);
    const weeks = weeklyBuckets(sessions, 12);
    const thisWeek = weeks[weeks.length - 1]?.workouts ?? 0;
    const avg = weeks.slice(0, -1).reduce((a, w) => a + w.workouts, 0) / Math.max(1, weeks.length - 1);
    return { dates, totalVolume, streak: weeklyStreak(dates), thisWeek, avg, weeks };
  }, [sessions]);

  const firstName = (profile?.display_name ?? "").split(" ")[0];

  return (
    <div className="space-y-8 animate-rise">
      <PageHeader
        eyebrow={new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
        title={firstName ? `Let's go, ${firstName}.` : "Let's go."}
        description="Here's how your training is trending."
        actions={<StartButton className="hidden lg:inline-flex" />}
      />

      {sessionsQ.isError ? (
        <QueryError error={sessionsQ.error} onRetry={() => sessionsQ.refetch()} />
      ) : sessionsQ.isLoading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Workouts" value={sessions.length} sub="completed all-time" icon={Dumbbell} />
          <StatCard label="Volume" value={formatVolume(stats.totalVolume, unit)} sub="total lifted" icon={Weight} />
          <StatCard
            label="Streak"
            value={
              <>
                {stats.streak}
                <span className="ml-1 text-base text-muted-foreground">wk</span>
              </>
            }
            sub="consecutive training weeks"
            icon={Flame}
            accent={stats.streak > 0}
          />
          <StatCard
            label="This week"
            value={stats.thisWeek}
            sub={`avg ${stats.avg.toFixed(1)} / week (12 wk)`}
            icon={CalendarCheck}
          />
        </div>
      )}

      {!sessionsQ.isLoading && sessions.length === 0 && !sessionsQ.isError ? (
        <div className="panel p-6">
          <EmptyState
            icon={Play}
            title="Log your first workout"
            description="Start a session, add exercises from the library and tick off your sets. Your stats, charts and records will appear here."
            action={<StartButton />}
          />
        </div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <VolumeCard sessions={sessions} unit={unit} loading={sessionsQ.isLoading} />
            <div className="panel p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Consistency</h2>
                <span className="eyebrow">16 weeks</span>
              </div>
              <div className="mt-5">
                <ConsistencyGrid dates={stats.dates} />
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4">
                <div>
                  <p className="eyebrow">Last 30 days</p>
                  <p className="stat-num mt-1 text-xl font-semibold">
                    {sessions.filter((s) => new Date(s.started_at) > subDays(new Date(), 30)).length}
                  </p>
                </div>
                <div>
                  <p className="eyebrow">Avg duration</p>
                  <p className="stat-num mt-1 text-xl font-semibold">
                    {formatDuration(
                      sessions.length
                        ? Math.round(sessions.reduce((a, s) => a + (s.duration_seconds ?? 0), 0) / sessions.length)
                        : 0,
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <StrengthCard unit={unit} />
            <MuscleCard />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <RecentRecords unit={unit} />
            <RecentWorkouts sessions={sessions.slice(0, 5)} unit={unit} />
          </div>
        </>
      )}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-surface p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            value === o.value ? "bg-surface-raised text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function VolumeCard({
  sessions,
  unit,
  loading,
}: {
  sessions: { started_at: string; total_volume: number; duration_seconds: number | null }[];
  unit: "kg" | "lb";
  loading: boolean;
}) {
  const [range, setRange] = useState<"week" | "month">("week");
  const [metric, setMetric] = useState<"volume" | "workouts">("volume");
  const buckets = range === "week" ? weeklyBuckets(sessions, 12) : monthlyBuckets(sessions, 12);
  const data = buckets.map((b) => ({
    label: b.label,
    value: metric === "volume" ? (toDisplayWeight(b.volume, unit) ?? 0) : b.workouts,
  }));
  const last = data[data.length - 1]?.value ?? 0;
  const prev = data[data.length - 2]?.value ?? 0;
  const change = percentChange(prev, last);
  return (
    <div className="panel p-5 lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{metric === "volume" ? "Training volume" : "Training frequency"}</h2>
          <p className="mt-1 flex items-baseline gap-2">
            <span className="stat-num text-2xl font-semibold">
              {metric === "volume" ? `${Math.round(last).toLocaleString("en-IN")} ${unit}` : `${last} workouts`}
            </span>
            {change != null && (
              <span className={cn("text-xs font-medium", change >= 0 ? "text-success" : "text-destructive")}>
                {change >= 0 ? "+" : ""}
                {change}% vs last {range}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Segmented
            value={metric}
            onChange={setMetric}
            options={[
              { value: "volume", label: "Volume" },
              { value: "workouts", label: "Sessions" },
            ]}
          />
          <Segmented
            value={range}
            onChange={setRange}
            options={[
              { value: "week", label: "Weekly" },
              { value: "month", label: "Monthly" },
            ]}
          />
        </div>
      </div>
      <div className="mt-4">
        {loading ? (
          <Skeleton className="h-[220px] w-full" />
        ) : (
          <BarTrend
            data={data}
            format={(v) => (metric === "volume" ? `${Math.round(v).toLocaleString("en-IN")} ${unit}` : `${v} workouts`)}
          />
        )}
      </div>
    </div>
  );
}

function StrengthCard({ unit }: { unit: "kg" | "lb" }) {
  const top = useQuery(topExercisesQuery(6));
  const [picked, setPicked] = useState<string | null>(null);
  const exerciseId = picked ?? top.data?.[0]?.exercise_id ?? null;
  const history = useQuery({ ...exerciseHistoryQuery(exerciseId ?? ""), enabled: !!exerciseId });
  const points = (history.data ?? []).map((h) => ({
    label: new Date(h.started_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
    value: Math.round((toDisplayWeight(h.est_1rm, unit) ?? 0) * 10) / 10,
  }));
  const first = points[0]?.value;
  const last = points[points.length - 1]?.value;
  const change = percentChange(first, last);

  return (
    <div className="panel p-5 lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Strength progression</h2>
          <p className="mt-1 text-xs text-muted-foreground">Estimated one-rep max per session</p>
        </div>
        {exerciseId && (
          <Link
            to="/exercises/$exerciseId"
            params={{ exerciseId }}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Details <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
      {top.data && top.data.length > 0 && (
        <div className="no-scrollbar -mx-1 mt-4 flex gap-1.5 overflow-x-auto px-1">
          {top.data.map((t) => (
            <button
              key={t.exercise_id}
              type="button"
              onClick={() => setPicked(t.exercise_id)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-xs transition-colors",
                t.exercise_id === exerciseId
                  ? "border-primary/50 bg-primary-soft text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}
      <div className="mt-4">
        {top.isLoading || history.isLoading ? (
          <Skeleton className="h-[220px] w-full" />
        ) : points.length < 2 ? (
          <p className="grid h-[220px] place-items-center text-center text-sm text-muted-foreground">
            Log this exercise in at least two sessions to see a trend.
          </p>
        ) : (
          <>
            <div className="mb-2 flex items-baseline gap-2">
              <span className="stat-num text-2xl font-semibold">
                {last} {unit}
              </span>
              {change != null && (
                <span className={cn("text-xs font-medium", change >= 0 ? "text-success" : "text-destructive")}>
                  {change >= 0 ? "+" : ""}
                  {change}% since first session
                </span>
              )}
            </div>
            <AreaTrend id="dash-strength" data={points} format={(v) => `${v} ${unit}`} />
          </>
        )}
      </div>
    </div>
  );
}

function MuscleCard() {
  const [days, setDays] = useState<"30" | "90">("30");
  const q = useQuery(muscleStatsQuery(Number(days)));
  const max = Math.max(1, ...(q.data ?? []).map((m) => m.sets));
  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Muscle groups</h2>
        <Segmented
          value={days}
          onChange={setDays}
          options={[
            { value: "30", label: "30d" },
            { value: "90", label: "90d" },
          ]}
        />
      </div>
      <div className="mt-5 space-y-3">
        {q.isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)
        ) : (q.data ?? []).length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No sets logged in this period.</p>
        ) : (
          (q.data ?? []).map((m) => (
            <div key={m.category}>
              <div className="flex items-center justify-between text-sm">
                <span>{categoryLabel(m.category)}</span>
                <span className="stat-num text-xs text-muted-foreground">{m.sets} sets</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-raised">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${(m.sets / max) * 100}%`, backgroundColor: CATEGORY_TONE[m.category] }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function RecentRecords({ unit }: { unit: "kg" | "lb" }) {
  const q = useQuery(recordsQuery());
  const rows = (q.data ?? []).filter((r) => r.record_type !== "max_volume").slice(0, 6);
  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Recent personal records</h2>
        <Link to="/records" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          All records <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="mt-4 divide-y divide-border">
        {q.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="my-2 h-10 w-full" />)
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Finish a workout to set your first PRs.</p>
        ) : (
          rows.map((r) => (
            <Link
              key={r.id}
              to="/exercises/$exerciseId"
              params={{ exerciseId: r.exercise_id }}
              className="flex items-center gap-3 py-3 transition-colors hover:text-primary"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gold-soft text-gold">
                <Trophy className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.exercises?.name}</p>
                <p className="text-xs text-muted-foreground">
                  {RECORD_LABEL[r.record_type]} · {timeAgo(r.achieved_at)}
                </p>
              </div>
              <span className="stat-num text-sm font-semibold">
                {r.record_type === "max_reps"
                  ? `${r.value} reps`
                  : formatWeight(r.value, unit)}
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

function RecentWorkouts({
  sessions,
  unit,
}: {
  sessions: { id: string; name: string; started_at: string; duration_seconds: number | null; total_volume: number; total_sets: number }[];
  unit: "kg" | "lb";
}) {
  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Workout history</h2>
        <Link to="/history" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          View all <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="mt-4 divide-y divide-border">
        {sessions.map((s) => (
          <Link
            key={s.id}
            to="/history/$sessionId"
            params={{ sessionId: s.id }}
            className="flex items-center gap-3 py-3 transition-colors hover:text-primary"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-raised text-muted-foreground">
              <Layers className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{s.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatWorkoutDate(s.started_at)} · {formatDuration(s.duration_seconds)}
              </p>
            </div>
            <div className="text-right">
              <p className="stat-num text-sm font-semibold">{formatVolume(s.total_volume, unit)}</p>
              <p className="text-xs text-muted-foreground">{s.total_sets} sets</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
