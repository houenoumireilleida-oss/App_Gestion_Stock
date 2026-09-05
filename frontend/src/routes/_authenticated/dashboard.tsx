import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchProducts, fetchWarehouses, fetchStockLevels, fetchMovements, formatMoney, formatDate, MOVEMENT_LABEL } from "@/lib/stock";
import { fetchSales } from "@/lib/sales";
import { fetchDestocking, fetchDisbursement, fetchDefective, fetchAuditLog, DISB_CAT_LABEL } from "@/lib/workflows";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Package, Warehouse, TrendingUp, ArrowDownRight, ArrowUpRight,
  RefreshCw, ArrowLeftRight, Gauge, ShoppingCart, BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Tableau de bord — StockFlow" }] }),
  component: Dashboard,
});

function daysAgoLabel(d: Date) {
  return d.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "").toUpperCase();
}

function Dashboard() {
  const products = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const warehouses = useQuery({ queryKey: ["warehouses"], queryFn: fetchWarehouses });
  const levels = useQuery({ queryKey: ["stock_levels"], queryFn: fetchStockLevels });
  const moves = useQuery({ queryKey: ["movements", "recent"], queryFn: () => fetchMovements(8) });
  const sales = useQuery({ queryKey: ["sales", "dashboard"], queryFn: () => fetchSales(300) });
  const destocking = useQuery({ queryKey: ["destocking"], queryFn: fetchDestocking });
  const disbursement = useQuery({ queryKey: ["disbursement"], queryFn: fetchDisbursement });
  const defective = useQuery({ queryKey: ["defective"], queryFn: fetchDefective });
  const auditLog = useQuery({ queryKey: ["audit_log", "dashboard"], queryFn: () => fetchAuditLog(5) });

  const productsList = products.data ?? [];
  const warehousesList = warehouses.data ?? [];
  const levelsList = levels.data ?? [];
  const salesList = sales.data ?? [];

  const totalUnits = levelsList.reduce((s, l) => s + l.quantity, 0);
  const stockValue = levelsList.reduce((s, l) => {
    const p = productsList.find(p => p.id === l.product_id);
    return s + (p ? p.cost * l.quantity : 0);
  }, 0);

  // Per-warehouse low-stock rows (real levels, not aggregated) — matches "Stocks à surveiller"
  const lowStockRows = levelsList
    .map(l => ({ level: l, product: productsList.find(p => p.id === l.product_id), warehouse: warehousesList.find(w => w.id === l.warehouse_id) }))
    .filter(r => r.product && r.level.quantity <= r.product.low_stock_threshold)
    .sort((a, b) => a.level.quantity - b.level.quantity);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todaySales = salesList.filter(s => new Date(s.created_at) >= today && s.status === "completed");
  const caToday = todaySales.reduce((s, x) => s + x.total, 0);

  const pendingDisbursement = (disbursement.data ?? []).filter(d => d.status === "pending");
  const pendingDisbursementTotal = pendingDisbursement.reduce((s, d) => s + d.amount, 0);
  const pendingDestocking = (destocking.data ?? []).filter(d => d.status === "pending");

  const defectiveLoss = (defective.data ?? [])
    .filter(d => d.status !== "rejected")
    .reduce((s, d) => {
      const p = productsList.find(p => p.id === d.product_id);
      return s + (p ? p.cost * d.quantity : 0);
    }, 0);

  const approvals = [
    ...pendingDestocking.map(d => ({
      id: d.id, title: `Déstockage — ${d.reason}`,
      subtitle: `${d.quantity} × ${productsList.find(p => p.id === d.product_id)?.name ?? "Produit"}`,
      to: "/destocking" as const,
    })),
    ...pendingDisbursement.map(d => ({
      id: d.id, title: `Décaissement — ${DISB_CAT_LABEL[d.category]}`,
      subtitle: `${d.beneficiary} · ${formatMoney(d.amount)}`,
      to: "/disbursement" as const,
    })),
  ].slice(0, 4);

  // Last 7 days revenue, from real completed sales
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (6 - i));
    const next = new Date(d); next.setDate(d.getDate() + 1);
    const total = salesList.filter(s => s.status === "completed" && new Date(s.created_at) >= d && new Date(s.created_at) < next)
      .reduce((s, x) => s + x.total, 0);
    return { label: daysAgoLabel(d), total };
  });
  const maxDay = Math.max(1, ...days.map(d => d.total));

  const stats = [
    { label: "Ventes du jour", value: formatMoney(caToday), caption: `${todaySales.length} ticket${todaySales.length > 1 ? "s" : ""} encaissé${todaySales.length > 1 ? "s" : ""}`, accent: "card-accent-navy" },
    { label: "Stocks critiques", value: `${lowStockRows.length} référence${lowStockRows.length > 1 ? "s" : ""}`, caption: "Rupture ou sous seuil", accent: "card-accent-danger" },
    { label: "Pertes défectueux", value: formatMoney(defectiveLoss), caption: `${(defective.data ?? []).length} déclaration${(defective.data ?? []).length > 1 ? "s" : ""}`, accent: "" },
    { label: "Décaissements en attente", value: formatMoney(pendingDisbursementTotal), caption: `${pendingDisbursement.length} demande${pendingDisbursement.length > 1 ? "s" : ""}`, accent: "card-accent-teal" },
  ];

  const moveIcon = {
    in: <ArrowDownRight className="size-4 text-success" />,
    out: <ArrowUpRight className="size-4 text-destructive" />,
    adjustment: <RefreshCw className="size-4 text-warning" />,
    transfer: <ArrowLeftRight className="size-4 text-chart-2" />,
  } as const;

  return (
    <div className="min-h-full">
      {/* Hero */}
      <div className="relative overflow-hidden hero-gradient hero-pattern">
        <div className="relative p-6 lg:p-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/70 mb-2">Tableau de bord</p>
          <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight text-white max-w-2xl">
            Pilotage consolidé des ventes, des stocks et de la trésorerie
          </h1>
          <a href="#indicateurs" className="nav-pill nav-pill-inactive-dark inline-flex mt-5">
            <Gauge className="size-3.5" /> Vue générale
          </a>
        </div>
      </div>

      <div className="p-6 lg:p-10 space-y-8 relative">
        <div className="flex items-center gap-3">
          <span className="size-11 rounded-xl bg-[var(--sidebar)] text-white grid place-items-center shrink-0">
            <Gauge className="size-5" />
          </span>
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Tableau de bord</h2>
            <p className="text-sm text-muted-foreground">Situation au {formatDate(new Date().toISOString())} — tous points de vente</p>
          </div>
        </div>

        <section id="indicateurs" className="space-y-3 scroll-mt-20">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Indicateurs clés</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map(s => (
              <Card key={s.label} className={`p-5 shadow-card card-accent-top ${s.accent || "border-t-warning"}`}>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{s.label}</p>
                <p className="text-2xl font-semibold mt-2 tracking-tight">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.caption}</p>
              </Card>
            ))}
          </div>
        </section>

        {approvals.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Approbations en attente</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {approvals.map(a => (
                <Link key={a.id} to={a.to}>
                  <Card className="p-4 border-l-4 border-l-warning hover:shadow-elegant transition-shadow h-full">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[11px] font-mono text-muted-foreground">{a.id.slice(0, 8).toUpperCase()}</p>
                      <Badge variant="warning">En attente</Badge>
                    </div>
                    <p className="font-medium mt-1">{a.title}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{a.subtitle}</p>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="grid gap-6 lg:grid-cols-3">
          <Card className="p-6 lg:col-span-2">
            <div className="flex items-center gap-2 mb-5">
              <BarChart3 className="size-4 text-primary" />
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Chiffre d'affaires — 7 derniers jours</h2>
            </div>
            <div className="flex items-end gap-3 h-48">
              {days.map(d => (
                <div key={d.label} className="flex-1 flex flex-col items-center gap-2">
                  <span className="text-xs text-muted-foreground">{d.total > 0 ? `${Math.round(d.total / 1000)}k` : "0"}</span>
                  <div className="w-full rounded-t-md accent-gradient" style={{ height: `${Math.max(8, (d.total / maxDay) * 150)}px` }} />
                  <span className="text-[11px] font-medium text-muted-foreground uppercase">{d.label}</span>
                </div>
              ))}
            </div>
          </Card>

          <div className="grid gap-4">
            <Link to="/pos">
              <Card className="relative overflow-hidden p-5 hero-gradient text-white hover:shadow-glow transition-shadow h-full flex flex-col justify-end min-h-[92px]">
                <svg className="absolute inset-0 w-full h-full opacity-25" viewBox="0 0 200 100" preserveAspectRatio="xMidYMid slice" fill="none">
                  <rect x="120" y="20" width="60" height="42" rx="4" stroke="white" strokeWidth="2" />
                  <rect x="128" y="30" width="44" height="6" rx="1" fill="white" opacity="0.7" />
                  <rect x="128" y="42" width="28" height="4" rx="1" fill="white" opacity="0.5" />
                  <circle cx="40" cy="30" r="16" stroke="white" strokeWidth="2" />
                  <path d="M32 30h16M40 22v16" stroke="white" strokeWidth="2" />
                  <path d="M60 55 L100 55 M70 65 L100 65 M70 75 L90 75" stroke="white" strokeWidth="2" opacity="0.6" />
                </svg>
                <div className="relative z-10">
                  <p className="text-[11px] uppercase tracking-widest text-white/70">Vente</p>
                  <p className="font-semibold flex items-center gap-2 mt-1"><ShoppingCart className="size-4" /> Ouvrir la caisse</p>
                </div>
              </Card>
            </Link>
            <Link to="/products">
              <Card className="relative overflow-hidden p-5 hero-gradient text-white hover:shadow-glow transition-shadow h-full flex flex-col justify-end min-h-[92px]">
                <svg className="absolute inset-0 w-full h-full opacity-25" viewBox="0 0 200 100" preserveAspectRatio="xMidYMid slice" fill="none">
                  <rect x="20" y="15" width="30" height="24" rx="2" stroke="white" strokeWidth="2" />
                  <rect x="56" y="15" width="30" height="24" rx="2" stroke="white" strokeWidth="2" />
                  <rect x="20" y="45" width="30" height="24" rx="2" stroke="white" strokeWidth="2" />
                  <rect x="56" y="45" width="30" height="24" rx="2" stroke="white" strokeWidth="2" />
                  <path d="M10 10h170" stroke="white" strokeWidth="2" opacity="0.5" />
                  <path d="M10 80h170" stroke="white" strokeWidth="2" opacity="0.5" />
                  <path d="M120 20 L170 20 M120 35 L160 35 M120 50 L165 50 M120 65 L150 65" stroke="white" strokeWidth="2" opacity="0.55" />
                </svg>
                <div className="relative z-10">
                  <p className="text-[11px] uppercase tracking-widest text-white/70">Stock</p>
                  <p className="font-semibold flex items-center gap-2 mt-1"><Package className="size-4" /> Consulter l'inventaire</p>
                </div>
              </Card>
            </Link>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Stocks à surveiller</h3>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="table-head-dark text-left">
                  <tr>
                    <th className="px-4 py-2">Référence</th>
                    <th className="px-4 py-2">Produit</th>
                    <th className="px-4 py-2">Site</th>
                    <th className="px-4 py-2 text-right">Stock</th>
                    <th className="px-4 py-2 text-right">Seuil</th>
                    <th className="px-4 py-2">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {lowStockRows.slice(0, 8).map(r => (
                    <tr key={`${r.level.product_id}-${r.level.warehouse_id}`} className="hover:bg-muted/30">
                      <td className="px-4 py-2 font-mono text-xs">{r.product!.sku}</td>
                      <td className="px-4 py-2"><Link to="/products/$id" params={{ id: r.product!.id }} className="hover:text-accent">{r.product!.name}</Link></td>
                      <td className="px-4 py-2 text-muted-foreground">{r.warehouse?.name ?? "—"}</td>
                      <td className="px-4 py-2 text-right font-mono">{r.level.quantity}</td>
                      <td className="px-4 py-2 text-right font-mono text-muted-foreground">{r.product!.low_stock_threshold}</td>
                      <td className="px-4 py-2">
                        {r.level.quantity <= 0
                          ? <Badge variant="danger">Rupture</Badge>
                          : <Badge variant="warning">Sous seuil</Badge>}
                      </td>
                    </tr>
                  ))}
                  {lowStockRows.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Aucune alerte. Tous les stocks sont au-dessus du seuil.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <Card className="p-6 lg:col-span-2 overflow-hidden !p-0">
            <div className="flex items-center justify-between px-6 pt-6 pb-4">
              <h2 className="font-semibold">Derniers mouvements de stock</h2>
              <Link to="/movements"><Button variant="ghost" size="sm">Tout voir</Button></Link>
            </div>
            {moves.data && moves.data.length > 0 ? (
              <ul className="divide-y px-6 pb-2">
                {moves.data.map(m => {
                  const p = productsList.find(p => p.id === m.product_id);
                  const w = warehousesList.find(w => w.id === m.warehouse_id);
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
            <div className="grid grid-cols-2 gap-4 px-6 pb-6 pt-2 border-t mt-2 text-sm text-muted-foreground">
              <p>{productsList.length} référence{productsList.length > 1 ? "s" : ""} produit</p>
              <p className="text-right">{totalUnits.toLocaleString("fr-FR")} unités · {formatMoney(stockValue)}</p>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Warehouse className="size-4 text-primary" />
              <h2 className="font-semibold">Entrepôts actifs</h2>
            </div>
            <ul className="space-y-3">
              {warehousesList.filter(w => w.is_active).map(w => (
                <li key={w.id} className="flex items-center justify-between text-sm">
                  <span>{w.name}</span>
                  <span className="font-mono text-muted-foreground">
                    {levelsList.filter(l => l.warehouse_id === w.id).reduce((s, l) => s + l.quantity, 0)} u.
                  </span>
                </li>
              ))}
              {warehousesList.filter(w => w.is_active).length === 0 && (
                <p className="text-sm text-muted-foreground">Aucun entrepôt actif.</p>
              )}
            </ul>
          </Card>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Journal d'audit — dernières actions</h3>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="table-head-dark text-left">
                  <tr>
                    <th className="px-4 py-2">Horodatage</th>
                    <th className="px-4 py-2">Acteur</th>
                    <th className="px-4 py-2">Action</th>
                    <th className="px-4 py-2">Module</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(auditLog.data ?? []).map(a => (
                    <tr key={a.id} className="hover:bg-muted/30">
                      <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">{formatDate(a.created_at)}</td>
                      <td className="px-4 py-2">{a.actor_display_name ?? "—"}</td>
                      <td className="px-4 py-2">{a.action}</td>
                      <td className="px-4 py-2 text-muted-foreground">{a.entity}</td>
                    </tr>
                  ))}
                  {(auditLog.data ?? []).length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Aucune action enregistrée.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
          <div className="text-right">
            <Link to="/audit"><Button variant="ghost" size="sm">Voir le journal complet</Button></Link>
          </div>
        </section>
      </div>
    </div>
  );
}