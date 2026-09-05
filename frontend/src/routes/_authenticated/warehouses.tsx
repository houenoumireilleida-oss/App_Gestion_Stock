import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchWarehouses, fetchStockLevels, fetchProducts, formatMoney } from "@/lib/stock";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SectionHero } from "@/components/SectionHero";
import { Plus, Warehouse as WarehouseIcon, Trash2, Package, ArrowLeftRight, AlertTriangle, PackageMinus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/warehouses")({
  head: () => ({ meta: [{ title: "Entrepôts — StockFlow" }] }),
  component: WarehousesPage,
});

const STOCK_LINKS = [
  { to: "/products", label: "Produits", icon: Package },
  { to: "/movements", label: "Mouvements", icon: ArrowLeftRight },
  { to: "/defective", label: "Défectueux", icon: AlertTriangle },
  { to: "/destocking", label: "Déstockage", icon: PackageMinus },
  { to: "/warehouses", label: "Entrepôts", icon: WarehouseIcon },
];

function WarehousesPage() {
  const qc = useQueryClient();
  const warehouses = useQuery({ queryKey: ["warehouses"], queryFn: fetchWarehouses });
  const levels = useQuery({ queryKey: ["stock_levels"], queryFn: fetchStockLevels });
  const products = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
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

  function warehouseStats(warehouseId: string) {
    const rows = (levels.data ?? []).filter(l => l.warehouse_id === warehouseId);
    const references = rows.filter(r => r.quantity > 0).length;
    const value = rows.reduce((s, l) => {
      const p = (products.data ?? []).find(p => p.id === l.product_id);
      return s + (p ? p.cost * l.quantity : 0);
    }, 0);
    const hasRupture = rows.some(r => {
      const p = (products.data ?? []).find(p => p.id === r.product_id);
      return p && r.quantity <= 0;
    });
    const hasLow = rows.some(r => {
      const p = (products.data ?? []).find(p => p.id === r.product_id);
      return p && r.quantity > 0 && r.quantity <= p.low_stock_threshold;
    });
    return { references, value, hasRupture, hasLow };
  }

  return (
    <div>
      <SectionHero
        eyebrow="Stock"
        title="Inventaire multi-sites, mouvements, défectueux et déstockage"
        links={STOCK_LINKS}
      />
      <div className="p-6 lg:p-10 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="size-11 rounded-xl bg-[var(--sidebar)] text-white grid place-items-center shrink-0">
            <WarehouseIcon className="size-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Entrepôts</h1>
            <p className="text-sm text-muted-foreground">{warehouses.data?.length ?? 0} site{(warehouses.data?.length ?? 0) > 1 ? "s" : ""}</p>
          </div>
        </div>
      </header>

      <Card className="p-6">
        <h2 className="font-semibold mb-4">Nouveau site</h2>
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
            <thead className="table-head-dark text-left">
              <tr>
                <th className="px-4 py-2">Code</th>
                <th className="px-4 py-2">Site</th>
                <th className="px-4 py-2">Adresse</th>
                <th className="px-4 py-2 text-right">Références</th>
                <th className="px-4 py-2 text-right">Valeur du stock</th>
                <th className="px-4 py-2">État</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {warehouses.data.map(w => {
                const stats = warehouseStats(w.id);
                return (
                  <tr key={w.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2 font-mono text-xs">{w.code}</td>
                    <td className="px-4 py-2 font-medium">{w.name}</td>
                    <td className="px-4 py-2 text-muted-foreground">{w.address ?? "—"}</td>
                    <td className="px-4 py-2 text-right font-mono">{stats.references}</td>
                    <td className="px-4 py-2 text-right font-mono">{formatMoney(stats.value)}</td>
                    <td className="px-4 py-2">
                      {!w.is_active ? <Badge variant="secondary">Inactif</Badge>
                       : stats.hasRupture ? <Badge variant="danger">Rupture</Badge>
                       : stats.hasLow ? <Badge variant="warning">Sous seuil</Badge>
                       : <Badge variant="success">Normal</Badge>}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"
                        onClick={() => { if (confirm("Supprimer cet entrepôt ?")) del.mutate(w.id); }}>
                        <Trash2 className="size-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
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
    </div>
  );
}