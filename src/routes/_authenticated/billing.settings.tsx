import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { fetchCompanySettings, saveCompanySettings, type CompanySettings } from "@/lib/billing";
import { useMyRoles, hasAny } from "@/lib/roles";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/billing/settings")({
  head: () => ({ meta: [{ title: "Société — StockFlow" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { data: roles } = useMyRoles();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["company_settings"], queryFn: fetchCompanySettings });
  const [form, setForm] = useState<CompanySettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (q.data) setForm(q.data); }, [q.data]);

  if (!hasAny(roles, "admin", "responsable")) {
    return (
      <div className="p-10 max-w-xl">
        <Card className="p-8 text-center">
          <ShieldAlert className="mx-auto size-10 text-warning mb-3" />
          <h2 className="font-semibold">Accès réservé</h2>
        </Card>
      </div>
    );
  }

  if (!form) return <div className="p-10 text-muted-foreground">Chargement…</div>;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    try {
      await saveCompanySettings(form);
      toast.success("Paramètres enregistrés");
      qc.invalidateQueries({ queryKey: ["company_settings"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally { setSaving(false); }
  }

  function update<K extends keyof CompanySettings>(k: K, v: CompanySettings[K]) {
    setForm(f => f ? { ...f, [k]: v } : f);
  }

  return (
    <div className="p-6 lg:p-10 max-w-3xl space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Société émettrice</h1>
        <p className="text-muted-foreground mt-1">Informations affichées sur vos factures.</p>
      </header>

      <form onSubmit={submit} className="space-y-6">
        <Card className="p-6 space-y-4">
          <h2 className="font-semibold">Identité</h2>
          <div className="space-y-2">
            <Label>Raison sociale *</Label>
            <Input required value={form.name} onChange={e => update("name", e.target.value)} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>SIRET</Label><Input value={form.siret ?? ""} onChange={e => update("siret", e.target.value)} /></div>
            <div className="space-y-2"><Label>N° TVA</Label><Input value={form.vat_number ?? ""} onChange={e => update("vat_number", e.target.value)} /></div>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="font-semibold">Adresse</h2>
          <div className="space-y-2"><Label>Adresse</Label><Textarea value={form.address ?? ""} onChange={e => update("address", e.target.value)} /></div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-2"><Label>Code postal</Label><Input value={form.postal_code ?? ""} onChange={e => update("postal_code", e.target.value)} /></div>
            <div className="space-y-2"><Label>Ville</Label><Input value={form.city ?? ""} onChange={e => update("city", e.target.value)} /></div>
            <div className="space-y-2"><Label>Pays</Label><Input value={form.country ?? ""} onChange={e => update("country", e.target.value)} /></div>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="font-semibold">Contact</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email ?? ""} onChange={e => update("email", e.target.value)} /></div>
            <div className="space-y-2"><Label>Téléphone</Label><Input value={form.phone ?? ""} onChange={e => update("phone", e.target.value)} /></div>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="font-semibold">Coordonnées bancaires</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>IBAN</Label><Input value={form.iban ?? ""} onChange={e => update("iban", e.target.value)} /></div>
            <div className="space-y-2"><Label>BIC</Label><Input value={form.bic ?? ""} onChange={e => update("bic", e.target.value)} /></div>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="font-semibold">Mentions légales</h2>
          <Textarea rows={3} value={form.legal_footer ?? ""}
            onChange={e => update("legal_footer", e.target.value)}
            placeholder="Mentions affichées en pied de facture (TVA non applicable, escompte, pénalités…)" />
        </Card>

        <Button type="submit" disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button>
      </form>
    </div>
  );
}
