import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchWarehouses, formatMoney, formatDate } from "@/lib/stock";
import { useMyRoles, hasAny } from "@/lib/roles";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { SectionHero } from "@/components/SectionHero";
import { useState } from "react";
import { toast } from "sonner";
import { ShoppingCart, Receipt, Wallet, Undo2, ClipboardList } from "lucide-react";

type CashSession = {
  id: string; warehouse_id: string; opened_by: string; closed_by: string | null;
  opening_float: number; closing_counted: number | null; expected_cash: number | null; variance: number | null;
  notes: string | null; opened_at: string; closed_at: string | null; z_report_number: string | null;
};

type Profile = { user_id: string; display_name: string };
type CashPaymentRow = { amount: number; change_given: number; sale: { cash_session_id: string | null } | null };

export const Route = createFileRoute("/_authenticated/cash-sessions")({
  head: () => ({ meta: [{ title: "Sessions de caisse — StockFlow" }] }),
  component: CashSessionsPage,
});

const VENTE_LINKS = [
  { to: "/pos", label: "Caisse", icon: ShoppingCart },
  { to: "/sales", label: "Ventes", icon: Receipt },
  { to: "/cash-sessions", label: "Sessions & Clôture Z", icon: Wallet },
  { to: "/returns", label: "Retours clients", icon: Undo2 },
];

async function fetchSessions(): Promise<CashSession[]> {
  const { data, error } = await supabase.from("cash_sessions").select("*").order("opened_at", { ascending: false }).limit(50);
  if (error) throw error;
  return data as CashSession[];
}

async function fetchProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase.from("user_profiles").select("user_id, display_name");
  if (error) throw error;
  return data as Profile[];
}

/** Cash collected so far per session — the same formula the close_cash_session()
 *  database function uses (opening float + net cash payments tied to the
 *  session via sales.cash_session_id), computed here live so an OPEN session
 *  shows a running total instead of just closed ones. */
async function fetchCashPayments(): Promise<CashPaymentRow[]> {
  const { data, error } = await supabase
    .from("sale_payments")
    .select("amount, change_given, sale:sales!inner(cash_session_id)")
    .eq("method", "cash");
  if (error) throw error;
  return data as unknown as CashPaymentRow[];
}

