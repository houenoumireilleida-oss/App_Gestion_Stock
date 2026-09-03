import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { createEmployee, deleteEmployee, resetEmployeePassword } from "@/lib/admin.functions";
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
import { Copy, KeyRound, ShieldAlert, UserPlus, Trash2, Shield, ScrollText, History } from "lucide-react";
import { SectionHero } from "@/components/SectionHero";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({ meta: [{ title: "Employés — StockFlow" }] }),
  component: EmployeesPage,
});

const ADMIN_LINKS = [
  { to: "/admin/users", label: "Employés", icon: UserPlus },
  { to: "/admin/roles", label: "Rôles", icon: Shield },
  { to: "/audit", label: "Journal d'audit", icon: ScrollText },
  { to: "/admin/login-history", label: "Historique de connexion", icon: History },
];

type Profile = { user_id: string; display_name: string };
type RoleRow = { user_id: string; role: AppRole };
type TemporaryCredentials = { email: string; password: string };

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

  const [open, setOpen] = useState(false);
  const [credentials, setCredentials] = useState<TemporaryCredentials | null>(null);
  const [form, setForm] = useState({ email: "", display_name: "", roles: ["vendeur"] as AppRole[] });
  const [submitting, setSubmitting] = useState(false);
  const [resettingId, setResettingId] = useState<string | null>(null);

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
      const created = await createEmployee(form);
      toast.success("Compte créé");
      setOpen(false);
      setCredentials({ email: created.email, password: created.temporaryPassword });
      setForm({ email: "", display_name: "", roles: ["vendeur"] });
      qc.invalidateQueries({ queryKey: ["profiles"] });
      qc.invalidateQueries({ queryKey: ["all_roles"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally { setSubmitting(false); }
  }

  async function onResetPassword(userId: string, name: string) {
    if (!confirm(`Réinitialiser le mot de passe de ${name} ? L'ancien mot de passe ne fonctionnera plus.`)) return;
    setResettingId(userId);
    try {
      const reset = await resetEmployeePassword({ user_id: userId });
      setCredentials({ email: reset.email, password: reset.temporaryPassword });
      toast.success("Mot de passe réinitialisé");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setResettingId(null);
    }
  }

  async function onDelete(userId: string, name: string) {
    if (!confirm(`Supprimer le compte de ${name} ?`)) return;
    try {
      await deleteEmployee({ user_id: userId });
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
    <div>
      <SectionHero
        eyebrow="Admin"
        title="Employés, rôles, journal d'audit et connexions"
        links={ADMIN_LINKS}
      />
      <div className="p-6 lg:p-10 space-y-6 max-w-5xl">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Employés</h1>
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
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="table-head-dark text-left">
            <tr>
              <th className="px-4 py-2">Nom</th>
              <th className="px-4 py-2">Rôles</th>
              <th className="px-4 py-2 w-28"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(profiles.data ?? []).map(p => (
              <tr key={p.user_id} className="hover:bg-muted/30">
                <td className="px-4 py-2 font-medium">{p.display_name}</td>
                <td className="px-4 py-2 text-muted-foreground capitalize">
                  {(rolesByUser.get(p.user_id) ?? []).join(" · ") || "—"}
                </td>
                <td className="px-4 py-2">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={resettingId === p.user_id}
                      title="Réinitialiser le mot de passe"
                      onClick={() => onResetPassword(p.user_id, p.display_name)}
                    >
                      <KeyRound className="size-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => onDelete(p.user_id, p.display_name)} title="Supprimer le compte">
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {(profiles.data ?? []).length === 0 && (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">Aucun employé.</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </Card>
      <CredentialsDialog credentials={credentials} onOpenChange={nextOpen => { if (!nextOpen) setCredentials(null); }} />
      </div>
    </div>
  );
}

function CredentialsDialog({
  credentials,
  onOpenChange,
}: {
  credentials: TemporaryCredentials | null;
  onOpenChange: (open: boolean) => void;
}) {
  async function copyCredentials() {
    if (!credentials) return;
    try {
      await navigator.clipboard.writeText(`Email: ${credentials.email}\nMot de passe temporaire: ${credentials.password}`);
      toast.success("Identifiants copiés");
    } catch {
      toast.error("Copie impossible depuis ce navigateur");
    }
  }

  return (
    <Dialog open={!!credentials} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Identifiants temporaires</DialogTitle>
        </DialogHeader>
        {credentials && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Ces identifiants ne seront plus affichés après fermeture de cette fenêtre — transmettez-les à l'employé maintenant.
            </p>
            <div className="rounded-md border bg-muted/30 p-4 space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="font-mono text-sm break-all">{credentials.email}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Mot de passe temporaire</p>
                <p className="font-mono text-lg font-semibold tracking-wide">{credentials.password}</p>
              </div>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
          <Button onClick={copyCredentials}><Copy className="size-4" /> Copier les identifiants</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
