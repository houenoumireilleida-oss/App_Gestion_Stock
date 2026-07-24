import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { fetchProducts, fetchStockLevels, fetchWarehouses, formatMoney } from "@/lib/stock";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Package } from "lucide-react";

export const Route = createFileRoute("/_authenticated/products/")({
  head: () => ({ meta: [{ title: "Produits — StockFlow" }] }),
  component: ProductsList,
});

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

  return (
    <div className="p-6 lg:p-10 space-y-6 max-w-7xl">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Produits</h1>
          <p className="text-muted-foreground mt-1">{items.length} référence{items.length > 1 ? "s" : ""}</p>
        </div>
        <Link to="/products/new"><Button><Plus className="size-4 mr-1" /> Nouveau produit</Button></Link>
      </header>

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
            <thead className="bg-muted/50 text-muted-foreground">
              <tr className="text-left">
                <th className="px-4 py-3 font-medium">Produit</th>
                <th className="px-4 py-3 font-medium">SKU</th>
                <th className="px-4 py-3 font-medium text-right">Prix</th>
                <th className="px-4 py-3 font-medium text-right">Stock</th>
                <th className="px-4 py-3 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map(p => {
                const qty = stockByProduct.get(p.id) ?? 0;
                const low = qty <= p.low_stock_threshold;
                return (
                  <tr key={p.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link to="/products/$id" params={{ id: p.id }} className="font-medium hover:text-accent">{p.name}</Link>
                      {p.category && <div className="text-xs text-muted-foreground">{p.category}</div>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{p.sku}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatMoney(p.price)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-mono">
                      <span className={low ? "text-warning font-semibold" : ""}>{qty}</span>
                      <span className="text-muted-foreground"> {p.unit}</span>
                    </td>
                    <td className="px-4 py-3">
                      {!p.is_active ? <Badge variant="secondary">Inactif</Badge>
                       : low ? <Badge className="bg-warning text-warning-foreground hover:bg-warning">Seuil bas</Badge>
                       : <Badge variant="outline" className="border-success text-success">OK</Badge>}
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
  );
}
