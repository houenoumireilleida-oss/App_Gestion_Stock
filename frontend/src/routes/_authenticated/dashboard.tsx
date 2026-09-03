import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchProducts, fetchWarehouses, fetchStockLevels, fetchMovements, formatMoney, formatDate, MOVEMENT_LABEL } from "@/lib/stock";
import { Card } from "@/components/ui/card";
import { Package, Warehouse, AlertTriangle, TrendingUp, ArrowDownRight, ArrowUpRight, RefreshCw, ArrowLeftRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";


export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Tableau de bord — StockFlow" }] }),
  component: Dashboard,
});

function Dashboard() {
  const products = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const warehouses = useQuery({ queryKey: ["warehouses"], queryFn: fetchWarehouses });
  const levels = useQuery({ queryKey: ["stock_levels"], queryFn: fetchStockLevels });
  const moves = useQuery({ queryKey: ["movements", "recent"], queryFn: () => fetchMovements(8) });

  const productsList = products.data ?? [];
  const levelsList = levels.data ?? [];

  const totalUnits = levelsList.reduce((s, l) => s + l.quantity, 0);
  const stockValue = levelsList.reduce((s, l) => {
    const p = productsList.find(p => p.id === l.product_id);
    return s + (p ? p.cost * l.quantity : 0);
  }, 0);
  const stockByProduct = new Map<string, number>();
  for (const l of levelsList) {
    stockByProduct.set(l.product_id, (stockByProduct.get(l.product_id) ?? 0) + l.quantity);
  }
  const lowStock = productsList.filter(p => (stockByProduct.get(p.id) ?? 0) <= p.low_stock_threshold);

  const stats = [
    { label: "Références produits", value: productsList.length, icon: Package, tone: "bg-chart-2/10 text-chart-2" },
    { label: "Entrepôts actifs", value: (warehouses.data ?? []).filter(w => w.is_active).length, icon: Warehouse, tone: "bg-chart-5/10 text-chart-5" },
    { label: "Unités en stock", value: totalUnits.toLocaleString("fr-FR"), icon: TrendingUp, tone: "bg-accent/10 text-accent" },
    { label: "Valeur de stock", value: formatMoney(stockValue), icon: TrendingUp, tone: "bg-chart-3/10 text-warning" },
  ];

  const moveIcon = {
    in: <ArrowDownRight className="size-4 text-success" />,
    out: <ArrowUpRight className="size-4 text-destructive" />,
    adjustment: <RefreshCw className="size-4 text-warning" />,
    transfer: <ArrowLeftRight className="size-4 text-chart-2" />,
  } as const;

  return (
    <div className="min-h-full">
      {/* Simple page header — no hero banner here; the dashboard is the overview,
          section landing pages use SectionHero instead. */}
      <div className="px-6 lg:px-10 pt-6 lg:pt-8 pb-2 max-w-7xl flex items-center gap-2 text-sm text-muted-foreground">
        <Sparkles className="size-3.5 text-primary" />
        Vue d'ensemble en temps réel
      </div>
      <div className="px-6 lg:px-10 pb-4 max-w-7xl">
        <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight text-foreground">Tableau de bord</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">Votre catalogue, vos entrepôts et vos mouvements de stock, tout au même endroit.</p>
      </div>

      <div className="p-6 lg:p-10 pt-2 space-y-8 max-w-7xl relative">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map(s => (
            <Card key={s.label} className="p-5 shadow-card border-border/60 hover:shadow-elegant transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                  <p className="text-2xl font-semibold mt-2 tracking-tight">{s.value}</p>
                </div>
                <div className={`size-11 rounded-xl grid place-items-center ${s.tone}`}>
                  <s.icon className="size-5" />
                </div>
              </div>
            </Card>
          ))}
        </section>


      <section className="grid gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Derniers mouvements de stock</h2>
            <Link to="/movements"><Button variant="ghost" size="sm">Tout voir</Button></Link>
          </div>
          {moves.data && moves.data.length > 0 ? (
            <ul className="divide-y">
              {moves.data.map(m => {
                const p = productsList.find(p => p.id === m.product_id);
                const w = (warehouses.data ?? []).find(w => w.id === m.warehouse_id);
                return (
                  <li key={m.id} className="py-3 flex items-center gap-3">
                    <div className="size-8 rounded-md bg-muted grid place-items-center">{moveIcon[m.type]}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p?.name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">
                        {MOVEMENT_LABEL[m.type]} · {w?.name ?? "—"} · {formatDate(m.created_at)}
                      </p>
                    </div>
                    <span className="text-sm font-mono tabular-nums">
                      {m.type === "out" || m.type === "transfer" ? "−" : "+"}{m.quantity}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Aucun mouvement enregistré. <Link to="/movements" className="text-accent hover:underline">Créer un mouvement</Link>
            </p>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="size-4 text-warning" />
            <h2 className="font-semibold">Alertes de seuil</h2>
          </div>
          {lowStock.length > 0 ? (
            <ul className="space-y-3">
              {lowStock.slice(0, 8).map(p => (
                <li key={p.id} className="flex items-center justify-between text-sm">
                  <Link to="/products/$id" params={{ id: p.id }} className="truncate hover:text-accent">{p.name}</Link>
                  <span className="font-mono text-warning">
                    {stockByProduct.get(p.id) ?? 0}/{p.low_stock_threshold}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Aucune alerte. Tous les stocks sont au-dessus du seuil.</p>
          )}
        </Card>
      </section>
      </div>
    </div>
  );
}

