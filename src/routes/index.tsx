import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, ArrowRight, Check, Flame, LineChart, ListChecks, Timer, Trophy } from "lucide-react";
import { Logo } from "@/components/app/logo";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "IronLog — The workout tracker for serious lifters" },
      {
        name: "description",
        content:
          "Log sets and reps in seconds, auto-detect personal records and see your strength progression with beautiful analytics. Free to start.",
      },
      { property: "og:title", content: "IronLog — The workout tracker for serious lifters" },
      {
        property: "og:description",
        content: "Log every set, auto-detect PRs and watch your estimated 1RM climb. Free to start.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { session, ready } = useSession();
  const signedIn = ready && !!session;

  return (
    <div className="min-h-screen overflow-x-hidden">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <Logo />
          <nav className="flex items-center gap-2">
            {signedIn ? (
              <Button asChild variant="hero" size="sm">
                <Link to="/dashboard">Open app</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/auth">Sign in</Link>
                </Button>
                <Button asChild variant="hero" size="sm">
                  <Link to="/auth" search={{ mode: "signup" }}>
                    Get started
                  </Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      <section className="relative">
        <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" />
        <div className="relative mx-auto grid max-w-6xl gap-14 px-5 pb-20 pt-14 sm:pt-20 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:pb-28">
          <div className="animate-rise">
            <p className="eyebrow inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Built for progressive overload
            </p>
            <h1 className="mt-6 font-display text-[2.75rem] font-extrabold leading-[0.92] sm:text-6xl lg:text-7xl">
              Lift heavier.
              <br />
              <span className="text-primary">Know exactly why.</span>
            </h1>
            <p className="mt-6 max-w-lg text-base text-muted-foreground sm:text-lg">
              IronLog is the training log for people who take the gym seriously. Record every set in seconds, see what
              you lifted last time, and let your personal records find you.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild variant="hero" size="xl">
                {signedIn ? (
                  <Link to="/dashboard">
                    Go to dashboard <ArrowRight />
                  </Link>
                ) : (
                  <Link to="/auth" search={{ mode: "signup" }}>
                    Start training free <ArrowRight />
                  </Link>
                )}
              </Button>
              {!signedIn && (
                <Button asChild variant="subtle" size="xl">
                  <Link to="/auth">I have an account</Link>
                </Button>
              )}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">Free forever plan · No card required</p>
          </div>

          <HeroPreview />
        </div>
      </section>

      <section className="border-t border-border bg-surface/50">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <p className="eyebrow">Everything in one log</p>
          <h2 className="mt-3 max-w-xl font-display text-3xl font-bold sm:text-4xl">
            The tools you need between sets. Nothing you don't.
          </h2>
          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="bg-card p-6 transition-colors hover:bg-surface-raised">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary-soft text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <h3 className="mt-5 font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="text-center">
            <p className="eyebrow">Plans</p>
            <h2 className="mt-3 font-display text-3xl font-bold sm:text-4xl">Start free. Go Premium when you're ready.</h2>
          </div>
          <div className="mx-auto mt-12 grid max-w-4xl gap-5 md:grid-cols-2">
            <PlanCard
              name="Free"
              price="₹0"
              note="forever"
              items={["Unlimited workout logging", "Full exercise library", "Workout history", "Personal records", "Core analytics", "Up to 3 routines"]}
              cta={signedIn ? "Open app" : "Create free account"}
              to={signedIn ? "/dashboard" : "/auth"}
            />
            <PlanCard
              featured
              name="Premium"
              price="₹299"
              note="per month · or ₹2,499/year"
              items={["Everything in Free", "Advanced analytics & long-term insights", "Unlimited routines", "Detailed muscle group statistics", "Advanced strength progression", "AI workout insights (coming soon)"]}
              cta={signedIn ? "Open app" : "Start with Free"}
              to={signedIn ? "/dashboard" : "/auth"}
            />
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-muted-foreground sm:flex-row">
          <Logo />
          <p>© {new Date().getFullYear()} IronLog. Train hard, log harder.</p>
        </div>
      </footer>
    </div>
  );
}

const FEATURES = [
  { icon: ListChecks, title: "Set-by-set logging", body: "Weight, reps and completion for every set, with your previous numbers right beside them." },
  { icon: Timer, title: "Built-in rest timer", body: "Starts automatically when you tick a set off. Adjust on the fly, never lose count." },
  { icon: Trophy, title: "Automatic PRs", body: "Heaviest weight, most reps, estimated 1RM and best volume — detected the moment you finish." },
  { icon: LineChart, title: "Strength progression", body: "Per-exercise graphs show whether you're actually getting stronger, session after session." },
  { icon: Activity, title: "Training analytics", body: "Weekly and monthly volume, muscle group balance and consistency at a glance." },
  { icon: Flame, title: "Never lose a workout", body: "Every tap is saved as you go, so closing the app mid-session costs you nothing." },
];

function PlanCard({
  name,
  price,
  note,
  items,
  cta,
  to,
  featured = false,
}: {
  name: string;
  price: string;
  note: string;
  items: string[];
  cta: string;
  to: "/dashboard" | "/auth";
  featured?: boolean;
}) {
  return (
    <div className={featured ? "panel relative p-7 shadow-glow" : "panel p-7"}>
      {featured && (
        <span className="absolute -top-3 right-6 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
          Most popular
        </span>
      )}
      <p className="eyebrow">{name}</p>
      <p className="mt-4 flex items-baseline gap-2">
        <span className="stat-num text-4xl font-semibold">{price}</span>
        <span className="text-sm text-muted-foreground">{note}</span>
      </p>
      <ul className="mt-6 space-y-3 text-sm">
        {items.map((i) => (
          <li key={i} className="flex items-start gap-2.5">
            <Check className={featured ? "mt-0.5 h-4 w-4 text-primary" : "mt-0.5 h-4 w-4 text-muted-foreground"} />
            {i}
          </li>
        ))}
      </ul>
      <Button asChild variant={featured ? "hero" : "subtle"} className="mt-8 w-full" size="lg">
        <Link to={to}>{cta}</Link>
      </Button>
    </div>
  );
}

/** Illustrative product preview for the landing page (static marketing visual). */
function HeroPreview() {
  const sets = [
    { n: 1, prev: "80 × 8", w: "82.5", r: "8", done: true },
    { n: 2, prev: "80 × 8", w: "82.5", r: "8", done: true },
    { n: 3, prev: "80 × 7", w: "82.5", r: "7", done: false },
  ];
  const bars = [38, 44, 41, 52, 49, 58, 63, 60, 71, 76, 74, 84];
  return (
    <div className="relative animate-rise [animation-delay:120ms]">
      <div className="panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div>
            <p className="text-sm font-semibold">Push Day</p>
            <p className="stat-num text-xs text-muted-foreground">00:42:18</p>
          </div>
          <span className="rounded-md bg-success-soft px-2 py-1 text-[11px] font-medium text-success">Saved</span>
        </div>
        <div className="p-5">
          <p className="font-semibold text-primary">Barbell Bench Press</p>
          <div className="mt-3 grid grid-cols-[2rem_1fr_1fr_1fr_2rem] gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
            <span>Set</span>
            <span>Previous</span>
            <span>kg</span>
            <span>Reps</span>
            <span />
          </div>
          {sets.map((s) => (
            <div
              key={s.n}
              className={
                "mt-2 grid grid-cols-[2rem_1fr_1fr_1fr_2rem] items-center gap-2 rounded-lg px-1 py-1.5 " +
                (s.done ? "bg-success-soft" : "")
              }
            >
              <span className="stat-num text-sm text-muted-foreground">{s.n}</span>
              <span className="stat-num text-sm text-muted-foreground">{s.prev}</span>
              <span className="stat-num rounded-md bg-surface-raised px-2 py-1 text-sm">{s.w}</span>
              <span className="stat-num rounded-md bg-surface-raised px-2 py-1 text-sm">{s.r}</span>
              <span
                className={
                  "grid h-6 w-6 place-items-center rounded-md " +
                  (s.done ? "bg-success text-primary-foreground" : "border border-border-strong")
                }
              >
                {s.done && <Check className="h-3.5 w-3.5" />}
              </span>
            </div>
          ))}
          <div className="mt-5 flex items-center justify-between rounded-xl border border-primary/30 bg-primary-soft px-4 py-3">
            <span className="flex items-center gap-2 text-sm">
              <Timer className="h-4 w-4 text-primary" /> Rest
            </span>
            <span className="stat-num text-lg font-semibold text-primary">1:24</span>
          </div>
        </div>
      </div>
      <div className="panel absolute -bottom-10 -left-4 hidden w-60 p-4 sm:block lg:-left-10">
        <div className="flex items-center justify-between">
          <p className="eyebrow">Est. 1RM</p>
          <span className="text-xs font-medium text-success">+12.4%</span>
        </div>
        <p className="stat-num mt-1 text-2xl font-semibold">104.5 kg</p>
        <div className="mt-3 flex h-12 items-end gap-1">
          {bars.map((h, i) => (
            <span
              key={i}
              className={i === bars.length - 1 ? "flex-1 rounded-sm bg-primary" : "flex-1 rounded-sm bg-surface-raised"}
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </div>
      <div className="panel absolute -right-3 -top-6 hidden items-center gap-3 px-4 py-3 sm:flex">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-gold-soft text-gold">
          <Trophy className="h-4 w-4" />
        </span>
        <div>
          <p className="text-xs text-muted-foreground">New PR</p>
          <p className="text-sm font-semibold">Squat · 140 kg × 3</p>
        </div>
      </div>
    </div>
  );
}