function CashSessionsPage() {
  const qc = useQueryClient();
  const { data: roles } = useMyRoles();
  const canManage = hasAny(roles, "admin", "responsable");
  const sessions = useQuery({ queryKey: ["cash_sessions"], queryFn: fetchSessions });
  const wh = useQuery({ queryKey: ["warehouses"], queryFn: fetchWarehouses });
  const profiles = useQuery({ queryKey: ["profiles"], queryFn: fetchProfiles });
  const cashPayments = useQuery({ queryKey: ["cash_payments_live"], queryFn: fetchCashPayments });
  const [openOpen, setOpenOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState<CashSession | null>(null);
  const [warehouseId, setWarehouseId] = useState("");
  const [opening, setOpening] = useState("0");
  const [counted, setCounted] = useState("");
  const [notes, setNotes] = useState("");

  const list = sessions.data ?? [];
  const closedList = list.filter(s => s.closed_at);
  const operatorName = (userId: string) => (profiles.data ?? []).find(p => p.user_id === userId)?.display_name ?? "—";

  function liveExpected(session: CashSession) {
    const net = (cashPayments.data ?? [])
      .filter(p => p.sale?.cash_session_id === session.id)
      .reduce((s, p) => s + (p.amount - (p.change_given ?? 0)), 0);
    return session.opening_float + net;
  }

  async function openSession(e: React.FormEvent) {
    e.preventDefault();
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("cash_sessions").insert({
      warehouse_id: warehouseId, opened_by: u.user.id, opening_float: parseFloat(opening) || 0,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Caisse ouverte");
    setOpenOpen(false); setOpening("0");
    qc.invalidateQueries({ queryKey: ["cash_sessions"] });
  }

  async function closeSession(e: React.FormEvent) {
    e.preventDefault();
    if (!closeOpen) return;
    try {
      const { closeCashSession } = await import("@/lib/workflows");
      const z = await closeCashSession(closeOpen.id, parseFloat(counted) || 0, notes || "");
      toast.success(`Caisse fermée — Rapport ${z}`);
      setCloseOpen(null); setCounted(""); setNotes("");
      qc.invalidateQueries({ queryKey: ["cash_sessions"] });
    } catch (err) { toast.error((err as Error).message); }
  }

  function statusBadge(s: CashSession) {
    if (!s.closed_at) return <Badge variant="warning">En attente</Badge>;
    if (s.variance && Math.abs(s.variance) > 0) return <Badge variant="danger">Écart signalé</Badge>;
    return <Badge variant="success">Validée</Badge>;
  }

  return (
    <div>
      <SectionHero
        eyebrow="Vente"
        title="Encaissement, tickets, sessions de caisse et retours clients"
        links={VENTE_LINKS}
      />
      <div className="p-6 lg:p-10 space-y-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="size-11 rounded-xl bg-[var(--sidebar)] text-white grid place-items-center shrink-0">
              <ClipboardList className="size-5" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Sessions & Clôture Z</h1>
              <p className="text-sm text-muted-foreground">{list.length} session{list.length > 1 ? "s" : ""}</p>
            </div>
          </div>
          {canManage && <Button onClick={() => setOpenOpen(true)}>Ouvrir une caisse</Button>}
        </div>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Sessions de caisse</h2>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="table-head-dark text-left">
                  <tr>
                    <th className="px-4 py-2">Session</th>
                    <th className="px-4 py-2">Site</th>
                    <th className="px-4 py-2">Ouverture</th>
                    <th className="px-4 py-2">Fermeture</th>
                    <th className="px-4 py-2">Opérateur</th>
                    <th className="px-4 py-2 text-right">Fond</th>
                    <th className="px-4 py-2 text-right">Encaissé</th>
                    <th className="px-4 py-2">Statut</th>
                    {canManage && <th className="px-4 py-2">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {list.map(s => {
                    const w = (wh.data ?? []).find(w => w.id === s.warehouse_id);
                    return (
                      <tr key={s.id} className="hover:bg-muted/30">
                        <td className="px-4 py-2 font-mono text-xs">SES-{s.id.slice(0, 4).toUpperCase()}</td>
                        <td className="px-4 py-2 text-muted-foreground">{w?.name ?? "—"}</td>
                        <td className="px-4 py-2">{formatDate(s.opened_at)}</td>
                        <td className="px-4 py-2">{s.closed_at ? formatDate(s.closed_at) : "—"}</td>
                        <td className="px-4 py-2">{operatorName(s.opened_by)}</td>
                        <td className="px-4 py-2 text-right font-mono">{formatMoney(s.opening_float)}</td>
                        <td className="px-4 py-2 text-right font-mono">
                          {formatMoney(s.closed_at ? (s.expected_cash ?? 0) : liveExpected(s))}
                        </td>
                        <td className="px-4 py-2">{statusBadge(s)}</td>
                        {canManage && (
                          <td className="px-4 py-2">
                            {!s.closed_at && <Button size="sm" variant="outline" onClick={() => setCloseOpen(s)}>Fermer la caisse</Button>}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {list.length === 0 && (
                    <tr><td colSpan={canManage ? 9 : 8} className="px-4 py-8 text-center text-muted-foreground">Aucune session.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Clôtures et écarts</h2>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="table-head-dark text-left">
                  <tr>
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Point de vente</th>
                    <th className="px-4 py-2 text-right">Théorique</th>
                    <th className="px-4 py-2 text-right">Compté</th>
                    <th className="px-4 py-2 text-right">Écart</th>
                    <th className="px-4 py-2">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {closedList.map(s => {
                    const w = (wh.data ?? []).find(w => w.id === s.warehouse_id);
                    const variance = s.variance ?? 0;
                    return (
                      <tr key={s.id} className="hover:bg-muted/30">
                        <td className="px-4 py-2 text-muted-foreground">{formatDate(s.closed_at!)}</td>
                        <td className="px-4 py-2">{w?.name ?? "—"}</td>
                        <td className="px-4 py-2 text-right font-mono">{formatMoney(s.expected_cash ?? 0)}</td>
                        <td className="px-4 py-2 text-right font-mono">{formatMoney(s.closing_counted ?? 0)}</td>
                        <td className={`px-4 py-2 text-right font-mono ${variance < 0 ? "text-destructive" : variance > 0 ? "text-warning" : ""}`}>
                          {formatMoney(variance)}
                        </td>
                        <td className="px-4 py-2">{statusBadge(s)}</td>
                      </tr>
                    );
                  })}
                  {closedList.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Aucune clôture pour l'instant.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      </div>

      <Dialog open={openOpen} onOpenChange={setOpenOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ouvrir une caisse</DialogTitle></DialogHeader>
          <form onSubmit={openSession} className="space-y-3">
            <div>
              <Label>Entrepôt *</Label>
              <Select value={warehouseId} onValueChange={setWarehouseId}>
                <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>{(wh.data ?? []).map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Fond de caisse (FCFA)</Label><Input type="number" step="1" value={opening} onChange={e => setOpening(e.target.value)} /></div>
            <DialogFooter><Button type="submit">Ouvrir</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!closeOpen} onOpenChange={v => !v && setCloseOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Fermer la caisse — clôture de fin de journée</DialogTitle></DialogHeader>
          <form onSubmit={closeSession} className="space-y-3">
            {closeOpen && (
              <p className="text-sm text-muted-foreground">
                Montant théorique attendu : <span className="font-medium text-foreground">{formatMoney(liveExpected(closeOpen))}</span>.
                Comptez le tiroir-caisse et saisissez le montant réel ci-dessous — l'écart sera calculé et signalé automatiquement.
              </p>
            )}
            <div><Label>Montant compté (FCFA) *</Label><Input type="number" step="1" required value={counted} onChange={e => setCounted(e.target.value)} /></div>
            <div><Label>Justification de l'écart (si besoin)</Label><Input value={notes} onChange={e => setNotes(e.target.value)} /></div>
            <DialogFooter><Button type="submit">Valider la clôture</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}