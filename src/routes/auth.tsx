import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/app/logo";
import { GoogleIcon } from "@/components/app/google-icon";
import { errorMessage } from "@/lib/format";

type Mode = "signin" | "signup" | "forgot";
type AuthSearch = { redirect?: string; mode?: Mode };

function safeRedirect(target: string | undefined): string {
  if (!target) return "/dashboard";
  try {
    const url = new URL(target, window.location.origin);
    if (url.origin !== window.location.origin) return "/dashboard";
    if (url.pathname.startsWith("/auth")) return "/dashboard";
    return url.pathname + url.search;
  } catch {
    return "/dashboard";
  }
}

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): AuthSearch => {
    const out: AuthSearch = {};
    const redirect = search["redirect"];
    const mode = search["mode"];
    if (typeof redirect === "string") out.redirect = redirect;
    if (mode === "signin" || mode === "signup" || mode === "forgot") out.mode = mode;
    return out;
  },
  head: () => ({
    meta: [
      { title: "Sign in — IronLog" },
      { name: "description", content: "Sign in or create your free IronLog account to start tracking your training." },
      { property: "og:title", content: "Sign in — IronLog" },
      { property: "og:description", content: "Sign in or create your free IronLog account." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>(search.mode ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<null | "confirm" | "reset">(null);

  const goNext = () => navigate({ href: safeRedirect(search.redirect), replace: true });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) goNext();
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) goNext();
    });
    return () => data.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email) {
      toast.error("Enter your email");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === "signup") {
        if (password.length < 8) throw new Error("Use at least 8 characters for your password.");
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/dashboard", data: { display_name: name || undefined } },
        });
        if (error) throw error;
        if (!data.session) setSent("confirm");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setSent("reset");
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (result.error) {
      toast.error(errorMessage(result.error));
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    goNext();
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden border-r border-border bg-surface lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="bg-grid absolute inset-0 opacity-60" />
        <Link to="/" className="relative">
          <Logo />
        </Link>
        <div className="relative max-w-md">
          <p className="eyebrow">Progressive overload, measured</p>
          <h2 className="mt-4 font-display text-5xl font-bold leading-[0.95]">
            Every set counts.
            <br />
            <span className="text-primary">Every PR remembered.</span>
          </h2>
          <p className="mt-5 text-muted-foreground">
            Log your sessions in seconds, see what you lifted last time, and watch your estimated one-rep max climb.
          </p>
        </div>
        <p className="relative text-xs text-muted-foreground">© {new Date().getFullYear()} IronLog</p>
      </aside>

      <main className="flex flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between lg:justify-end">
          <Link to="/" className="lg:hidden">
            <Logo />
          </Link>
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10 animate-rise">
          {sent ? (
            <div className="text-center">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-primary-soft text-primary">
                <MailCheck className="h-6 w-6" />
              </span>
              <h1 className="mt-5 font-display text-2xl font-bold">Check your inbox</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {sent === "confirm"
                  ? `We sent a confirmation link to ${email}. Open it to activate your account.`
                  : `If an account exists for ${email}, a password reset link is on its way.`}
              </p>
              <Button
                variant="subtle"
                className="mt-6"
                onClick={() => {
                  setSent(null);
                  setMode("signin");
                }}
              >
                Back to sign in
              </Button>
            </div>
          ) : (
            <>
              <h1 className="font-display text-3xl font-bold">
                {mode === "signin" ? "Welcome back" : mode === "signup" ? "Create your account" : "Reset password"}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {mode === "signin"
                  ? "Sign in to continue your training log."
                  : mode === "signup"
                    ? "Free forever. Upgrade only if you want more."
                    : "Enter your email and we'll send you a reset link."}
              </p>

              {mode !== "forgot" && (
                <>
                  <Button type="button" variant="google" className="mt-8 h-11 w-full" onClick={onGoogle} disabled={busy}>
                    <GoogleIcon />
                    Continue with Google
                  </Button>
                  <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="h-px flex-1 bg-border" /> or with email <span className="h-px flex-1 bg-border" />
                  </div>
                </>
              )}

              <form onSubmit={onSubmit} className={mode === "forgot" ? "mt-8 space-y-4" : "space-y-4"}>
                {mode === "signup" && (
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Arjun Mehta" autoComplete="name" className="h-11" />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" className="h-11" />
                </div>
                {mode !== "forgot" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Password</Label>
                      {mode === "signin" && (
                        <button type="button" onClick={() => setMode("forgot")} className="text-xs text-muted-foreground hover:text-primary">
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <Input
                      id="password"
                      type="password"
                      required
                      minLength={mode === "signup" ? 8 : undefined}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      className="h-11"
                    />
                  </div>
                )}
                <Button type="submit" variant="hero" className="h-11 w-full" disabled={busy}>
                  {busy && <Loader2 className="animate-spin" />}
                  {mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                {mode === "signin" ? (
                  <>
                    New to IronLog?{" "}
                    <button type="button" onClick={() => setMode("signup")} className="font-medium text-primary hover:underline">
                      Create an account
                    </button>
                  </>
                ) : (
                  <>
                    {mode === "signup" ? "Already have an account? " : "Remembered it? "}
                    <button type="button" onClick={() => setMode("signin")} className="font-medium text-primary hover:underline">
                      Sign in
                    </button>
                  </>
                )}
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
