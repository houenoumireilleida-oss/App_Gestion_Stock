import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchWarehouses, formatMoney, formatDate } from "@/lib/stock";
import { fetchDisbursement } from "@/lib/workflows";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SectionHero } from "@/components/SectionHero";
import { PiggyBank, Banknote, BarChart3 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/treasury")({
  head: () => ({ meta: [{ title: "Trésorerie — StockFlow" }] }),
  component: TreasuryPage,
});

const FINANCE_LINKS = [
  { to: "/disbursement", label: "Décaissements", icon: Banknote },
  { to: "/treasury", label: "Trésorerie", icon: PiggyBank },
  { to: "/finance-reports", label: "Rapports", icon: BarChart3 },
];

type CashSession = {
  id: string; warehouse_id: string; opening_float: number;
  closing_counted: number | null; expected_cash: number | null; variance: number | null;
  opened_at: string; closed_at: string | null;
};
type CashPaymentRow = { amount: number; change_given: number; sale: { cash_session_id: string | null } | null };

async function fetchSessions(): Promise<CashSession[]> {
  const { data, error } = await supabase.from("cash_sessions").select("*").order("opened_at", { ascending: false }).limit(100);
  if (error) throw error;
  return data as CashSession[];
}
async function fetchCashPayments(): Promise<CashPaymentRow[]> {
  const { data, error } = await supabase
    .from("sale_payments")
    .select("amount, change_given, sale:sales!inner(cash_session_id)")
    .eq("method", "cash");
  if (error) throw error;
  return data as unknown as CashPaymentRow[];
}

function TreasuryPage() {
  const sessions = useQuery({ queryKey: ["cash_sessions"], queryFn: fetchSessions });
  const wh = useQuery({ queryKey: ["warehouses"], queryFn: fetchWarehouses });
  const cashPayments = useQuery({ queryKey: ["cash_payments_live"], queryFn: fetchCashPayments });
  const disbursement = useQuery({ queryKey: ["disbursement"], queryFn: fetchDisbursement });

  const list = sessions.data ?? [];
  const openSessions = list.filter(s => !s.closed_at);

  function liveBalance(session: CashSession) {
    const net = (cashPayments.data ?? [])
      .filter(p => p.sale?.cash_session_id === session.id)
      .reduce((s, p) => s + (p.amount - (p.change_given ?? 0)), 0);
    return session.opening_float + net;
  }

  const cashOnHand = openSessions.reduce((s, sess) => s + liveBalance(sess), 0);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const closedToday = list.filter(s => s.closed_at && new Date(s.closed_at) >= today);
  const collectedToday = closedToday.reduce((s, sess) => s + (sess.expected_cash ?? 0), 0)
    + openSessions.reduce((s, sess) => s + liveBalance(sess) - sess.opening_float, 0);

  const pendingDisbursement = (disbursement.data ?? []).filter(d => d.status === "pending" || d.status === "approved");
  const pendingOut = pendingDisbursement.reduce((s, d) => s + d.amount, 0);

  return (
    <div>
      <SectionHero
        eyebrow="Finances"
        title="Décaissements, trésorerie et rapports financiers"
        links={FINANCE_LINKS}
      />
      <div className="p-6 lg:p-10 space-y-6">
        <header className="flex items-center gap-3">
          <span className="size-11 rounded-xl bg-[var(--sidebar)] text-white grid place-items-center shrink-0">
            <PiggyBank className="size-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Trésorerie</h1>
            <p className="text-sm text-muted-foreground">Position de caisse en temps réel, par site</p>
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="p-5 card-accent-top card-accent-navy">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Espèces en caisse (sites ouverts)</p>
            <p className="text-2xl font-semibold mt-2 tracking-tight">{formatMoney(cashOnHand)}</p>
            <p className="text-xs text-muted-foreground mt-1">{openSessions.length} caisse{openSessions.length > 1 ? "s" : ""} actuellement ouverte{openSessions.length > 1 ? "s" : ""}</p>
          </Card>
          <Card className="p-5 card-accent-top card-accent-teal">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Encaissé aujourd'hui</p>
            <p className="text-2xl font-semibold mt-2 tracking-tight">{formatMoney(Math.max(0, collectedToday))}</p>
          </Card>
          <Card className="p-5 card-accent-top border-t-warning">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Décaissements à sortir</p>
            <p className="text-2xl font-semibold mt-2 tracking-tight">{formatMoney(pendingOut)}</p>
            <p className="text-xs text-muted-foreground mt-1">En attente ou approuvés, non encore payés</p>
          </Card>
        </div>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Caisses ouvertes par site</h2>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="table-head-dark text-left">
                  <tr>
                    <th className="px-4 py-2">Site</th>
                    <th className="px-4 py-2">Ouverture</th>
                    <th className="px-4 py-2 text-right">Fond initial</th>
                    <th className="px-4 py-2 text-right">Solde actuel</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {openSessions.map(s => {
                    const w = (wh.data ?? []).find(w => w.id === s.warehouse_id);
                    return (
                      <tr key={s.id} className="hover:bg-muted/30">
                        <td className="px-4 py-2 font-medium">{w?.name ?? "—"}</td>
                        <td className="px-4 py-2 text-muted-foreground">{formatDate(s.opened_at)}</td>
                        <td className="px-4 py-2 text-right font-mono text-muted-foreground">{formatMoney(s.opening_float)}</td>
                        <td className="px-4 py-2 text-right font-mono font-semibold">{formatMoney(liveBalance(s))}</td>
                        <td className="px-4 py-2"><Badge variant="warning">Ouverte</Badge></td>
                      </tr>
                    );
                  })}
                  {openSessions.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      Aucune caisse ouverte actuellement. <Link to="/cash-sessions" className="text-accent hover:underline">Ouvrir une caisse</Link>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </section>

        <p className="text-xs text-muted-foreground">
          Cette vue couvre les espèces suivies dans les sessions de caisse de l'application — elle ne remplace pas un état de trésorerie
          comptable complet (comptes bancaires, chèques en circulation, etc.), qui ne sont pas encore suivis dans StockFlow.
        </p>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Rapprochement des caisses</h2>
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
                  {list.filter(s => s.closed_at).map(s => {
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
                        <td className="px-4 py-2">
                          {Math.abs(variance) > 0 ? <Badge variant="danger">Écart signalé</Badge> : <Badge variant="success">Validée</Badge>}
                        </td>
                      </tr>
                    );
                  })}
                  {list.filter(s => s.closed_at).length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Aucune clôture pour l'instant.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}