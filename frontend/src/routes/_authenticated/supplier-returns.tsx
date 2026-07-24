import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { fetchSupplierReturns, createSupplierReturn, fetchSuppliers } from "@/lib/purchasing";
import { fetchProducts, formatDate } from "@/lib/stock";
import { fetchDefective } from "@/lib/workflows";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { PackageX, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/supplier-returns")({
  head: () => ({ meta: [{ title: "Retours fournisseurs — StockFlow" }] }),
  component: Page,
});

function Page() {
  const qc = useQueryClient();
  const rows = useQuery({ queryKey: ["supplier_returns"], queryFn: fetchSupplierReturns });
  const sup = useQuery({ queryKey: ["suppliers"], queryFn: fetchSuppliers });
  const prod = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const defective = useQuery({ queryKey: ["defective"], queryFn: fetchDefective });
  const sMap = new Map((sup.data ?? []).map(s => [s.id, s.name]));
  const pMap = new Map((prod.data ?? []).map(p => [p.id, p.name]));

  const [open, setOpen] = useState(false);
  const [supplier_id, setS] = useState("");
  const [product_id, setP] = useState("");
  const [defective_id, setD] = useState<string>("");
  const [quantity, setQ] = useState(1);
  const [reason, setR] = useState("");

  const eligibleDefective = (defective.data ?? []).filter(d =>
    (d.status === "applied" || d.status === "confirmed") && d.treatment === "retour_fournisseur"
  );

  async function submit() {
    if (!supplier_id || !product_id || !reason.trim()) { toast.error("Champs requis"); return; }
    try {
      await createSupplierReturn({
        supplier_id, product_id, quantity, reason,
        defective_id: defective_id || null,
      });
      toast.success("Retour fournisseur créé");
      setOpen(false); setS(""); setP(""); setD(""); setQ(1); setR("");
      qc.invalidateQueries({ queryKey: ["supplier_returns"] });
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><PackageX className="text-purple-600" /> Retours fournisseurs</h1>
          <p className="text-sm text-muted-foreground">Renvoi de marchandises défectueuses au fournisseur.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="size-4" /> Nouveau retour</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Retour fournisseur</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Fournisseur</Label>
                <Select value={supplier_id} onValueChange={setS}>
                  <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>{(sup.data ?? []).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Produit</Label>
                <Select value={product_id} onValueChange={setP}>
                  <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>{(prod.data ?? []).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Défectueux lié (optionnel)</Label>
                <Select value={defective_id} onValueChange={setD}>
                  <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                  <SelectContent>{eligibleDefective.map(d =>
                    <SelectItem key={d.id} value={d.id}>{pMap.get(d.product_id) ?? "?"} × {d.quantity} — {d.reason.slice(0,30)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Quantité</Label>
                <Input type="number" min={1} value={quantity} onChange={e => setQ(parseInt(e.target.value) || 1)} />
              </div>
              <div><Label>Motif</Label>
                <Textarea value={reason} onChange={e => setR(e.target.value)} rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button onClick={submit}>Créer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left"><tr>
            <th className="p-3">Référence</th><th className="p-3">Date</th>
            <th className="p-3">Fournisseur</th><th className="p-3">Produit</th>
            <th className="p-3 text-right">Qté</th><th className="p-3">Motif</th><th className="p-3">Statut</th>
          </tr></thead>
          <tbody className="divide-y">
            {(rows.data ?? []).map(r => (
              <tr key={r.id}>
                <td className="p-3 font-mono text-xs">{r.reference}</td>
                <td className="p-3 text-muted-foreground">{formatDate(r.created_at)}</td>
                <td className="p-3">{sMap.get(r.supplier_id) ?? "—"}</td>
                <td className="p-3">{pMap.get(r.product_id) ?? "—"}</td>
                <td className="p-3 text-right font-mono">{r.quantity}</td>
                <td className="p-3 max-w-xs truncate">{r.reason}</td>
                <td className="p-3"><span className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-900">{r.status}</span></td>
              </tr>
            ))}
            {(rows.data ?? []).length === 0 && (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Aucun retour fournisseur.</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </Card>
    </div>
  );
}
