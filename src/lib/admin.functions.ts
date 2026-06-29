import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const createEmployeeSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "8 caractères minimum"),
  display_name: z.string().min(1).max(100),
  roles: z.array(z.enum(["admin", "responsable", "vendeur"])).min(1),
});

export const createEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createEmployeeSchema.parse(d))
  .handler(async ({ data, context }) => {
    // Authorize: caller must be admin
    const { data: roles, error: rolesErr } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (rolesErr) throw new Error(rolesErr.message);
    if (!roles?.some(r => r.role === "admin")) {
      throw new Error("Accès réservé aux administrateurs");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { display_name: data.display_name },
    });
    if (createErr || !created.user) throw new Error(createErr?.message ?? "Création échouée");

    const newUserId = created.user.id;

    // Ensure profile (trigger should do it, but be defensive)
    await supabaseAdmin.from("user_profiles").upsert({
      user_id: newUserId,
      display_name: data.display_name,
    });

    // Remove default 'vendeur' added by trigger, then set requested roles
    await supabaseAdmin.from("user_roles").delete().eq("user_id", newUserId);
    const rows = data.roles.map(r => ({ user_id: newUserId, role: r }));
    const { error: rolesInsErr } = await supabaseAdmin.from("user_roles").insert(rows);
    if (rolesInsErr) throw new Error(rolesInsErr.message);

    return { user_id: newUserId, email: data.email };
  });

const deleteEmployeeSchema = z.object({ user_id: z.string().uuid() });

export const deleteEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => deleteEmployeeSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId);
    if (!roles?.some(r => r.role === "admin")) throw new Error("Accès réservé aux administrateurs");
    if (data.user_id === context.userId) throw new Error("Vous ne pouvez pas supprimer votre propre compte");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
