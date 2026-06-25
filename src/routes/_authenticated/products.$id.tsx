import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchProducts, fetchStockLevels, fetchWarehouses, formatMoney, type Product } from "@/lib/stock";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/products/$id")({
  head: () => ({ meta: [{ title: "Produit — StockFlow" }] }),
  component: ProductDetail,
});

function ProductDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const products = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const warehouses = useQuery({ queryKey: ["warehouses"], queryFn: fetchWarehouses });
  const levels = useQuery({ queryKey: ["stock_levels"], queryFn: fetchStockLevels });
  const product = products.data?.find(p => p.id === id);
  const [form, setForm] = useState<Partial<Product> | null>(null);

  useEffect(() => { if (product && !form) setForm(product); }, [product, form]);

  const update = useMutation({
    mutationFn: async () => {
      if (!form) return;
      const { error } = await supabase.from("products").update({
        name: form.name, sku: form.sku, barcode: form.barcode || null,
        category: form.category || null, description: form.description || null,
        unit: form.unit, price: Number(form.price), cost: Number(form.cost),
        vat_rate: Number(form.vat_rate), low_stock_threshold: Number(form.low_stock_threshold),
        is_active: form.is_active ?? true,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produit mis à jour");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produit supprimé");
      navigate({ to: "/products" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!product || !form) {
    return <div className="p-10 text-muted-foreground">Chargement…</div>;
  }

  const productLevels = (levels.data ?? []).filter(l => l.product_id === id);
  const totalStock = productLevels.reduce((s, l) => s + l.quantity, 0);

  const set = (k: keyof Product) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f!, [k]: e.target.value }));

  return (
    <div className="p-6 lg:p-10 max-w-5xl space-y-6">
      <Link to="/products" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className="size-4" /> Retour aux produits
      </Link>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{product.name}</h1>
          <p className="text-muted-foreground mt-1 font-mono text-sm">{product.sku}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Stock total</p>
          <p className="text-2xl font-semibold tabular-nums">{totalStock} <span className="text-sm text-muted-foreground">{product.unit}</span></p>
        </div>
      </header>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="p-6 lg:col-span-2">
          <h2 className="font-semibold mb-4">Informations produit</h2>
          <form onSubmit={e => { e.preventDefault(); update.mutate(); }} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <F label="Nom"><Input value={form.name ?? ""} onChange={set("name")} /></F>
              <F label="SKU"><Input value={form.sku ?? ""} onChange={set("sku")} /></F>
              <F label="Code-barres"><Input value={form.barcode ?? ""} onChange={set("barcode")} /></F>
              <F label="Catégorie"><Input value={form.category ?? ""} onChange={set("category")} /></F>
            </div>
            <F label="Description"><Textarea rows={3} value={form.description ?? ""} onChange={set("description")} /></F>
            <div className="grid sm:grid-cols-3 gap-4">
              <F label="Unité"><Input value={form.unit ?? ""} onChange={set("unit")} /></F>
              <F label="Prix HT (€)"><Input type="number" step="0.01" value={form.price ?? 0} onChange={set("price")} /></F>
              <F label="Coût (€)"><Input type="number" step="0.01" value={form.cost ?? 0} onChange={set("cost")} /></F>
              <F label="TVA (%)"><Input type="number" step="0.1" value={form.vat_rate ?? 0} onChange={set("vat_rate")} /></F>
              <F label="Seuil d'alerte"><Input type="number" value={form.low_stock_threshold ?? 0} onChange={set("low_stock_threshold")} /></F>
            </div>
            <div className="flex justify-between pt-2">
              <Button type="button" variant="ghost" className="text-destructive hover:text-destructive"
                onClick={() => { if (confirm("Supprimer ce produit ?")) del.mutate(); }}>
                <Trash2 className="size-4 mr-1" /> Supprimer
              </Button>
              <Button type="submit" disabled={update.isPending}>{update.isPending ? "…" : "Enregistrer"}</Button>
            </div>
          </form>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold mb-4">Stock par entrepôt</h2>
          {warehouses.data?.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun entrepôt. <Link className="text-accent hover:underline" to="/warehouses">En créer un</Link>.</p>
          ) : (
            <ul className="space-y-3">
              {(warehouses.data ?? []).map(w => {
                const lvl = productLevels.find(l => l.warehouse_id === w.id);
                return (
                  <li key={w.id} className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium">{w.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{w.code}</p>
                    </div>
                    <span className={`tabular-nums font-mono ${
                      (lvl?.quantity ?? 0) <= product.low_stock_threshold ? "text-warning font-semibold" : ""
                    }`}>{lvl?.quantity ?? 0}</span>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-4 pt-4 border-t text-sm space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Valeur stock</span><span className="font-mono">{formatMoney(product.cost * totalStock)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Marge unitaire</span><span className="font-mono">{formatMoney(product.price - product.cost)}</span></div>
          </div>
          <Link to="/movements/new" search={{ productId: id }} className="block mt-4">
            <Button variant="outline" className="w-full">Enregistrer un mouvement</Button>
          </Link>
        </Card>
      </div>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}
