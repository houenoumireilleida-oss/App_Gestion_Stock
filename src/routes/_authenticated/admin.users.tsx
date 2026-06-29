import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { createEmployee, deleteEmployee } from "@/lib/admin.functions";
import { useMyRoles, hasAny, type AppRole } from "@/lib/roles";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ShieldAlert, UserPlus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({ meta: [{ title: "Employés — StockFlow" }] }),
  component: EmployeesPage,
});

type Profile = { user_id: string; display_name: string };
type RoleRow = { user_id: string; role: AppRole };

async function fetchProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase.from("user_profiles").select("user_id, display_name").order("display_name");
  if (error) throw error;
  return data as Profile[];
}
async function fetchAllRoles(): Promise<RoleRow[]> {
  const { data, error } = await supabase.from("user_roles").select("user_id, role");
  if (error) throw error;
  return data as RoleRow[];
}

const ALL_ROLES: AppRole[] = ["admin", "responsable", "vendeur"];

function EmployeesPage() {
  const { data: myRoles } = useMyRoles();
  const qc = useQueryClient();
  const profiles = useQuery({ queryKey: ["profiles"], queryFn: fetchProfiles });
  const rolesQ = useQuery({ queryKey: ["all_roles"], queryFn: fetchAllRoles });
  const create = useServerFn(createEmployee);
  const remove = useServerFn(deleteEmployee);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", display_name: "", roles: ["vendeur"] as AppRole[] });
  const [submitting, setSubmitting] = useState(false);

  if (!hasAny(myRoles, "admin")) {
    return (
      <div className="p-10 max-w-xl">
        <Card className="p-8 text-center">
          <ShieldAlert className="mx-auto size-10 text-warning mb-3" />
          <h2 className="font-semibold">Accès réservé</h2>
          <p className="text-sm text-muted-foreground mt-1">Seuls les administrateurs peuvent gérer les comptes employés.</p>
        </Card>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await create({ data: form });
      toast.success("Compte créé");
      setOpen(false);
      setForm({ email: "", password: "", display_name: "", roles: ["vendeur"] });
      qc.invalidateQueries({ queryKey: ["profiles"] });
      qc.invalidateQueries({ queryKey: ["all_roles"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally { setSubmitting(false); }
  }

  async function onDelete(userId: string, name: string) {
    if (!confirm(`Supprimer le compte de ${name} ?`)) return;
    try {
      await remove({ data: { user_id: userId } });
      toast.success("Compte supprimé");
      qc.invalidateQueries({ queryKey: ["profiles"] });
      qc.invalidateQueries({ queryKey: ["all_roles"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  }

  function toggleRole(r: AppRole) {
    setForm(f => ({
      ...f,
      roles: f.roles.includes(r) ? f.roles.filter(x => x !== r) : [...f.roles, r],
    }));
  }

  const rolesByUser = new Map<string, AppRole[]>();
  for (const r of rolesQ.data ?? []) {
    if (!rolesByUser.has(r.user_id)) rolesByUser.set(r.user_id, []);
    rolesByUser.get(r.user_id)!.push(r.role);
  }

  return (
    <div className="p-6 lg:p-10 space-y-6 max-w-5xl">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Employés</h1>
          <p className="text-muted-foreground mt-1">Créez, gérez et supprimez les comptes de votre équipe.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><UserPlus className="size-4 mr-2" />Nouvel employé</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Créer un compte employé</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label>Nom affiché</Label>
                <Input required value={form.display_name}
                  onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" required value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Mot de passe provisoire</Label>
                <Input type="text" minLength={8} required value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="8 caractères minimum" />
                <p className="text-xs text-muted-foreground">Communiquez-le à l'employé pour sa première connexion.</p>
              </div>
              <div className="space-y-2">
                <Label>Rôles</Label>
                <div className="flex gap-4">
                  {ALL_ROLES.map(r => (
                    <label key={r} className="flex items-center gap-2 text-sm capitalize">
                      <Checkbox checked={form.roles.includes(r)} onCheckedChange={() => toggleRole(r)} />
                      {r}
                    </label>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
                <Button type="submit" disabled={submitting || form.roles.length === 0}>
                  {submitting ? "Création…" : "Créer le compte"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-4 py-2">Nom</th>
              <th className="px-4 py-2">Rôles</th>
              <th className="px-4 py-2 w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(profiles.data ?? []).map(p => (
              <tr key={p.user_id} className="hover:bg-muted/30">
                <td className="px-4 py-2 font-medium">{p.display_name}</td>
                <td className="px-4 py-2 text-muted-foreground capitalize">
                  {(rolesByUser.get(p.user_id) ?? []).join(" · ") || "—"}
                </td>
                <td className="px-4 py-2 text-right">
                  <Button variant="ghost" size="sm" onClick={() => onDelete(p.user_id, p.display_name)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
            {(profiles.data ?? []).length === 0 && (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">Aucun employé.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
