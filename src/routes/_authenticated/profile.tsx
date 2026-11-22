import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { LogOut } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/hooks/use-user";
import { updateProfile, useProfile } from "@/lib/api/profile";
import { errorMessage } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profile — IronLog" },
      { name: "description", content: "Manage your IronLog profile and preferences." },
      { property: "og:title", content: "Profile — IronLog" },
      { property: "og:description", content: "Manage your IronLog profile." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const user = useUser();
  const { data: profile } = useProfile(user.id);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [unit, setUnit] = useState<"kg" | "lb">("kg");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setName(profile.display_name ?? "");
    setUsername(profile.username ?? "");
    setUnit(profile.unit === "lb" ? "lb" : "kg");
  }, [profile]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await updateProfile(user.id, { display_name: name.trim() || null, username: username.trim().toLowerCase() || null, unit });
      await qc.invalidateQueries({ queryKey: ["profile", user.id] });
      toast.success("Profile saved");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="space-y-6 animate-rise">
      <PageHeader eyebrow="Account" title="Profile" description={user.email} />
      <form onSubmit={onSave} className="panel max-w-lg space-y-4 p-5">
        <div className="space-y-1.5"><Label htmlFor="n">Display name</Label><Input id="n" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="u">Username</Label><Input id="u" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="iron_arjun" /></div>
        <div className="space-y-1.5">
          <Label>Weight unit</Label>
          <div className="flex gap-2">
            {(["kg", "lb"] as const).map((u) => (
              <Button key={u} type="button" variant={unit === u ? "hero" : "subtle"} size="sm" onClick={() => setUnit(u)}>{u}</Button>
            ))}
          </div>
        </div>
        <Button type="submit" variant="hero" disabled={busy}>Save changes</Button>
      </form>
      <Button variant="ghost" className="text-destructive" onClick={signOut}><LogOut /> Sign out</Button>
    </div>
  );
}
