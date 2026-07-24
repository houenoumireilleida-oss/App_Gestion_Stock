import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyRoles, hasAny, type AppRole } from "@/lib/roles";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/roles")({
  head: () => ({ meta: [{ title: "Rôles — StockFlow" }] }),
  component: RolesPage,
});

type Profile = { user_id: string; display_name: string };
type Row = { user_id: string; role: AppRole };

async function fetchProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase.from("user_profiles").select("user_id, display_name").order("display_name");
  if (error) throw error;
  return data as Profile[];
}

async function fetchAllRoles(): Promise<Row[]> {
  const { data, error } = await supabase.from("user_roles").select("user_id, role");
  if (error) throw error;
  return data as Row[];
}

const ALL_ROLES: AppRole[] = ["admin", "responsable", "vendeur"];

function RolesPage() {
  const { data: myRoles } = useMyRoles();
  const qc = useQueryClient();
  const profiles = useQuery({ queryKey: ["profiles"], queryFn: fetchProfiles });
  const rolesQ = useQuery({ queryKey: ["all_roles"], queryFn: fetchAllRoles });

  if (!hasAny(myRoles, "admin")) {
    return (
      <div className="p-10 max-w-xl">
        <Card className="p-8 text-center">
          <ShieldAlert className="mx-auto size-10 text-warning mb-3" />
          <h2 className="font-semibold">Accès réservé</h2>
          <p className="text-sm text-muted-foreground mt-1">Seuls les administrateurs peuvent gérer les rôles.</p>
        </Card>
      </div>
    );
  }

  async function toggleRole(userId: string, role: AppRole, currently: boolean) {
    if (currently) {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) { toast.error(error.message); return; }
    }
    qc.invalidateQueries({ queryKey: ["all_roles"] });
  }

  const rolesByUser = new Map<string, Set<AppRole>>();
  for (const r of rolesQ.data ?? []) {
    if (!rolesByUser.has(r.user_id)) rolesByUser.set(r.user_id, new Set());
    rolesByUser.get(r.user_id)!.add(r.role);
  }

  return (
    <div className="p-6 lg:p-10 space-y-6 max-w-4xl">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Rôles & permissions</h1>
        <p className="text-muted-foreground mt-1">Accordez les permissions par utilisateur.</p>
      </header>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr><th className="px-4 py-2">Utilisateur</th>{ALL_ROLES.map(r => <th key={r} className="px-4 py-2 text-center capitalize">{r}</th>)}</tr>
          </thead>
          <tbody className="divide-y">
            {(profiles.data ?? []).map(p => {
              const set = rolesByUser.get(p.user_id) ?? new Set();
              return (
                <tr key={p.user_id}>
                  <td className="px-4 py-2 font-medium">{p.display_name}</td>
                  {ALL_ROLES.map(r => (
                    <td key={r} className="px-4 py-2 text-center">
                      <Checkbox checked={set.has(r)} onCheckedChange={() => toggleRole(p.user_id, r, set.has(r))} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </Card>
    </div>
  );
}
