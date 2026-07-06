import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { fetchProducts, fetchWarehouses } from "@/lib/stock";
import { declareDefective, SEVERITY_LABEL, DEF_CAT_LABEL, type Severity, type DefCategory } from "@/lib/workflows";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/defective/new")({
  head: () => ({ meta: [{ title: "Déclarer défectueux — StockFlow" }] }),
  component: NewDefective,
});

function NewDefective() {
  const nav = useNavigate();
  const products = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const wh = useQuery({ queryKey: ["warehouses"], queryFn: fetchWarehouses });
  const [product_id, setP] = useState("");
  const [warehouse_id, setW] = useState("");
  const [quantity, setQ] = useState(1);
  const [severity, setS] = useState<Severity>("mineur");
  const [category, setC] = useState<DefCategory>("casse");
  const [reason, setR] = useState("");
  const [loading, setL] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!product_id || !warehouse_id || !reason.trim()) return;
    setL(true);
    try {
      await declareDefective({ product_id, warehouse_id, quantity, severity, category, reason });
      toast.success(severity === "critique" ? "Envoyé pour confirmation admin" : "Déclaration enregistrée, stock mis à jour");
      nav({ to: "/defective" });
    } catch (e) { toast.error((e as Error).message); }
    finally { setL(false); }
  }

  return (
    <div className="p-4 lg:p-8 max-w-2xl">
      <h1 className="text-2xl font-semibold mb-6">Déclarer un défectueux</h1>
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
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Quantité</Label><Input type="number" min={1} value={quantity} onChange={e => setQ(parseInt(e.target.value) || 1)} /></div>
            <div><Label>Gravité</Label>
              <Select value={severity} onValueChange={v => setS(v as Severity)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(["mineur","majeur","critique"] as Severity[]).map(s => <SelectItem key={s} value={s}>{SEVERITY_LABEL[s]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Catégorie</Label>
              <Select value={category} onValueChange={v => setC(v as DefCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(Object.keys(DEF_CAT_LABEL) as DefCategory[]).map(c => <SelectItem key={c} value={c}>{DEF_CAT_LABEL[c]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Motif</Label><Textarea value={reason} onChange={e => setR(e.target.value)} required rows={3} /></div>
          <p className="text-xs text-muted-foreground">
            {severity === "critique"
              ? "Gravité critique : la sortie de stock attend confirmation admin."
              : "Sortie de stock appliquée immédiatement, notification aux admins."}
          </p>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => nav({ to: "/defective" })}>Annuler</Button>
            <Button type="submit" disabled={loading}>Déclarer</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
