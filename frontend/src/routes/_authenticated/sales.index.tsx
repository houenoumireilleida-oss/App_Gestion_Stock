import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchSales } from "@/lib/sales";
import { fetchWarehouses, formatMoney, formatDate } from "@/lib/stock";
import { fetchCustomers, customerName } from "@/lib/customers";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/sales/")({
  head: () => ({ meta: [{ title: "Ventes — StockFlow" }] }),
  component: SalesPage,
});

function SalesPage() {
  const sales = useQuery({ queryKey: ["sales"], queryFn: () => fetchSales(200) });
  const warehouses = useQuery({ queryKey: ["warehouses"], queryFn: fetchWarehouses });
  const customers = useQuery({ queryKey: ["customers"], queryFn: fetchCustomers });

  const list = sales.data ?? [];
  const today = new Date(); today.setHours(0,0,0,0);
  const todaySales = list.filter(s => new Date(s.created_at) >= today && s.status === "completed");
  const caToday = todaySales.reduce((s, x) => s + x.total, 0);

  return (
    <div className="p-6 lg:p-10 space-y-6 max-w-7xl">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Ventes</h1>
        <p className="text-muted-foreground mt-1">Historique des encaissements et tickets.</p>
      </header>
      <div className="grid sm:grid-cols-3 gap-4">
        <Card className="p-5"><p className="text-sm text-muted-foreground">CA du jour</p><p className="text-2xl font-semibold mt-1">{formatMoney(caToday)}</p></Card>
        <Card className="p-5"><p className="text-sm text-muted-foreground">Tickets du jour</p><p className="text-2xl font-semibold mt-1">{todaySales.length}</p></Card>
        <Card className="p-5"><p className="text-sm text-muted-foreground">Panier moyen</p><p className="text-2xl font-semibold mt-1">{formatMoney(todaySales.length ? caToday / todaySales.length : 0)}</p></Card>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr><th className="px-4 py-2">Référence</th><th className="px-4 py-2">Date</th><th className="px-4 py-2">Client</th><th className="px-4 py-2">Entrepôt</th><th className="px-4 py-2">Statut</th><th className="px-4 py-2 text-right">Total</th></tr>
          </thead>
          <tbody className="divide-y">
            {list.map(s => {
              const c = (customers.data ?? []).find(c => c.id === s.customer_id);
              const w = (warehouses.data ?? []).find(w => w.id === s.warehouse_id);
              return (
                <tr key={s.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2"><Link to="/sales/$id" params={{ id: s.id }} className="text-accent hover:underline font-mono">{s.reference}</Link></td>
                  <td className="px-4 py-2">{formatDate(s.created_at)}</td>
                  <td className="px-4 py-2">{c ? customerName(c) : "—"}</td>
                  <td className="px-4 py-2">{w?.name ?? "—"}</td>
                  <td className="px-4 py-2"><Badge variant={s.status === "refunded" ? "destructive" : "secondary"}>{s.status}</Badge></td>
                  <td className="px-4 py-2 text-right font-mono">{formatMoney(s.total)}</td>
                </tr>
              );
            })}
            {list.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Aucune vente. <Link to="/pos" className="text-accent hover:underline">Aller à la caisse</Link></td></tr>
            )}
          </tbody>
        </table>
        </div>
      </Card>
    </div>
  );
}
