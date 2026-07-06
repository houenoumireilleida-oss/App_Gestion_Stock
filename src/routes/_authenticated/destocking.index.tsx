import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { fetchDestocking, decideDestocking, STATUS_LABEL, STATUS_TONE } from "@/lib/workflows";
import { fetchProducts, fetchWarehouses, formatDate } from "@/lib/stock";
import { useMyRoles, hasAny } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { PackageMinus, Plus, Check, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/destocking/")({
  head: () => ({ meta: [{ title: "Déstockage — StockFlow" }] }),
  component: DestockingPage,
});

function DestockingPage() {
  const qc = useQueryClient();
  const { data: roles } = useMyRoles();
  const isAdmin = hasAny(roles, "admin");
  const rows = useQuery({ queryKey: ["destocking"], queryFn: fetchDestocking });
  const products = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const wh = useQuery({ queryKey: ["warehouses"], queryFn: fetchWarehouses });
  const pMap = new Map((products.data ?? []).map(p => [p.id, p.name]));
  const wMap = new Map((wh.data ?? []).map(w => [w.id, w.name]));
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [approve, setApprove] = useState(true);
  const [note, setNote] = useState("");

  async function submit() {
    if (!decidingId) return;
    try {
      await decideDestocking(decidingId, approve, note);
      toast.success(approve ? "Approuvée, stock mis à jour" : "Rejetée");
      setDecidingId(null); setNote("");
      qc.invalidateQueries({ queryKey: ["destocking"] });
      qc.invalidateQueries({ queryKey: ["stock_levels"] });
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><PackageMinus className="text-orange-600" /> Déstockage</h1>
          <p className="text-sm text-muted-foreground">Demande → approbation admin → sortie de stock automatique.</p>
        </div>
        <Link to="/destocking/new"><Button><Plus className="size-4" /> Nouvelle demande</Button></Link>
      </header>
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left"><tr>
            <th className="p-3">Date</th><th className="p-3">Produit</th><th className="p-3">Entrepôt</th>
            <th className="p-3 text-right">Qté</th><th className="p-3">Motif</th><th className="p-3">Statut</th><th className="p-3"></th>
          </tr></thead>
          <tbody className="divide-y">
            {(rows.data ?? []).map(r => (
              <tr key={r.id}>
                <td className="p-3 text-muted-foreground">{formatDate(r.created_at)}</td>
                <td className="p-3">{pMap.get(r.product_id) ?? "—"}</td>
                <td className="p-3">{wMap.get(r.warehouse_id) ?? "—"}</td>
                <td className="p-3 text-right font-mono">{r.quantity}</td>
                <td className="p-3 max-w-xs truncate">{r.reason}</td>
                <td className="p-3"><span className={`text-xs px-2 py-1 rounded ${STATUS_TONE[r.status]}`}>{STATUS_LABEL[r.status]}</span></td>
                <td className="p-3">
                  {isAdmin && r.status === "pending" && (
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="outline" onClick={() => { setDecidingId(r.id); setApprove(true); }}><Check className="size-4" /></Button>
                      <Button size="sm" variant="outline" onClick={() => { setDecidingId(r.id); setApprove(false); }}><X className="size-4" /></Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {(rows.data ?? []).length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Aucune demande.</td></tr>}
          </tbody>
        </table>
      </Card>
      <Dialog open={decidingId !== null} onOpenChange={o => { if (!o) setDecidingId(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{approve ? "Approuver la demande" : "Rejeter la demande"}</DialogTitle></DialogHeader>
          <Textarea placeholder="Note (optionnelle)" value={note} onChange={e => setNote(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecidingId(null)}>Annuler</Button>
            <Button onClick={submit}>Valider</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
