import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchSuppliers } from "@/lib/purchasing";
import { fetchWarehouses, fetchProducts, formatMoney } from "@/lib/stock";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { ArrowLeft, Trash2, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/purchase-orders/new")({
  head: () => ({ meta: [{ title: "Nouvelle commande — StockFlow" }] }),
  component: NewPO,
});

type Line = { product_id: string; ordered_qty: number; unit_cost: number };

function NewPO() {
  const navigate = useNavigate();
  const suppliers = useQuery({ queryKey: ["suppliers"], queryFn: fetchSuppliers });
  const warehouses = useQuery({ queryKey: ["warehouses"], queryFn: fetchWarehouses });
  const products = useQuery({ queryKey: ["products"], queryFn: fetchProducts });

  const [supplierId, setSupplierId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [expectedAt, setExpectedAt] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [saving, setSaving] = useState(false);

  const total = useMemo(() => lines.reduce((s, l) => s + l.ordered_qty * l.unit_cost, 0), [lines]);

  function addLine() { setLines(prev => [...prev, { product_id: "", ordered_qty: 1, unit_cost: 0 }]); }
  function update(i: number, patch: Partial<Line>) { setLines(prev => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l)); }
  function remove(i: number) { setLines(prev => prev.filter((_, idx) => idx !== i)); }

  async function save(asOrdered: boolean) {
    if (!supplierId || !warehouseId || lines.length === 0) { toast.error("Fournisseur, entrepôt et lignes requis"); return; }
    if (lines.some(l => !l.product_id || l.ordered_qty <= 0)) { toast.error("Lignes incomplètes"); return; }
    setSaving(true);
    try {
      const ref = "PO-" + new Date().toISOString().slice(0, 10).replace(/-/g, "") + "-" + Math.floor(Math.random() * 9999).toString().padStart(4, "0");
      const { data: po, error } = await supabase.from("purchase_orders").insert({
        reference: ref, supplier_id: supplierId, warehouse_id: warehouseId,
        expected_at: expectedAt || null, notes: notes || null,
        status: asOrdered ? "ordered" : "draft",
      }).select().single();
      if (error) throw error;
      const { error: e2 } = await supabase.from("purchase_order_items").insert(
        lines.map(l => ({ po_id: po.id, product_id: l.product_id, ordered_qty: l.ordered_qty, unit_cost: l.unit_cost }))
      );
      if (e2) throw e2;
      toast.success("Commande créée");
      navigate({ to: "/purchase-orders/$id", params: { id: po.id } });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally { setSaving(false); }
  }

  return (
    <div className="p-6 lg:p-10 space-y-6 max-w-5xl">
      <Link to="/purchase-orders" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"><ArrowLeft className="size-4" /> Retour</Link>
      <h1 className="text-3xl font-semibold tracking-tight">Nouvelle commande fournisseur</h1>

      <Card className="p-6 space-y-4">
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <Label>Fournisseur *</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
              <SelectContent>{(suppliers.data ?? []).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Entrepôt de réception *</Label>
            <Select value={warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
              <SelectContent>{(warehouses.data ?? []).map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Date prévue</Label>
            <Input type="date" value={expectedAt} onChange={e => setExpectedAt(e.target.value)} />
          </div>
        </div>
        <div>
          <Label>Notes</Label>
          <Textarea value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
      </Card>

      <Card className="p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Lignes</h2>
          <Button variant="outline" size="sm" onClick={addLine}><Plus className="size-4" /> Ajouter</Button>
        </div>
        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_5rem_7rem_2rem] gap-2 items-end">
              <Select value={l.product_id} onValueChange={v => update(i, { product_id: v, unit_cost: (products.data ?? []).find(p => p.id === v)?.cost ?? 0 })}>
                <SelectTrigger><SelectValue placeholder="Produit" /></SelectTrigger>
                <SelectContent>{(products.data ?? []).map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku})</SelectItem>)}</SelectContent>
              </Select>
              <Input type="number" min={1} value={l.ordered_qty} onChange={e => update(i, { ordered_qty: parseInt(e.target.value) || 1 })} />
              <Input type="number" step="1" min={0} value={l.unit_cost} onChange={e => update(i, { unit_cost: parseFloat(e.target.value) || 0 })} placeholder="Coût FCFA" />
              <Button variant="ghost" size="icon" onClick={() => remove(i)} className="text-destructive"><Trash2 className="size-4" /></Button>
            </div>
          ))}
          {lines.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Aucune ligne</p>}
        </div>
        <div className="flex justify-between text-lg font-semibold border-t pt-3"><span>Total HT estimé</span><span className="font-mono">{formatMoney(total)}</span></div>
      </Card>

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={() => save(false)} disabled={saving}>Enregistrer brouillon</Button>
        <Button onClick={() => save(true)} disabled={saving}>Passer commande</Button>
      </div>
    </div>
  );
}
