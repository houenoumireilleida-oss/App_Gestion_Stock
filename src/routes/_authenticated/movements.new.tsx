import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { fetchProducts, fetchWarehouses, type MovementType } from "@/lib/stock";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

const search = z.object({ productId: z.string().optional() });

export const Route = createFileRoute("/_authenticated/movements/new")({
  head: () => ({ meta: [{ title: "Nouveau mouvement — StockFlow" }] }),
  validateSearch: search,
  component: NewMovement,
});

function NewMovement() {
  const { productId } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const products = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const warehouses = useQuery({ queryKey: ["warehouses"], queryFn: fetchWarehouses });

  const [type, setType] = useState<MovementType>("in");
  const [product, setProduct] = useState(productId ?? "");
  const [warehouse, setWarehouse] = useState("");
  const [destination, setDestination] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");

  const mut = useMutation({
    mutationFn: async () => {
      const qty = Number(quantity);
      if (!product || !warehouse || !qty || qty <= 0) throw new Error("Champs requis manquants");
      if (type === "transfer" && (!destination || destination === warehouse))
        throw new Error("Sélectionnez un entrepôt de destination différent");

      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("stock_movements").insert({
        product_id: product,
        warehouse_id: warehouse,
        destination_warehouse_id: type === "transfer" ? destination : null,
        type, quantity: qty,
        reason: reason.trim() || null,
        reference: reference.trim() || null,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["movements"] });
      qc.invalidateQueries({ queryKey: ["stock_levels"] });
      toast.success("Mouvement enregistré");
      navigate({ to: "/movements" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const noWarehouse = (warehouses.data ?? []).length === 0;
  const noProduct = (products.data ?? []).length === 0;

  return (
    <div className="p-6 lg:p-10 max-w-2xl">
      <Link to="/movements" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4">
        <ArrowLeft className="size-4" /> Retour aux mouvements
      </Link>
      <h1 className="text-3xl font-semibold tracking-tight mb-6">Nouveau mouvement</h1>

      {(noWarehouse || noProduct) && (
        <Card className="p-4 mb-4 bg-warning/10 text-sm">
          {noProduct && <p>Aucun produit. <Link to="/products/new" className="underline">Créer un produit</Link>.</p>}
          {noWarehouse && <p>Aucun entrepôt. <Link to="/warehouses" className="underline">Créer un entrepôt</Link>.</p>}
        </Card>
      )}

      <Card className="p-6">
        <form onSubmit={e => { e.preventDefault(); mut.mutate(); }} className="space-y-4">
          <div className="space-y-2">
            <Label>Type de mouvement</Label>
            <Select value={type} onValueChange={v => setType(v as MovementType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="in">Entrée (réception)</SelectItem>
                <SelectItem value="out">Sortie (vente, perte)</SelectItem>
                <SelectItem value="adjustment">Ajustement (inventaire ±)</SelectItem>
                <SelectItem value="transfer">Transfert entre entrepôts</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Produit *</Label>
            <Select value={product} onValueChange={setProduct}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un produit" /></SelectTrigger>
              <SelectContent>
                {(products.data ?? []).map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name} — {p.sku}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{type === "transfer" ? "Entrepôt source *" : "Entrepôt *"}</Label>
              <Select value={warehouse} onValueChange={setWarehouse}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>
                  {(warehouses.data ?? []).map(w => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {type === "transfer" && (
              <div className="space-y-2">
                <Label>Entrepôt destination *</Label>
                <Select value={destination} onValueChange={setDestination}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    {(warehouses.data ?? []).filter(w => w.id !== warehouse).map(w => (
                      <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Quantité *</Label>
              <Input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} />
              {type === "adjustment" && (
                <p className="text-xs text-muted-foreground">Pour décrémenter, utilisez une valeur négative dans le motif et une sortie.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Référence (BL, commande…)</Label>
              <Input value={reference} onChange={e => setReference(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Motif / Note</Label>
            <Textarea rows={2} value={reason} onChange={e => setReason(e.target.value)}
              placeholder="Réception fournisseur, vente caisse, casse, inventaire…" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Link to="/movements"><Button type="button" variant="outline">Annuler</Button></Link>
            <Button type="submit" disabled={mut.isPending}>{mut.isPending ? "…" : "Enregistrer le mouvement"}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
