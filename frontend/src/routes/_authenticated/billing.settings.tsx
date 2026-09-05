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
import { ShieldAlert, FileText, FilePlus2, Settings } from "lucide-react";
import { SectionHero } from "@/components/SectionHero";

export const Route = createFileRoute("/_authenticated/billing/settings")({
  head: () => ({ meta: [{ title: "Société — StockFlow" }] }),
  component: SettingsPage,
});

const BILLING_LINKS = [
  { to: "/billing", label: "Factures", icon: FileText },
  { to: "/billing/new", label: "Nouvelle facture", icon: FilePlus2 },
  { to: "/billing/settings", label: "Société", icon: Settings },
];

function SettingsPage() {
  const { data: roles } = useMyRoles();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["company_settings"], queryFn: fetchCompanySettings });
  const [form, setForm] = useState<CompanySettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (q.data) setForm(q.data); }, [q.data]);

  if (!hasAny(roles, "admin", "responsable")) {
    return (
      <div>
        <SectionHero eyebrow="Facturation" title="Factures conformes, TVA multi-taux et mentions légales" links={BILLING_LINKS} />
        <div className="p-10 max-w-xl">
          <Card className="p-8 text-center">
            <ShieldAlert className="mx-auto size-10 text-warning mb-3" />
            <h2 className="font-semibold">Accès réservé</h2>
          </Card>
        </div>
      </div>
    );
  }

  if (!form) return (
    <div>
      <SectionHero eyebrow="Facturation" title="Factures conformes, TVA multi-taux et mentions légales" links={BILLING_LINKS} />
      <div className="p-10 text-muted-foreground">Chargement…</div>
    </div>
  );

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
    <div>
      <SectionHero
        eyebrow="Facturation"
        title="Factures conformes, TVA multi-taux et mentions légales"
        links={BILLING_LINKS}
      />
      <div className="p-6 lg:p-10 space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="size-11 rounded-xl bg-[var(--sidebar)] text-white grid place-items-center shrink-0">
            <Settings className="size-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Société</h1>
            <p className="text-sm text-muted-foreground">Mentions légales des factures</p>
          </div>
        </div>
        <Button type="submit" form="company-settings-form" disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button>
      </header>

      <form id="company-settings-form" onSubmit={submit}>
        <Card className="p-6 space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Raison sociale *</Label>
              <Input required value={form.name} onChange={e => update("name", e.target.value)} />
            </div>
            <div className="space-y-2"><Label>SIRET</Label><Input value={form.siret ?? ""} onChange={e => update("siret", e.target.value)} /></div>

            <div className="space-y-2"><Label>N° TVA</Label><Input value={form.vat_number ?? ""} onChange={e => update("vat_number", e.target.value)} /></div>
            <div className="space-y-2"><Label>Adresse</Label><Input value={form.address ?? ""} onChange={e => update("address", e.target.value)} /></div>

            <div className="space-y-2"><Label>Téléphone</Label><Input value={form.phone ?? ""} onChange={e => update("phone", e.target.value)} /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email ?? ""} onChange={e => update("email", e.target.value)} /></div>

            <div className="space-y-2"><Label>IBAN</Label><Input value={form.iban ?? ""} onChange={e => update("iban", e.target.value)} /></div>
            <div className="space-y-2"><Label>BIC</Label><Input value={form.bic ?? ""} onChange={e => update("bic", e.target.value)} /></div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4 pt-1">
            <div className="space-y-2"><Label>Code postal</Label><Input value={form.postal_code ?? ""} onChange={e => update("postal_code", e.target.value)} /></div>
            <div className="space-y-2"><Label>Ville</Label><Input value={form.city ?? ""} onChange={e => update("city", e.target.value)} /></div>
            <div className="space-y-2"><Label>Pays</Label><Input value={form.country ?? ""} onChange={e => update("country", e.target.value)} /></div>
          </div>

          <div className="space-y-2 pt-1">
            <Label>Mentions légales</Label>
            <Textarea rows={3} value={form.legal_footer ?? ""}
              onChange={e => update("legal_footer", e.target.value)}
              placeholder="Mentions affichées en pied de facture (TVA non applicable, escompte, pénalités…)" />
          </div>
        </Card>
      </form>
      </div>
    </div>
  );
}