import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function fail(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

function isEmail(value: unknown): value is string {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip");
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return fail("Methode non autorisee", 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return fail("Configuration Supabase manquante", 500);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return fail("Requete invalide", 400);
  }

  if (!isEmail(body.email)) return fail("Email invalide", 400);
  if (typeof body.success !== "boolean") return fail("Statut invalide", 400);

  const email = body.email.trim().toLowerCase();
  const success = body.success;
  const userAgent = request.headers.get("user-agent");
  const ipAddress = clientIp(request);

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  if (!success) {
    // Failed attempts are never inserted by the auth.users trigger (nothing changes
    // on auth.users when a login fails), so this is the only place they're recorded.
    const { error } = await supabaseAdmin.from("login_history").insert({
      user_id: null,
      email,
      success: false,
      ip_address: ipAddress,
      user_agent: userAgent,
    });
    if (error) return fail(error.message, 500);
    return jsonResponse({ ok: true });
  }

  const authorization = request.headers.get("Authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";
  const { data: authData } = token
    ? await supabaseAdmin.auth.getUser(token)
    : { data: { user: null } };
  const userId = authData.user?.id ?? null;

  if (userId) {
    // The on_auth_user_login trigger already inserted a row for this sign-in;
    // enrich it with ip/user-agent instead of inserting a duplicate.
    const { data: recent, error: recentError } = await supabaseAdmin
      .from("login_history")
      .select("id")
      .eq("user_id", userId)
      .eq("success", true)
      .is("ip_address", null)
      .order("logged_in_at", { ascending: false })
      .limit(1);

    if (!recentError && recent && recent.length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from("login_history")
        .update({ ip_address: ipAddress, user_agent: userAgent })
        .eq("id", recent[0].id);
      if (updateError) return fail(updateError.message, 500);
      return jsonResponse({ ok: true });
    }
  }

  // Fallback: trigger row not visible yet, or the caller's session couldn't be verified.
  const { error: insertError } = await supabaseAdmin.from("login_history").insert({
    user_id: userId,
    email,
    success: true,
    ip_address: ipAddress,
    user_agent: userAgent,
  });
  if (insertError) return fail(insertError.message, 500);
  return jsonResponse({ ok: true });
});
