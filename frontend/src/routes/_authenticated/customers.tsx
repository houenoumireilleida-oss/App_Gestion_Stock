import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchCustomers, customerName } from "@/lib/customers";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Star } from "lucide-react";

export const Route = createFileRoute("/_authenticated/customers")({
  head: () => ({ meta: [{ title: "Clients & fidélité — StockFlow" }] }),
  component: CustomersPage,
});

function CustomersPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["customers"], queryFn: fetchCustomers });
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

  const filtered = (q.data ?? []).filter(c => {
    if (!search) return true;
    const s = search.toLowerCase();
    return customerName(c).toLowerCase().includes(s) ||
      (c.email ?? "").toLowerCase().includes(s) ||
      (c.phone ?? "").includes(s);
  });

  return (
    <div className="p-6 lg:p-10 space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Clients & fidélité</h1>
          <p className="text-muted-foreground mt-1">1 point de fidélité par 1000 FCFA dépensé.</p>
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

      <Input placeholder="Rechercher (nom, email, téléphone)" value={search} onChange={e => setSearch(e.target.value)} className="max-w-md" />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="table-head-dark text-left">
            <tr><th className="px-4 py-2">Nom</th><th className="px-4 py-2">Email</th><th className="px-4 py-2">Téléphone</th><th className="px-4 py-2 text-right">Points</th></tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map(c => (
              <tr key={c.id} className="hover:bg-muted/30">
                <td className="px-4 py-2 font-medium">{customerName(c)}</td>
                <td className="px-4 py-2">{c.email ?? "—"}</td>
                <td className="px-4 py-2">{c.phone ?? "—"}</td>
                <td className="px-4 py-2 text-right font-mono"><Star className="size-3 inline text-warning" /> {c.loyalty_points}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Aucun client.</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </Card>
    </div>
  );
}
