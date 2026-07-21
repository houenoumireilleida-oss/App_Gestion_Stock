import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { fetchProducts, fetchWarehouses } from "@/lib/stock";
import { createDestocking } from "@/lib/workflows";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/destocking/new")({
  head: () => ({ meta: [{ title: "Nouveau déstockage — StockFlow" }] }),
  component: NewDestocking,
});
function NewDestocking() {
  const nav = useNavigate();
  const products = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const wh = useQuery({ queryKey: ["warehouses"], queryFn: fetchWarehouses });
  const [product_id, setP] = useState("");
  const [warehouse_id, setW] = useState("");
  const [quantity, setQ] = useState(1);
  const [reason, setR] = useState("");
  const [loading, setL] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!product_id || !warehouse_id || !reason.trim()) return;
    setL(true);
    try {
      await createDestocking({ product_id, warehouse_id, quantity, reason });
      toast.success("Demande envoyée à l'admin");
      nav({ to: "/destocking" });
    } catch (e) { toast.error((e as Error).message); }
    finally { setL(false); }
  }
  return (
    <div className="p-4 lg:p-8 max-w-2xl">
      <h1 className="text-2xl font-semibold mb-6">Nouvelle demande de déstockage</h1>
      <Card className="p-6">
        <form onSubmit={submit} className="space-y-4">
          <div><Label>Produit</Label>
            <Select value={product_id} onValueChange={setP}>
              <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
              <SelectContent>{(products.data ?? []).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Entrepôt</Label>
            <Select value={warehouse_id} onValueChange={setW}>
              <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
              <SelectContent>{(wh.data ?? []).map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Quantité</Label><Input type="number" min={1} value={quantity} onChange={e => setQ(parseInt(e.target.value) || 1)} /></div>
          <div><Label>Motif</Label><Textarea value={reason} onChange={e => setR(e.target.value)} required rows={3} /></div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => nav({ to: "/destocking" })}>Annuler</Button>
            <Button type="submit" disabled={loading}>Soumettre</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
