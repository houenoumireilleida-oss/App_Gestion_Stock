import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchCustomers, customerName } from "@/lib/customers";
import { fetchSales } from "@/lib/sales";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SectionHero } from "@/components/SectionHero";
import { formatMoney } from "@/lib/stock";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Star, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/customers")({
  head: () => ({ meta: [{ title: "Clients & fidélité — StockFlow" }] }),
  component: CustomersPage,
});

const CLIENTS_LINKS = [
  { to: "/customers", label: "Clients & fidélité", icon: Users },
];

function CustomersPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["customers"], queryFn: fetchCustomers });
  const sales = useQuery({ queryKey: ["sales", "customers"], queryFn: () => fetchSales(500) });
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", phone: "", address: "", notes: "" });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("customers").insert({ ...form });
    if (error) { toast.error(error.message); return; }
    toast.success("Client créé");
    setForm({ first_name: "", last_name: "", email: "", phone: "", address: "", notes: "" });
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["customers"] });
  }

  const list = q.data ?? [];
  const filtered = list.filter(c => {
    if (!search) return true;
    const s = search.toLowerCase();
    return customerName(c).toLowerCase().includes(s) ||
      (c.email ?? "").toLowerCase().includes(s) ||
      (c.phone ?? "").includes(s);
  });

  function spend(customerId: string) {
    return (sales.data ?? [])
      .filter(s => s.customer_id === customerId && s.status === "completed")
      .reduce((s, x) => s + x.total, 0);
  }

  const totalRevenue = list.reduce((s, c) => s + spend(c.id), 0);
  const activeCount = list.filter(c => c.is_active).length;
  const totalPoints = list.reduce((s, c) => s + c.loyalty_points, 0);

  return (
    <div>
      <SectionHero
        eyebrow="Clients"
        title="Fichier client, fidélité et historique d'achats"
        links={CLIENTS_LINKS}
      />
      <div className="p-6 lg:p-10 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="size-11 rounded-xl bg-[var(--sidebar)] text-white grid place-items-center shrink-0">
            <Users className="size-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Clients & fidélité</h1>
            <p className="text-sm text-muted-foreground">{list.length} client{list.length > 1 ? "s" : ""}</p>
          </div>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4" /> Nouveau client</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nouveau client</DialogTitle></DialogHeader>
            <form onSubmit={save} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label>Prénom</Label><Input value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})} /></div>
                <div><Label>Nom *</Label><Input required value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})} /></div>
                <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
                <div><Label>Téléphone</Label><Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
              </div>
              <div><Label>Adresse</Label><Textarea value={form.address} onChange={e => setForm({...form, address: e.target.value})} /></div>
              <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
              <DialogFooter><Button type="submit">Créer</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5 card-accent-top card-accent-navy">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Chiffre d'affaires clients</p>
          <p className="text-2xl font-semibold mt-2 tracking-tight">{formatMoney(totalRevenue)}</p>
        </Card>
        <Card className="p-5 card-accent-top card-accent-teal">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Clients actifs</p>
          <p className="text-2xl font-semibold mt-2 tracking-tight">{activeCount}</p>
        </Card>
        <Card className="p-5 card-accent-top border-t-warning">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Points de fidélité</p>
          <p className="text-2xl font-semibold mt-2 tracking-tight">{totalPoints.toLocaleString("fr-FR")}</p>
        </Card>
      </div>

      <Input placeholder="Rechercher (nom, email, téléphone)" value={search} onChange={e => setSearch(e.target.value)} className="max-w-md" />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="table-head-dark text-left">
            <tr>
              <th className="px-4 py-2">Code</th>
              <th className="px-4 py-2">Client</th>
              <th className="px-4 py-2">Téléphone</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2 text-right">Achats cumulés</th>
              <th className="px-4 py-2 text-right">Points</th>
              <th className="px-4 py-2">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map(c => (
              <tr key={c.id} className="hover:bg-muted/30">
                <td className="px-4 py-2 font-mono text-xs">{c.code ?? "—"}</td>
                <td className="px-4 py-2 font-medium">{customerName(c)}</td>
                <td className="px-4 py-2 text-muted-foreground">{c.phone ?? "—"}</td>
                <td className="px-4 py-2 text-muted-foreground">{c.email ?? "—"}</td>
                <td className="px-4 py-2 text-right font-mono">{formatMoney(spend(c.id))}</td>
                <td className="px-4 py-2 text-right font-mono"><Star className="size-3 inline text-warning" /> {c.loyalty_points}</td>
                <td className="px-4 py-2">
                  {c.is_active ? <Badge variant="success">Actif</Badge> : <Badge variant="secondary">Inactif</Badge>}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Aucun client.</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </Card>
      </div>
    </div>
  );
}