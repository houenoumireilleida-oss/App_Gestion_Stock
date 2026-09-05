import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { fetchProducts, fetchStockLevels, fetchWarehouses, formatMoney } from "@/lib/stock";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Package, ArrowLeftRight, AlertTriangle, PackageMinus, Warehouse } from "lucide-react";
import { SectionHero } from "@/components/SectionHero";

export const Route = createFileRoute("/_authenticated/products/")({
  head: () => ({ meta: [{ title: "Produits — StockFlow" }] }),
  component: ProductsList,
});

const STOCK_LINKS = [
  { to: "/products", label: "Produits", icon: Package },
  { to: "/movements", label: "Mouvements", icon: ArrowLeftRight },
  { to: "/defective", label: "Défectueux", icon: AlertTriangle },
  { to: "/destocking", label: "Déstockage", icon: PackageMinus },
  { to: "/warehouses", label: "Entrepôts", icon: Warehouse },
];

function ProductsList() {
  const products = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const levels = useQuery({ queryKey: ["stock_levels"], queryFn: fetchStockLevels });
  const warehouses = useQuery({ queryKey: ["warehouses"], queryFn: fetchWarehouses });
  const [q, setQ] = useState("");

  const items = (products.data ?? []).filter(p =>
    !q || p.name.toLowerCase().includes(q.toLowerCase()) ||
    p.sku.toLowerCase().includes(q.toLowerCase()) ||
    (p.barcode ?? "").includes(q)
  );

  const stockByProduct = new Map<string, number>();
  for (const l of levels.data ?? []) {
    stockByProduct.set(l.product_id, (stockByProduct.get(l.product_id) ?? 0) + l.quantity);
  }

  // One row per (product, warehouse) — matches a real stock level record, not an aggregate
  const rows = (levels.data ?? [])
    .map(level => ({
      level,
      product: (products.data ?? []).find(p => p.id === level.product_id),
      warehouse: (warehouses.data ?? []).find(w => w.id === level.warehouse_id),
    }))
    .filter((r): r is { level: typeof r.level; product: NonNullable<typeof r.product>; warehouse: typeof r.warehouse } =>
      !!r.product && (!q ||
        r.product.name.toLowerCase().includes(q.toLowerCase()) ||
        r.product.sku.toLowerCase().includes(q.toLowerCase()) ||
        (r.product.barcode ?? "").includes(q)))
    .sort((a, b) => a.product.name.localeCompare(b.product.name));

  const stockValue = (levels.data ?? []).reduce((s, l) => {
    const p = (products.data ?? []).find(p => p.id === l.product_id);
    return s + (p ? p.cost * l.quantity : 0);
  }, 0);
  const belowCount = rows.filter(r => r.level.quantity > 0 && r.level.quantity <= r.product.low_stock_threshold).length;
  const outCount = rows.filter(r => r.level.quantity <= 0).length;

  return (
    <div>
      <SectionHero
        eyebrow="Stock"
        title="Produits, mouvements, entrepôts et suivi des seuils"
        links={STOCK_LINKS}
      />
      <div className="p-6 lg:p-10 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="size-11 rounded-xl bg-[var(--sidebar)] text-white grid place-items-center shrink-0">
            <Package className="size-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Produits</h1>
            <p className="text-sm text-muted-foreground">{items.length} référence{items.length > 1 ? "s" : ""}</p>
          </div>
        </div>
        <Link to="/products/new"><Button><Plus className="size-4 mr-1" /> Nouveau produit</Button></Link>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5 card-accent-top card-accent-navy">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Valeur du stock</p>
          <p className="text-2xl font-semibold mt-2 tracking-tight">{formatMoney(stockValue)}</p>
        </Card>
        <Card className="p-5 card-accent-top border-t-warning">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Sous seuil</p>
          <p className="text-2xl font-semibold mt-2 tracking-tight">{belowCount}</p>
        </Card>
        <Card className="p-5 card-accent-top card-accent-danger">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Ruptures</p>
          <p className="text-2xl font-semibold mt-2 tracking-tight">{outCount}</p>
        </Card>
      </div>

      <div className="relative max-w-md">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Rechercher par nom, SKU ou code-barres…"
          value={q} onChange={e => setQ(e.target.value)} />
      </div>

      {items.length === 0 ? (
        <Card className="p-12 text-center">
          <Package className="size-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium">Aucun produit</p>
          <p className="text-sm text-muted-foreground mt-1">Commencez par créer votre première référence.</p>
          <Link to="/products/new"><Button className="mt-4"><Plus className="size-4 mr-1" /> Créer un produit</Button></Link>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="table-head-dark text-left">
              <tr>
                <th className="px-4 py-2">Référence</th>
                <th className="px-4 py-2">Désignation</th>
                <th className="px-4 py-2">Catégorie</th>
                <th className="px-4 py-2">Site</th>
                <th className="px-4 py-2 text-right">Stock</th>
                <th className="px-4 py-2 text-right">Seuil</th>
                <th className="px-4 py-2">État</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map(({ level, product, warehouse }) => {
                const low = level.quantity <= product.low_stock_threshold;
                return (
                  <tr key={`${level.product_id}-${level.warehouse_id}`} className="hover:bg-muted/30">
                    <td className="px-4 py-2 font-mono text-xs">{product.sku}</td>
                    <td className="px-4 py-2">
                      <Link to="/products/$id" params={{ id: product.id }} className="font-medium hover:text-accent">{product.name}</Link>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{product.category ?? "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground">{warehouse?.name ?? "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-mono">
                      <span className={low ? "text-warning font-semibold" : ""}>{level.quantity}</span>
                      <span className="text-muted-foreground"> {product.unit}</span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums font-mono text-muted-foreground">{product.low_stock_threshold}</td>
                    <td className="px-4 py-2">
                      {!product.is_active ? <Badge variant="secondary">Inactif</Badge>
                       : level.quantity <= 0 ? <Badge variant="danger">Rupture</Badge>
                       : low ? <Badge variant="warning">Sous seuil</Badge>
                       : <Badge variant="success">Normal</Badge>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          {warehouses.data?.length === 0 && (
            <div className="p-4 bg-warning/10 text-sm text-warning-foreground border-t">
              Aucun entrepôt configuré. <Link to="/warehouses" className="underline">Créez-en un</Link> pour suivre vos stocks.
            </div>
          )}
        </Card>
      )}
      </div>
    </div>
  );
}