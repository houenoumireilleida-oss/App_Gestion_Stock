import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchDefective, decideDefective, setDefectiveTreatment, SEVERITY_LABEL, DEF_CAT_LABEL, STATUS_LABEL, STATUS_TONE, TREATMENT_LABEL, type DefTreatment } from "@/lib/workflows";
import { fetchProducts, fetchWarehouses, formatDate } from "@/lib/stock";
import { useMyRoles, hasAny } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { AlertTriangle, Plus, Check, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/defective/")({
  head: () => ({ meta: [{ title: "Défectueux — StockFlow" }] }),
  component: DefectivePage,
});

function DefectivePage() {
  const qc = useQueryClient();
  const { data: roles } = useMyRoles();
  const isAdmin = hasAny(roles, "admin");
  const items = useQuery({ queryKey: ["defective"], queryFn: fetchDefective });
  const products = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const wh = useQuery({ queryKey: ["warehouses"], queryFn: fetchWarehouses });
  const pMap = new Map((products.data ?? []).map(p => [p.id, p.name]));
  const wMap = new Map((wh.data ?? []).map(w => [w.id, w.name]));

  async function decide(id: string, ok: boolean) {
    try { await decideDefective(id, ok); toast.success(ok ? "Confirmé" : "Rejeté");
      qc.invalidateQueries({ queryKey: ["defective"] });
      qc.invalidateQueries({ queryKey: ["stock_levels"] });
    } catch (e) { toast.error((e as Error).message); }
  }
  async function applyTreatment(id: string, t: DefTreatment) {
    try { await setDefectiveTreatment(id, t); toast.success("Traitement enregistré");
      qc.invalidateQueries({ queryKey: ["defective"] });
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><AlertTriangle className="text-amber-600" /> Matériaux défectueux</h1>
          <p className="text-sm text-muted-foreground">Déclaration, catégorisation et impact stock automatique.</p>
        </div>
        <Link to="/defective/new"><Button><Plus className="size-4" /> Déclarer</Button></Link>
      </header>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="table-head-dark text-left">
            <tr>
              <th className="p-3">Date</th><th className="p-3">Produit</th><th className="p-3">Entrepôt</th>
              <th className="p-3 text-right">Qté</th><th className="p-3">Gravité</th><th className="p-3">Catégorie</th>
              <th className="p-3">Motif</th><th className="p-3">Statut</th><th className="p-3">Traitement</th><th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(items.data ?? []).map(it => (
              <tr key={it.id}>
                <td className="p-3 text-muted-foreground">{formatDate(it.created_at)}</td>
                <td className="p-3">{pMap.get(it.product_id) ?? "—"}</td>
                <td className="p-3">{wMap.get(it.warehouse_id) ?? "—"}</td>
                <td className="p-3 text-right font-mono">{it.quantity}</td>
                <td className="p-3">{SEVERITY_LABEL[it.severity]}</td>
                <td className="p-3">{DEF_CAT_LABEL[it.category]}</td>
                <td className="p-3 max-w-xs truncate">{it.reason}</td>
                <td className="p-3"><span className={`text-xs px-2 py-1 rounded ${STATUS_TONE[it.status]}`}>{STATUS_LABEL[it.status]}</span></td>
                <td className="p-3">
                  {(it.status === "applied" || it.status === "confirmed") ? (
                    it.treatment ? (
                      <span className="text-xs text-muted-foreground">{TREATMENT_LABEL[it.treatment]}</span>
                    ) : (
                      <Select onValueChange={v => applyTreatment(it.id, v as DefTreatment)}>
                        <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="Choisir…" /></SelectTrigger>
                        <SelectContent>
                          {(Object.keys(TREATMENT_LABEL) as DefTreatment[]).map(t =>
                            <SelectItem key={t} value={t}>{TREATMENT_LABEL[t]}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )
                  ) : "—"}
                </td>
                <td className="p-3">
                  {isAdmin && (it.status === "pending_confirmation" || it.status === "applied") && (
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="outline" onClick={() => decide(it.id, true)}><Check className="size-4" /></Button>
                      <Button size="sm" variant="outline" onClick={() => decide(it.id, false)}><X className="size-4" /></Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {(items.data ?? []).length === 0 && (
              <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">Aucune déclaration.</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </Card>
    </div>
  );
}
