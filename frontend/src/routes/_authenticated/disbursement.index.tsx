import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { fetchDisbursement, decideDisbursement, markDisbursementPaid, signedJustificationUrl,
  DISB_CAT_LABEL, STATUS_LABEL } from "@/lib/workflows";
import { formatMoney, formatDate } from "@/lib/stock";
import { useMyRoles, hasAny } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { SectionHero } from "@/components/SectionHero";
import { toast } from "sonner";
import { Wallet, Plus, FileText, Banknote, PiggyBank, BarChart3, Paperclip } from "lucide-react";

export const Route = createFileRoute("/_authenticated/disbursement/")({
  head: () => ({ meta: [{ title: "Décaissements — StockFlow" }] }),
  component: DisbPage,
});

const FINANCE_LINKS = [
  { to: "/disbursement", label: "Décaissements", icon: Banknote },
  { to: "/treasury", label: "Trésorerie", icon: PiggyBank },
  { to: "/finance-reports", label: "Rapports", icon: BarChart3 },
];

function statusVariant(status: string): "warning" | "success" | "danger" {
  if (status === "approved" || status === "paid") return "success";
  if (status === "rejected") return "danger";
  return "warning";
}

function DisbPage() {
  const qc = useQueryClient();
  const { data: roles } = useMyRoles();
  const isAdmin = hasAny(roles, "admin");
  const rows = useQuery({ queryKey: ["disbursement"], queryFn: fetchDisbursement });
  const [note, setNote] = useState("");
  const [partialAmt, setPartialAmt] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [method, setMethod] = useState("virement");

  const list = rows.data ?? [];
  const pending = list.filter(r => r.status === "pending");
  const pendingTotal = pending.reduce((s, r) => s + r.amount, 0);
  const now = new Date();
  const paidThisMonth = list.filter(r => r.status === "paid" && new Date(r.created_at).getMonth() === now.getMonth()
    && new Date(r.created_at).getFullYear() === now.getFullYear()).reduce((s, r) => s + r.amount, 0);

  const dossier = list.find(r => r.id === selectedId) ?? pending[0] ?? null;

  async function doDecide(approve: boolean) {
    if (!dossier) return;
    try {
      const partial = partialAmt.trim() ? parseFloat(partialAmt) : null;
      await decideDisbursement(dossier.id, approve, note, partial);
      toast.success(approve ? "Approuvée" : "Rejetée");
      setNote(""); setPartialAmt("");
      qc.invalidateQueries({ queryKey: ["disbursement"] });
    } catch (e) { toast.error((e as Error).message); }
  }
  async function doPay() {
    if (!dossier) return;
    try {
      await markDisbursementPaid(dossier.id, method);
      toast.success("Exécution confirmée");
      qc.invalidateQueries({ queryKey: ["disbursement"] });
    } catch (e) { toast.error((e as Error).message); }
  }
  async function openJustif(path: string) {
    try { const url = await signedJustificationUrl(path); window.open(url, "_blank"); }
    catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div>
      <SectionHero
        eyebrow="Finances"
        title="Décaissements sous approbation, trésorerie et rapports"
        links={FINANCE_LINKS}
      />
      <div className="p-6 lg:p-10 space-y-6">
        <header className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span className="size-11 rounded-xl bg-[var(--sidebar)] text-white grid place-items-center shrink-0">
              <Wallet className="size-5" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Décaissements</h1>
              <p className="text-sm text-muted-foreground">{pending.length} demande{pending.length > 1 ? "s" : ""} en attente</p>
            </div>
          </div>
          <Link to="/disbursement/new"><Button><Plus className="size-4" /> Nouvelle demande</Button></Link>
        </header>

        {dossier && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Dossier à examiner</h2>
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2 overflow-hidden">
                <div className="header-gradient text-white p-5 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-widest text-white/70">Demande DEC-{dossier.id.slice(0, 4).toUpperCase()}</p>
                    <p className="text-xl font-semibold mt-0.5">{formatMoney(dossier.amount)}</p>
                  </div>
                  <Badge variant={statusVariant(dossier.status)}>{STATUS_LABEL[dossier.status]}</Badge>
                </div>
                <div className="p-5 space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Bénéficiaire</p>
                      <p className="font-medium">{dossier.beneficiary}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Catégorie</p>
                      <p className="font-medium">{DISB_CAT_LABEL[dossier.category]}</p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Motif</p>
                      <p>{dossier.description}</p>
                    </div>
                  </div>

                  {dossier.justification_url && (
                    <div>
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Justificatif</p>
                      <Button size="sm" variant="outline" onClick={() => openJustif(dossier.justification_url!)}>
                        <Paperclip className="size-3.5" /> Voir le justificatif
                      </Button>
                    </div>
                  )}

                  {isAdmin && dossier.status === "pending" && (
                    <>
                      <div className="space-y-2">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Montant approuvé (optionnel, max {formatMoney(dossier.amount)})</p>
                        <Input type="number" step="1" min={0} max={dossier.amount}
                          placeholder={`Défaut : ${formatMoney(dossier.amount)}`}
                          value={partialAmt} onChange={e => setPartialAmt(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Commentaire de l'administrateur</label>
                        <Textarea placeholder="Motiver l'approbation ou le rejet…" value={note} onChange={e => setNote(e.target.value)} />
                      </div>
                      <div className="flex gap-2">
                        <Button className="bg-success hover:bg-success/90" onClick={() => doDecide(true)}>Approuver</Button>
                        <Button variant="destructive" onClick={() => doDecide(false)}>Rejeter</Button>
                      </div>
                    </>
                  )}

                  {isAdmin && dossier.status === "approved" && (
                    <div className="space-y-2 pt-2 border-t">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Confirmer l'exécution</p>
                      <div className="flex gap-2">
                        <Input placeholder="Méthode (virement, chèque, espèces…)" value={method} onChange={e => setMethod(e.target.value)} />
                        <Button onClick={doPay}><Banknote className="size-4" /> Confirmer</Button>
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              <div className="grid gap-4 content-start">
                <Card className="p-5 card-accent-top card-accent-teal">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Payé ce mois</p>
                  <p className="text-2xl font-semibold mt-2 tracking-tight">{formatMoney(paidThisMonth)}</p>
                </Card>
                <Card className="p-5 card-accent-top border-t-warning">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">En attente</p>
                  <p className="text-2xl font-semibold mt-2 tracking-tight">{formatMoney(pendingTotal)}</p>
                </Card>
                <Card className="p-5 border-l-4 border-l-destructive">
                  <p className="text-xs font-semibold uppercase tracking-wide text-destructive mb-2">Règles non contournables</p>
                  <ul className="space-y-1.5 text-sm text-foreground/90 list-disc list-inside">
                    <li>Aucun décaissement sans approbation préalable de l'administrateur.</li>
                    <li>Justificatif requis pour toute demande soumise.</li>
                    <li>L'exécution est confirmée séparément, une fois le paiement effectué.</li>
                  </ul>
                </Card>
              </div>
            </div>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Historique</h2>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="table-head-dark text-left">
                  <tr>
                    <th className="px-4 py-2">Demande</th>
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Bénéficiaire</th>
                    <th className="px-4 py-2">Catégorie</th>
                    <th className="px-4 py-2 text-right">Montant</th>
                    <th className="px-4 py-2">Statut</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {list.map(r => (
                    <tr key={r.id} className={`hover:bg-muted/30 cursor-pointer ${r.id === dossier?.id ? "bg-muted/40" : ""}`} onClick={() => setSelectedId(r.id)}>
                      <td className="px-4 py-2 font-mono text-xs">DEC-{r.id.slice(0, 4).toUpperCase()}</td>
                      <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">{formatDate(r.created_at)}</td>
                      <td className="px-4 py-2 font-medium">{r.beneficiary}</td>
                      <td className="px-4 py-2 text-muted-foreground">{DISB_CAT_LABEL[r.category]}</td>
                      <td className="px-4 py-2 text-right font-mono">{formatMoney(r.amount)}</td>
                      <td className="px-4 py-2"><Badge variant={statusVariant(r.status)}>{STATUS_LABEL[r.status]}</Badge></td>
                      <td className="px-4 py-2">
                        {r.justification_url && (
                          <Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); openJustif(r.justification_url!); }}>
                            <FileText className="size-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {list.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Aucune demande.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}