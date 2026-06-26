import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "responsable" | "vendeur";

export async function fetchMyRoles(): Promise<AppRole[]> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return [];
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", u.user.id);
  if (error) return [];
  return (data ?? []).map((r: { role: AppRole }) => r.role);
}

export function useMyRoles() {
  return useQuery({ queryKey: ["my-roles"], queryFn: fetchMyRoles, staleTime: 60_000 });
}

export function hasAny(roles: AppRole[] | undefined, ...wanted: AppRole[]): boolean {
  if (!roles) return false;
  return roles.some(r => wanted.includes(r));
}
