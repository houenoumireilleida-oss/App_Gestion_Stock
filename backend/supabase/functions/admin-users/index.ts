import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.2";

type AppRole = "admin" | "responsable" | "vendeur";

type CreatePayload = {
  action: "create";
  email: string;
  display_name: string;
  roles: AppRole[];
};

type UserIdPayload = {
  action: "delete" | "reset-password";
  user_id: string;
};

type Payload = CreatePayload | UserIdPayload;

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

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim().length > 0) return error.message;

  try {
    const serialized = JSON.stringify(error);
    if (serialized && serialized !== "null" && serialized !== "undefined") return serialized;
  } catch {
    // Fall through to String(error).
  }

  const text = String(error);
  return text && text !== "[object Object]" ? text : fallback;
}

function isEmail(value: unknown): value is string {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isRole(value: unknown): value is AppRole {
  return value === "admin" || value === "responsable" || value === "vendeur";
}

function parsePayload(input: unknown): Payload {
  if (!input || typeof input !== "object") throw new Error("Requete invalide");
  const body = input as Record<string, unknown>;

  if (body.action === "create") {
    if (!isEmail(body.email)) throw new Error("Email invalide");
    if (typeof body.display_name !== "string" || body.display_name.trim().length === 0 || body.display_name.length > 100) {
      throw new Error("Nom affiche invalide");
    }
    if (!Array.isArray(body.roles) || body.roles.length === 0 || !body.roles.every(isRole)) {
      throw new Error("Role invalide");
    }
    return {
      action: "create",
      email: body.email.trim().toLowerCase(),
      display_name: body.display_name.trim(),
      roles: [...new Set(body.roles)],
    };
  }

  if (body.action === "delete" || body.action === "reset-password") {
    if (!isUuid(body.user_id)) throw new Error("Utilisateur invalide");
    return { action: body.action, user_id: body.user_id };
  }

  throw new Error("Action invalide");
}

function generateTemporaryPassword(length = 12) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, value => alphabet[value % alphabet.length]).join("");
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return fail("Methode non autorisee", 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return fail("Configuration Supabase manquante", 500);
  }

  const authorization = request.headers.get("Authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";
  if (!token) return fail("Non authentifie", 401);

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  const caller = authData.user;
  if (authError || !caller) return fail("Session invalide", 401);

  const { data: roles, error: rolesError } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", caller.id);

  if (rolesError) return fail(rolesError.message, 500);
  if (!roles?.some(row => row.role === "admin")) {
    return fail("Acces reserve aux administrateurs", 403);
  }

  let payload: Payload;
  try {
    payload = parsePayload(await request.json());
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Requete invalide", 400);
  }

  if (payload.action === "create") {
    const temporaryPassword = generateTemporaryPassword();
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: payload.email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: { display_name: payload.display_name },
    });

    if (createError || !created.user) return fail(createError?.message ?? "Creation echouee", 400);

    const newUserId = created.user.id;
    const { error: profileError } = await supabaseAdmin.from("user_profiles").upsert({
      user_id: newUserId,
      display_name: payload.display_name,
      email: payload.email,
    });
    if (profileError) return fail(profileError.message, 500);

    const { error: deleteRolesError } = await supabaseAdmin.from("user_roles").delete().eq("user_id", newUserId);
    if (deleteRolesError) return fail(deleteRolesError.message, 500);

    const roleRows = payload.roles.map(role => ({ user_id: newUserId, role }));
    const { error: insertRolesError } = await supabaseAdmin.from("user_roles").insert(roleRows);
    if (insertRolesError) return fail(insertRolesError.message, 500);

    return jsonResponse({ user_id: newUserId, email: payload.email, temporaryPassword });
  }

  if (payload.action === "delete") {
    if (payload.user_id === caller.id) {
      return fail("Vous ne pouvez pas supprimer votre propre compte", 400);
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(payload.user_id);
    if (error) {
      console.error("admin-users deleteUser failed", { user_id: payload.user_id, error });
      return fail(`Suppression echouee: ${errorMessage(error, "Erreur Supabase sans detail")}`, 400);
    }
    return jsonResponse({ ok: true });
  }

  const temporaryPassword = generateTemporaryPassword();
  const { data: updated, error } = await supabaseAdmin.auth.admin.updateUserById(payload.user_id, {
    password: temporaryPassword,
  });

  if (error || !updated.user) return fail(error?.message ?? "Reinitialisation echouee", 400);

  return jsonResponse({
    user_id: payload.user_id,
    email: updated.user.email ?? "",
    temporaryPassword,
  });
});
