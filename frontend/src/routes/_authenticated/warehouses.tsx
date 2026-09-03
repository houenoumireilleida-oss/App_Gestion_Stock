import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchWarehouses } from "@/lib/stock";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Warehouse as WarehouseIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/warehouses")({
  head: () => ({ meta: [{ title: "Entrepôts — StockFlow" }] }),
  component: WarehousesPage,
});

function WarehousesPage() {
  const qc = useQueryClient();
  const warehouses = useQuery({ queryKey: ["warehouses"], queryFn: fetchWarehouses });
  const [form, setForm] = useState({ code: "", name: "", address: "" });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("warehouses").insert({
        code: form.code.trim(), name: form.name.trim(),
        address: form.address.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["warehouses"] });
      setForm({ code: "", name: "", address: "" });
      toast.success("Entrepôt créé");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("warehouses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["warehouses"] });
      qc.invalidateQueries({ queryKey: ["stock_levels"] });
      toast.success("Supprimé");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-6 lg:p-10 space-y-6 max-w-5xl">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Entrepôts & magasins</h1>
        <p className="text-muted-foreground mt-1">Définissez les sites où vous stockez vos produits.</p>
      </header>

      <Card className="p-6">
        <h2 className="font-semibold mb-4">Nouvel entrepôt</h2>
        <form onSubmit={e => { e.preventDefault(); create.mutate(); }} className="grid sm:grid-cols-[140px_1fr_2fr_auto] gap-3 items-end">
          <div className="space-y-2"><Label>Code *</Label><Input required value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="MAG-01" /></div>
          <div className="space-y-2"><Label>Nom *</Label><Input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Magasin Paris" /></div>
          <div className="space-y-2"><Label>Adresse</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
          <Button type="submit" disabled={create.isPending}><Plus className="size-4 mr-1" /> Ajouter</Button>
        </form>
      </Card>

      {warehouses.data && warehouses.data.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="table-head-dark">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Nom</th>
                <th className="px-4 py-3 font-medium">Adresse</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {warehouses.data.map(w => (
                <tr key={w.id}>
                  <td className="px-4 py-3 font-mono text-xs">{w.code}</td>
                  <td className="px-4 py-3 font-medium">{w.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{w.address ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"
                      onClick={() => { if (confirm("Supprimer cet entrepôt ?")) del.mutate(w.id); }}>
                      <Trash2 className="size-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </Card>
      ) : (
        <Card className="p-12 text-center">
          <WarehouseIcon className="size-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium">Aucun entrepôt</p>
          <p className="text-sm text-muted-foreground mt-1">Créez-en un ci-dessus pour suivre vos stocks.</p>
        </Card>
      )}
    </div>
  );
}
