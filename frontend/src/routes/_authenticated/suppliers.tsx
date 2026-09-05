import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchSuppliers } from "@/lib/purchasing";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Truck, ClipboardList, PackageX } from "lucide-react";
import { SectionHero } from "@/components/SectionHero";

export const Route = createFileRoute("/_authenticated/suppliers")({
  head: () => ({ meta: [{ title: "Fournisseurs — StockFlow" }] }),
  component: SuppliersPage,
});

const PURCHASING_LINKS = [
  { to: "/suppliers", label: "Fournisseurs", icon: Truck },
  { to: "/purchase-orders", label: "Commandes", icon: ClipboardList },
  { to: "/supplier-returns", label: "Retours fournisseurs", icon: PackageX },
];

function SuppliersPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["suppliers"], queryFn: fetchSuppliers });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", contact_name: "", email: "", phone: "", address: "", payment_terms: "", notes: "" });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("suppliers").insert({ ...form });
    if (error) { toast.error(error.message); return; }
    toast.success("Fournisseur créé");
    setForm({ code: "", name: "", contact_name: "", email: "", phone: "", address: "", payment_terms: "", notes: "" });
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["suppliers"] });
  }

  return (
    <div>
      <SectionHero
        eyebrow="Achats"
        title="Fournisseurs, commandes et retours fournisseurs"
        links={PURCHASING_LINKS}
      />
      <div className="p-6 lg:p-10 space-y-6">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="size-11 rounded-xl bg-[var(--sidebar)] text-white grid place-items-center shrink-0">
            <Truck className="size-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Fournisseurs</h1>
            <p className="text-sm text-muted-foreground">{(q.data ?? []).length} fournisseur{(q.data ?? []).length > 1 ? "s" : ""}</p>
          </div>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4" /> Nouveau fournisseur</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nouveau fournisseur</DialogTitle></DialogHeader>
            <form onSubmit={save} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label>Code *</Label><Input required value={form.code} onChange={e => setForm({...form, code: e.target.value})} /></div>
                <div><Label>Nom *</Label><Input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
                <div><Label>Contact</Label><Input value={form.contact_name} onChange={e => setForm({...form, contact_name: e.target.value})} /></div>
                <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
                <div><Label>Téléphone</Label><Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
                <div><Label>Conditions paiement</Label><Input value={form.payment_terms} onChange={e => setForm({...form, payment_terms: e.target.value})} placeholder="30 jours fin de mois" /></div>
              </div>
              <div><Label>Adresse</Label><Textarea value={form.address} onChange={e => setForm({...form, address: e.target.value})} /></div>
              <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
              <DialogFooter><Button type="submit">Créer</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="table-head-dark text-left">
            <tr>
              <th className="px-4 py-2">Code</th>
              <th className="px-4 py-2">Fournisseur</th>
              <th className="px-4 py-2">Contact</th>
              <th className="px-4 py-2">Téléphone</th>
              <th className="px-4 py-2">Conditions</th>
              <th className="px-4 py-2">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(q.data ?? []).map(s => (
              <tr key={s.id} className="hover:bg-muted/30">
                <td className="px-4 py-2 font-mono text-xs">{s.code}</td>
                <td className="px-4 py-2 font-medium">{s.name}</td>
                <td className="px-4 py-2 text-muted-foreground">{s.contact_name ?? "—"}</td>
                <td className="px-4 py-2 text-muted-foreground">{s.phone ?? "—"}</td>
                <td className="px-4 py-2 text-muted-foreground">{s.payment_terms ?? "—"}</td>
                <td className="px-4 py-2">
                  {s.is_active ? <Badge variant="success">Actif</Badge> : <Badge variant="secondary">Inactif</Badge>}
                </td>
              </tr>
            ))}
            {(q.data ?? []).length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Aucun fournisseur.</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </Card>
      </div>
    </div>
  );
}