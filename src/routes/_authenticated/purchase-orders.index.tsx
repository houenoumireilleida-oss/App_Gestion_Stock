import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchPurchaseOrders, fetchSuppliers, PO_STATUS_LABEL } from "@/lib/purchasing";
import { fetchWarehouses, formatDate } from "@/lib/stock";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/purchase-orders/")({
  head: () => ({ meta: [{ title: "Commandes fournisseur — StockFlow" }] }),
  component: POList,
});

function POList() {
  const q = useQuery({ queryKey: ["pos"], queryFn: fetchPurchaseOrders });
  const sup = useQuery({ queryKey: ["suppliers"], queryFn: fetchSuppliers });
  const wh = useQuery({ queryKey: ["warehouses"], queryFn: fetchWarehouses });

  const tone: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    draft: "outline", ordered: "secondary", partial: "secondary", received: "default", cancelled: "destructive",
  };

  return (
    <div className="p-6 lg:p-10 space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Commandes fournisseur</h1>
          <p className="text-muted-foreground mt-1">Achats en cours et réceptions.</p>
        </div>
        <Link to="/purchase-orders/new"><Button><Plus className="size-4" /> Nouvelle commande</Button></Link>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr><th className="px-4 py-2">Référence</th><th className="px-4 py-2">Fournisseur</th><th className="px-4 py-2">Entrepôt</th><th className="px-4 py-2">Date prévue</th><th className="px-4 py-2">Statut</th><th className="px-4 py-2">Créée le</th></tr>
          </thead>
          <tbody className="divide-y">
            {(q.data ?? []).map(p => {
              const s = (sup.data ?? []).find(s => s.id === p.supplier_id);
              const w = (wh.data ?? []).find(w => w.id === p.warehouse_id);
              return (
                <tr key={p.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2"><Link to="/purchase-orders/$id" params={{ id: p.id }} className="text-accent hover:underline font-mono">{p.reference}</Link></td>
                  <td className="px-4 py-2">{s?.name ?? "—"}</td>
                  <td className="px-4 py-2">{w?.name ?? "—"}</td>
                  <td className="px-4 py-2">{p.expected_at ?? "—"}</td>
                  <td className="px-4 py-2"><Badge variant={tone[p.status]}>{PO_STATUS_LABEL[p.status]}</Badge></td>
                  <td className="px-4 py-2 text-muted-foreground">{formatDate(p.created_at)}</td>
                </tr>
              );
            })}
            {(q.data ?? []).length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Aucune commande.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
