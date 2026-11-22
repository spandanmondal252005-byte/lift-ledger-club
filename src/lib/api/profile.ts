import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesUpdate } from "@/integrations/supabase/types";
import type { Unit } from "@/lib/units";

export type Profile = Tables<"profiles">;

export const profileQuery = (userId: string) =>
  queryOptions({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      if (error) throw error;
      if (data) return data;
      // Safety net if the sign-up trigger had not created the row yet.
      const { data: created, error: insertError } = await supabase
        .from("profiles")
        .insert({ id: userId })
        .select("*")
        .single();
      if (insertError) throw insertError;
      return created;
    },
  });

export const subscriptionQuery = (userId: string) =>
  queryOptions({
    queryKey: ["subscription", userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("is_premium", { _user_id: userId });
      if (error) throw error;
      return { isPremium: Boolean(data) };
    },
  });

export function useProfile(userId: string) {
  return useQuery(profileQuery(userId));
}

export function useUnit(userId: string): Unit {
  const { data } = useProfile(userId);
  return (data?.unit as Unit | undefined) ?? "kg";
}

export async function updateProfile(userId: string, patch: TablesUpdate<"profiles">) {
  const { data, error } = await supabase.from("profiles").update(patch).eq("id", userId).select("*").single();
  if (error) {
    if (error.code === "23505") throw new Error("That username is already taken.");
    if (error.code === "23514") throw new Error("Usernames are 3–24 characters: lowercase letters, numbers and _.");
    throw error;
  }
  return data;
}
