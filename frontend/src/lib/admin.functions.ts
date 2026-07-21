import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const createEmployeeSchema = z.object({
  email: z.string().email(),
  display_name: z.string().min(1).max(100),
  roles: z.array(z.enum(["admin", "responsable", "vendeur"])).min(1),
});

const deleteEmployeeSchema = z.object({ user_id: z.string().uuid() });

type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
type DeleteEmployeeInput = z.infer<typeof deleteEmployeeSchema>;
type TemporaryCredentials = { user_id: string; email: string; temporaryPassword: string };

async function invokeAdminUsers<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>("admin-users", { body });
  if (error) {
    const context = "context" in error ? error.context : undefined;
    if (context instanceof Response) {
      const payload = await context.json().catch(() => null);
      if (payload && typeof payload.error === "string") throw new Error(payload.error);
    }
    throw new Error(error.message);
  }
  return data as T;
}

export async function createEmployee(data: CreateEmployeeInput): Promise<TemporaryCredentials> {
  return invokeAdminUsers<TemporaryCredentials>({
    action: "create",
    ...createEmployeeSchema.parse(data),
  });
}

export async function deleteEmployee(data: DeleteEmployeeInput): Promise<{ ok: true }> {
  return invokeAdminUsers<{ ok: true }>({
    action: "delete",
    ...deleteEmployeeSchema.parse(data),
  });
}

export async function resetEmployeePassword(
  data: DeleteEmployeeInput,
): Promise<TemporaryCredentials> {
  return invokeAdminUsers<TemporaryCredentials>({
    action: "reset-password",
    ...deleteEmployeeSchema.parse(data),
  });
}
