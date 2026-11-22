import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Dumbbell, History, LayoutDashboard, Library, Play, Trophy, User } from "lucide-react";
import { Logo, LogoMark } from "@/components/app/logo";
import { Button } from "@/components/ui/button";
import { useUser } from "@/hooks/use-user";
import { useProfile } from "@/lib/api/profile";
import { activeSessionQuery } from "@/lib/api/workouts";
import { useStartWorkout } from "@/hooks/use-start-workout";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/history", label: "History", icon: History },
  { to: "/exercises", label: "Exercises", icon: Library },
  { to: "/records", label: "Records", icon: Trophy },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function AppShell() {
  const { pathname } = useLocation();
  const immersive = pathname.startsWith("/workout/");

  if (immersive) {
    return (
      <div className="min-h-screen bg-background">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background lg:pl-64">
      <Sidebar />
      <MobileTopBar />
      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-5 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">
        <ActiveWorkoutBanner />
        <Outlet />
      </main>
      <MobileTabBar />
    </div>
  );
}

function StartButton({ className, compact = false }: { className?: string; compact?: boolean }) {
  const start = useStartWorkout();
  const { data: active } = useQuery(activeSessionQuery());
  return (
    <Button
      variant="hero"
      size={compact ? "default" : "lg"}
      className={className}
      disabled={start.isPending}
      onClick={() => start.mutate(undefined)}
    >
      <Play className="fill-current" />
      {active ? "Resume workout" : "Start workout"}
    </Button>
  );
}

function Sidebar() {
  const user = useUser();
  const { data: profile } = useProfile(user.id);
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar px-4 py-6 lg:flex">
      <Link to="/dashboard" className="px-2">
        <Logo />
      </Link>
      <StartButton className="mt-8 w-full" />
      <nav className="mt-6 flex flex-col gap-1">
        {NAV.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
            activeProps={{ className: "bg-sidebar-accent !text-foreground" }}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto rounded-xl border border-border bg-surface p-3">
        <div className="flex items-center gap-3">
          <Avatar name={profile?.display_name ?? user.email ?? "?"} url={profile?.avatar_url ?? null} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{profile?.display_name ?? "Athlete"}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

export function Avatar({ name, url, size = "md" }: { name: string; url: string | null; size?: "sm" | "md" | "lg" }) {
  const initials = name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  const dim = size === "lg" ? "h-16 w-16 text-xl" : size === "sm" ? "h-8 w-8 text-xs" : "h-9 w-9 text-sm";
  return url ? (
    <img src={url} alt="" referrerPolicy="no-referrer" className={cn("shrink-0 rounded-full object-cover", dim)} />
  ) : (
    <span className={cn("grid shrink-0 place-items-center rounded-full bg-primary-soft font-semibold text-primary", dim)}>
      {initials || "?"}
    </span>
  );
}

function MobileTopBar() {
  const user = useUser();
  const { data: profile } = useProfile(user.id);
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/85 px-4 py-3 backdrop-blur-xl lg:hidden">
      <Link to="/dashboard">
        <Logo />
      </Link>
      <Link to="/profile" aria-label="Profile">
        <Avatar size="sm" name={profile?.display_name ?? user.email ?? "?"} url={profile?.avatar_url ?? null} />
      </Link>
    </header>
  );
}

function MobileTabBar() {
  const start = useStartWorkout();
  const { data: active } = useQuery(activeSessionQuery());
  const items = NAV.filter((n) => n.to !== "/profile");
  const left = items.slice(0, 2);
  const right = items.slice(2);
  const tab = ({ to, label, icon: Icon }: (typeof NAV)[number]) => (
    <Link
      key={to}
      to={to}
      className="flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium text-muted-foreground transition-colors"
      activeProps={{ className: "!text-foreground" }}
    >
      <Icon className="h-5 w-5" />
      {label}
    </Link>
  );
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 backdrop-blur-xl lg:hidden">
      <div className="mx-auto flex max-w-md items-end px-2">
        {left.map(tab)}
        <div className="flex flex-1 justify-center">
          <button
            type="button"
            onClick={() => start.mutate(undefined)}
            disabled={start.isPending}
            aria-label={active ? "Resume workout" : "Start workout"}
            className={cn(
              "-mt-5 grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-glow transition-transform active:scale-95",
              active && "animate-pulse-ring",
            )}
          >
            {active ? <Dumbbell className="h-6 w-6" /> : <Play className="h-6 w-6 fill-current" />}
          </button>
        </div>
        {right.map(tab)}
      </div>
    </nav>
  );
}

function ActiveWorkoutBanner() {
  const { data: active } = useQuery(activeSessionQuery());
  if (!active) return null;
  return (
    <Link
      to="/workout/$sessionId"
      params={{ sessionId: active.id }}
      className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary-soft px-4 py-3 text-sm transition-colors hover:border-primary/60"
    >
      <span className="flex items-center gap-3">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
        </span>
        <span>
          <span className="font-medium">{active.name}</span>
          <span className="text-muted-foreground"> is in progress</span>
        </span>
      </span>
      <span className="font-medium text-primary">Resume →</span>
    </Link>
  );
}

export { StartButton, LogoMark };
