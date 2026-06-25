import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchMovements, fetchProducts, fetchWarehouses, formatDate, MOVEMENT_LABEL } from "@/lib/stock";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ArrowDownRight, ArrowUpRight, RefreshCw, ArrowLeftRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/movements/")({
  head: () => ({ meta: [{ title: "Mouvements de stock — StockFlow" }] }),
  component: MovementsList,
});

function MovementsList() {
  const moves = useQuery({ queryKey: ["movements", "all"], queryFn: () => fetchMovements(200) });
  const products = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const warehouses = useQuery({ queryKey: ["warehouses"], queryFn: fetchWarehouses });

  const icon = {
    in: <ArrowDownRight className="size-4 text-success" />,
    out: <ArrowUpRight className="size-4 text-destructive" />,
    adjustment: <RefreshCw className="size-4 text-warning" />,
    transfer: <ArrowLeftRight className="size-4 text-chart-2" />,
  } as const;

  return (
    <div className="p-6 lg:p-10 space-y-6 max-w-7xl">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Mouvements de stock</h1>
          <p className="text-muted-foreground mt-1">Historique des entrées, sorties, ajustements et transferts.</p>
        </div>
        <Link to="/movements/new"><Button><Plus className="size-4 mr-1" /> Nouveau mouvement</Button></Link>
      </header>

      {moves.data && moves.data.length > 0 ? (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Produit</th>
                <th className="px-4 py-3 font-medium">Entrepôt</th>
                <th className="px-4 py-3 font-medium text-right">Quantité</th>
                <th className="px-4 py-3 font-medium">Motif / Réf.</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {moves.data.map(m => {
                const p = products.data?.find(p => p.id === m.product_id);
                const w = warehouses.data?.find(w => w.id === m.warehouse_id);
                const dest = warehouses.data?.find(w => w.id === m.destination_warehouse_id);
                return (
                  <tr key={m.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDate(m.created_at)}</td>
                    <td className="px-4 py-3"><span className="inline-flex items-center gap-1.5">{icon[m.type]} {MOVEMENT_LABEL[m.type]}</span></td>
                    <td className="px-4 py-3">{p?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {w?.name ?? "—"}{dest && ` → ${dest.name}`}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      {m.type === "out" || m.type === "transfer" ? "−" : "+"}{m.quantity}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{m.reason || m.reference || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      ) : (
        <Card className="p-12 text-center">
          <ArrowLeftRight className="size-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium">Aucun mouvement enregistré</p>
          <p className="text-sm text-muted-foreground mt-1">Enregistrez une entrée, une sortie ou un ajustement de stock.</p>
          <Link to="/movements/new"><Button className="mt-4"><Plus className="size-4 mr-1" /> Créer un mouvement</Button></Link>
        </Card>
      )}
    </div>
  );
}
