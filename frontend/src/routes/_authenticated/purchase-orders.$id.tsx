import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchPurchaseOrder, fetchSuppliers, receivePOItem, PO_STATUS_LABEL } from "@/lib/purchasing";
import { fetchWarehouses, fetchProducts, formatMoney, formatDate } from "@/lib/stock";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/purchase-orders/$id")({
  head: () => ({ meta: [{ title: "Commande — StockFlow" }] }),
  component: PODetail,
});

function PODetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["po", id], queryFn: () => fetchPurchaseOrder(id) });
  const sup = useQuery({ queryKey: ["suppliers"], queryFn: fetchSuppliers });
  const wh = useQuery({ queryKey: ["warehouses"], queryFn: fetchWarehouses });
  const products = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const [qty, setQty] = useState<Record<string, number>>({});

  if (q.isLoading) return <div className="p-10">Chargement…</div>;
  if (!q.data) return <div className="p-10">Introuvable</div>;
  const { po, items } = q.data;
  const supplier = (sup.data ?? []).find(s => s.id === po.supplier_id);
  const warehouse = (wh.data ?? []).find(w => w.id === po.warehouse_id);

  async function receive(itemId: string) {
    const n = qty[itemId];
    if (!n || n <= 0) { toast.error("Quantité invalide"); return; }
    try {
      await receivePOItem(itemId, n);
      toast.success("Marchandise reçue, stock mis à jour");
      setQty(p => ({ ...p, [itemId]: 0 }));
      qc.invalidateQueries({ queryKey: ["po", id] });
      qc.invalidateQueries({ queryKey: ["pos"] });
      qc.invalidateQueries({ queryKey: ["stock_levels"] });
      qc.invalidateQueries({ queryKey: ["movements", "recent"] });
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Erreur"); }
  }

  async function cancel() {
    if (!confirm("Annuler cette commande ?")) return;
    const { error } = await supabase.from("purchase_orders").update({ status: "cancelled" }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Commande annulée");
    qc.invalidateQueries({ queryKey: ["po", id] });
  }

  async function markOrdered() {
    const { error } = await supabase.from("purchase_orders").update({ status: "ordered" }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Commande envoyée");
    qc.invalidateQueries({ queryKey: ["po", id] });
  }

  const totalCost = items.reduce((s, l) => s + l.ordered_qty * l.unit_cost, 0);

  return (
    <div className="p-6 lg:p-10 space-y-6 max-w-5xl">
      <Link to="/purchase-orders" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"><ArrowLeft className="size-4" /> Retour</Link>
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight font-mono">{po.reference}</h1>
          <p className="text-muted-foreground mt-1">Créée le {formatDate(po.created_at)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge>{PO_STATUS_LABEL[po.status]}</Badge>
          {po.status === "draft" && <Button size="sm" onClick={markOrdered}><Check className="size-4" /> Passer commande</Button>}
          {po.status !== "received" && po.status !== "cancelled" && <Button size="sm" variant="outline" onClick={cancel}><X className="size-4" /> Annuler</Button>}
        </div>
      </header>

      <Card className="p-6 grid sm:grid-cols-3 gap-4 text-sm">
        <div><p className="text-muted-foreground">Fournisseur</p><p className="font-medium">{supplier?.name ?? "—"}</p></div>
        <div><p className="text-muted-foreground">Entrepôt</p><p className="font-medium">{warehouse?.name ?? "—"}</p></div>
        <div><p className="text-muted-foreground">Date prévue</p><p className="font-medium">{po.expected_at ?? "—"}</p></div>
        {po.notes && <div className="sm:col-span-3"><p className="text-muted-foreground">Notes</p><p>{po.notes}</p></div>}
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="table-head-dark text-left">
            <tr><th className="px-4 py-2">Produit</th><th className="px-4 py-2 text-right">Commandé</th><th className="px-4 py-2 text-right">Reçu</th><th className="px-4 py-2 text-right">Coût unitaire</th><th className="px-4 py-2">Réception</th></tr>
          </thead>
          <tbody className="divide-y">
            {items.map(l => {
              const p = (products.data ?? []).find(p => p.id === l.product_id);
              const remaining = l.ordered_qty - l.received_qty;
              return (
                <tr key={l.id}>
                  <td className="px-4 py-2"><p className="font-medium">{p?.name ?? "—"}</p><p className="text-xs text-muted-foreground">{p?.sku}</p></td>
                  <td className="px-4 py-2 text-right font-mono">{l.ordered_qty}</td>
                  <td className="px-4 py-2 text-right font-mono">{l.received_qty}</td>
                  <td className="px-4 py-2 text-right font-mono">{formatMoney(l.unit_cost)}</td>
                  <td className="px-4 py-2">
                    {remaining > 0 && po.status !== "cancelled" ? (
                      <div className="flex gap-2 items-center">
                        <Input type="number" min={1} max={remaining} className="w-20 h-8" placeholder={String(remaining)}
                          value={qty[l.id] || ""} onChange={e => setQty(p => ({ ...p, [l.id]: parseInt(e.target.value) || 0 }))} />
                        <Button size="sm" onClick={() => receive(l.id)}>Recevoir</Button>
                      </div>
                    ) : <span className="text-xs text-muted-foreground">Complet</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-muted/30 font-semibold">
            <tr><td className="px-4 py-2" colSpan={3}>Total HT estimé</td><td className="px-4 py-2 text-right font-mono" colSpan={2}>{formatMoney(totalCost)}</td></tr>
          </tfoot>
        </table>
        </div>
      </Card>
    </div>
  );
}
