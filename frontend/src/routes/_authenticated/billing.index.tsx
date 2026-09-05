import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchInvoices, INVOICE_STATUS_LABEL, type InvoiceStatus } from "@/lib/billing";
import { formatMoney, formatDate } from "@/lib/stock";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMyRoles, hasAny } from "@/lib/roles";
import { FileText, Plus, Settings } from "lucide-react";
import { SectionHero } from "@/components/SectionHero";

export const Route = createFileRoute("/_authenticated/billing/")({
  head: () => ({ meta: [{ title: "Factures — StockFlow" }] }),
  component: InvoicesPage,
});

const BILLING_LINKS = [
  { to: "/billing", label: "Factures", icon: FileText },
  { to: "/billing/new", label: "Nouvelle facture", icon: Plus },
  { to: "/billing/settings", label: "Société", icon: Settings },
];

const STATUS_VARIANT: Record<InvoiceStatus, "outline" | "warning" | "success" | "danger"> = {
  draft: "outline", issued: "warning", paid: "success", cancelled: "danger",
};

function InvoicesPage() {
  const invoices = useQuery({ queryKey: ["invoices"], queryFn: fetchInvoices });
  const { data: roles } = useMyRoles();
  const canEdit = hasAny(roles, "admin", "responsable");
  const list = invoices.data ?? [];

  const total = list.filter(i => i.status !== "cancelled").reduce((s, i) => s + i.total, 0);
  const unpaid = list.filter(i => i.status === "issued").reduce((s, i) => s + i.total, 0);
  const paid = list.filter(i => i.status === "paid").reduce((s, i) => s + i.total, 0);

  return (
    <div>
      <SectionHero
        eyebrow="Facturation"
        title="Factures, règlements et paramètres de facturation"
        links={canEdit ? BILLING_LINKS : BILLING_LINKS.filter(l => l.to === "/billing")}
      />
      <div className="p-6 lg:p-10 space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Factures</h1>
          <p className="text-muted-foreground mt-1">Suivi des factures émises et de leur règlement.</p>
        </div>
        {canEdit && (
          <Button asChild><Link to="/billing/new"><Plus className="size-4 mr-2" />Nouvelle facture</Link></Button>
        )}
      </header>

      <div className="grid sm:grid-cols-3 gap-4">
        <Card className="p-5"><p className="text-sm text-muted-foreground">Total facturé</p><p className="text-2xl font-semibold mt-1">{formatMoney(total)}</p></Card>
        <Card className="p-5"><p className="text-sm text-muted-foreground">En attente de règlement</p><p className="text-2xl font-semibold mt-1 text-warning">{formatMoney(unpaid)}</p></Card>
        <Card className="p-5"><p className="text-sm text-muted-foreground">Encaissé</p><p className="text-2xl font-semibold mt-1 text-accent">{formatMoney(paid)}</p></Card>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="table-head-dark text-left">
            <tr>
              <th className="px-4 py-2">N°</th>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Client</th>
              <th className="px-4 py-2">Échéance</th>
              <th className="px-4 py-2">Statut</th>
              <th className="px-4 py-2 text-right">Total TTC</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {list.map(inv => {
              const overdue = inv.status === "issued" && inv.due_date && new Date(inv.due_date) < new Date();
              const mailto = inv.customer_email
                ? `mailto:${inv.customer_email}?subject=${encodeURIComponent(`Relance facture ${inv.number}`)}&body=${encodeURIComponent(`Bonjour,\n\nSauf erreur de notre part, la facture ${inv.number} d'un montant de ${formatMoney(inv.total)} reste impayée à ce jour.\nMerci de procéder au règlement dans les meilleurs délais.\n\nCordialement.`)}`
                : null;
              return (
                <tr key={inv.id} className={`hover:bg-muted/30 ${overdue ? "bg-rose-50/50" : ""}`}>
                  <td className="px-4 py-2"><Link to="/billing/$id" params={{ id: inv.id }} className="text-accent hover:underline font-mono">{inv.number}</Link></td>
                  <td className="px-4 py-2">{formatDate(inv.issue_date)}</td>
                  <td className="px-4 py-2">{inv.customer_name}</td>
                  <td className="px-4 py-2 text-muted-foreground">{inv.due_date ? formatDate(inv.due_date) : "—"}{overdue && <span className="ml-2 text-xs text-rose-700 font-medium">En retard</span>}</td>
                  <td className="px-4 py-2"><Badge variant={STATUS_VARIANT[inv.status]}>{INVOICE_STATUS_LABEL[inv.status]}</Badge></td>
                  <td className="px-4 py-2 text-right font-mono">{formatMoney(inv.total)}</td>
                  <td className="px-4 py-2 text-right">
                    {overdue && mailto && (
                      <Button asChild size="sm" variant="outline"><a href={mailto}>Relancer</a></Button>
                    )}
                  </td>
                </tr>
              );
            })}
            {list.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                <FileText className="mx-auto size-10 mb-2 opacity-40" />
                Aucune facture pour le moment.
              </td></tr>
            )}
          </tbody>
        </table>
        </div>
      </Card>
      </div>
    </div>
  );
}