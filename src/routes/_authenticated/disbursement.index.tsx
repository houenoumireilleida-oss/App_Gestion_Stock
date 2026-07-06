import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { fetchDisbursement, decideDisbursement, markDisbursementPaid, signedJustificationUrl,
  DISB_CAT_LABEL, STATUS_LABEL, STATUS_TONE } from "@/lib/workflows";
import { formatMoney, formatDate } from "@/lib/stock";
import { useMyRoles, hasAny } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Wallet, Plus, Check, X, FileText, Banknote } from "lucide-react";

export const Route = createFileRoute("/_authenticated/disbursement")({
  head: () => ({ meta: [{ title: "Décaissements — StockFlow" }] }),
  component: DisbPage,
});

function DisbPage() {
  const qc = useQueryClient();
  const { data: roles } = useMyRoles();
  const isAdmin = hasAny(roles, "admin");
  const rows = useQuery({ queryKey: ["disbursement"], queryFn: fetchDisbursement });
  const [decideId, setDid] = useState<string | null>(null);
  const [approve, setApp] = useState(true);
  const [note, setNote] = useState("");
  const [payId, setPayId] = useState<string | null>(null);
  const [method, setMethod] = useState("virement");

  async function doDecide() {
    if (!decideId) return;
    try {
      await decideDisbursement(decideId, approve, note);
      toast.success(approve ? "Approuvée" : "Rejetée");
      setDid(null); setNote("");
      qc.invalidateQueries({ queryKey: ["disbursement"] });
    } catch (e) { toast.error((e as Error).message); }
  }
  async function doPay() {
    if (!payId) return;
    try {
      await markDisbursementPaid(payId, method);
      toast.success("Marqué payé et archivé");
      setPayId(null);
      qc.invalidateQueries({ queryKey: ["disbursement"] });
    } catch (e) { toast.error((e as Error).message); }
  }
  async function openJustif(path: string) {
    try { const url = await signedJustificationUrl(path); window.open(url, "_blank"); }
    catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Wallet className="text-rose-600" /> Décaissements</h1>
          <p className="text-sm text-muted-foreground">Demande → justificatif → approbation admin → paiement → archivage.</p>
        </div>
        <Link to="/disbursement/new"><Button><Plus className="size-4" /> Nouvelle demande</Button></Link>
      </header>
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left"><tr>
            <th className="p-3">Date</th><th className="p-3">Bénéficiaire</th><th className="p-3">Catégorie</th>
            <th className="p-3">Description</th><th className="p-3 text-right">Montant</th>
            <th className="p-3">Justif.</th><th className="p-3">Statut</th><th className="p-3"></th>
          </tr></thead>
          <tbody className="divide-y">
            {(rows.data ?? []).map(r => (
              <tr key={r.id}>
                <td className="p-3 text-muted-foreground">{formatDate(r.created_at)}</td>
                <td className="p-3 font-medium">{r.beneficiary}</td>
                <td className="p-3">{DISB_CAT_LABEL[r.category]}</td>
                <td className="p-3 max-w-xs truncate">{r.description}</td>
                <td className="p-3 text-right font-mono">{formatMoney(r.amount)}</td>
                <td className="p-3">{r.justification_url ? (
                  <Button size="sm" variant="ghost" onClick={() => openJustif(r.justification_url!)}><FileText className="size-4" /></Button>
                ) : "—"}</td>
                <td className="p-3"><span className={`text-xs px-2 py-1 rounded ${STATUS_TONE[r.status]}`}>{STATUS_LABEL[r.status]}</span></td>
                <td className="p-3">
                  {isAdmin && r.status === "pending" && (
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="outline" onClick={() => { setDid(r.id); setApp(true); }}><Check className="size-4" /></Button>
                      <Button size="sm" variant="outline" onClick={() => { setDid(r.id); setApp(false); }}><X className="size-4" /></Button>
                    </div>
                  )}
                  {isAdmin && r.status === "approved" && (
                    <Button size="sm" onClick={() => setPayId(r.id)}><Banknote className="size-4" /> Payer</Button>
                  )}
                </td>
              </tr>
            ))}
            {(rows.data ?? []).length === 0 && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Aucune demande.</td></tr>}
          </tbody>
        </table>
      </Card>

      <Dialog open={decideId !== null} onOpenChange={o => { if (!o) setDid(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{approve ? "Approuver le décaissement" : "Rejeter le décaissement"}</DialogTitle></DialogHeader>
          <Textarea placeholder="Note (optionnelle)" value={note} onChange={e => setNote(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDid(null)}>Annuler</Button>
            <Button onClick={doDecide}>Valider</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={payId !== null} onOpenChange={o => { if (!o) setPayId(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Marquer comme payé</DialogTitle></DialogHeader>
          <Input placeholder="Méthode (virement, chèque, espèces…)" value={method} onChange={e => setMethod(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayId(null)}>Annuler</Button>
            <Button onClick={doPay}>Confirmer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
