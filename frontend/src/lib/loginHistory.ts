import { supabase } from "@/integrations/supabase/client";

export type LoginHistoryRow = {
  id: string;
  user_id: string | null;
  email: string;
  logged_in_at: string;
  ip_address: string | null;
  user_agent: string | null;
  success: boolean;
};

export async function fetchLoginHistory(
  page: number,
  pageSize: number,
): Promise<{ rows: LoginHistoryRow[]; count: number }> {
  const from = page * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await supabase
    .from("login_history")
    .select("*", { count: "exact" })
    .order("logged_in_at", { ascending: false })
    .range(from, to);
  if (error) throw error;
  return { rows: (data ?? []) as LoginHistoryRow[], count: count ?? 0 };
}

export async function recordLoginAttempt(email: string, success: boolean): Promise<void> {
  try {
    await supabase.functions.invoke("record-login-attempt", { body: { email, success } });
  } catch {
    // Best-effort logging only — never block the login flow on this.
  }
}
