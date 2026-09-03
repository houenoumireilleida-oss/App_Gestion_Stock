import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchReturns, decideReturn, STATUS_LABEL, STATUS_TONE } from "@/lib/workflows";
import { formatDate, formatMoney } from "@/lib/stock";
import { useMyRoles, hasAny } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Undo2, Plus, Check, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/returns/")({
  head: () => ({ meta: [{ title: "Retours clients — StockFlow" }] }),
  component: ReturnsPage,
});
function ReturnsPage() {
  const qc = useQueryClient();
  const { data: roles } = useMyRoles();
  const isAdmin = hasAny(roles, "admin");
  const rows = useQuery({ queryKey: ["returns"], queryFn: fetchReturns });
  async function decide(id: string, ok: boolean) {
    try {
      await decideReturn(id, ok);
      toast.success(ok ? "Retour approuvé, stock mis à jour" : "Rejeté");
      qc.invalidateQueries({ queryKey: ["returns"] });
      qc.invalidateQueries({ queryKey: ["stock_levels"] });
    } catch (e) { toast.error((e as Error).message); }
  }
  return (
    <div className="p-4 lg:p-8 space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Undo2 className="text-indigo-600" /> Retours clients</h1>
          <p className="text-sm text-muted-foreground">Réintégration stock ou passage en défectueux + remboursement.</p>
        </div>
        <Link to="/returns/new"><Button><Plus className="size-4" /> Nouveau retour</Button></Link>
      </header>
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="table-head-dark text-left"><tr>
            <th className="p-3">Date</th><th className="p-3">Vente</th><th className="p-3">Destination</th>
            <th className="p-3">Remboursement</th><th className="p-3 text-right">Montant</th>
            <th className="p-3">Motif</th><th className="p-3">Statut</th><th className="p-3"></th>
          </tr></thead>
          <tbody className="divide-y">
            {(rows.data ?? []).map(r => (
              <tr key={r.id}>
                <td className="p-3 text-muted-foreground">{formatDate(r.created_at)}</td>
                <td className="p-3 font-mono text-xs">{r.sale_id.slice(0,8)}</td>
                <td className="p-3">{r.destination === "stock" ? "Stock" : "Défectueux"}</td>
                <td className="p-3">{r.refund_type === "cash" ? "Espèces" : r.refund_type === "store_credit" ? "Avoir" : "Aucun"}</td>
                <td className="p-3 text-right font-mono">{formatMoney(r.refund_amount)}</td>
                <td className="p-3 max-w-xs truncate">{r.reason}</td>
                <td className="p-3"><span className={`text-xs px-2 py-1 rounded ${STATUS_TONE[r.status]}`}>{STATUS_LABEL[r.status]}</span></td>
                <td className="p-3">
                  {isAdmin && r.status === "pending" && (
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="outline" onClick={() => decide(r.id, true)}><Check className="size-4" /></Button>
                      <Button size="sm" variant="outline" onClick={() => decide(r.id, false)}><X className="size-4" /></Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {(rows.data ?? []).length === 0 && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Aucun retour.</td></tr>}
          </tbody>
        </table>
        </div>
      </Card>
    </div>
  );
}
