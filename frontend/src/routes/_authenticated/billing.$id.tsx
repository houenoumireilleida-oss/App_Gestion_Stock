import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchInvoice, fetchCompanySettings, updateInvoiceStatus, INVOICE_STATUS_LABEL, type InvoiceStatus } from "@/lib/billing";
import { formatMoney, formatDate } from "@/lib/stock";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Printer, Mail, ArrowLeft } from "lucide-react";
import { useMyRoles, hasAny } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/billing/$id")({
  head: () => ({ meta: [{ title: "Facture — StockFlow" }] }),
  component: InvoicePage,
});

function InvoicePage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data: roles } = useMyRoles();
  const canEdit = hasAny(roles, "admin", "responsable");
  const invQ = useQuery({ queryKey: ["invoice", id], queryFn: () => fetchInvoice(id) });
  const companyQ = useQuery({ queryKey: ["company_settings"], queryFn: fetchCompanySettings });

  if (invQ.isLoading) return <div className="p-10 text-muted-foreground">Chargement…</div>;
  if (!invQ.data) return <div className="p-10">Introuvable</div>;

  const { invoice, items } = invQ.data;
  const company = companyQ.data;

  async function changeStatus(s: InvoiceStatus) {
    try {
      await updateInvoiceStatus(id, s);
      toast.success("Statut mis à jour");
      qc.invalidateQueries({ queryKey: ["invoice", id] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erreur"); }
  }

  function emailInvoice() {
    if (!invoice.customer_email) { toast.error("Aucun email client"); return; }
    const subject = `Facture ${invoice.number}`;
    const body = `Bonjour,\n\nVeuillez trouver ci-joint votre facture ${invoice.number} d'un montant de ${formatMoney(invoice.total)}.\n\nCordialement,\n${company?.name ?? ""}`;
    window.location.href = `mailto:${invoice.customer_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  return (
    <div className="p-6 lg:p-10 max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-4 print:hidden">
        <Button asChild variant="ghost" size="sm"><Link to="/billing"><ArrowLeft className="size-4 mr-1" />Retour</Link></Button>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Select value={invoice.status} onValueChange={(v: InvoiceStatus) => changeStatus(v)}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Brouillon</SelectItem>
                <SelectItem value="issued">Émise</SelectItem>
                <SelectItem value="paid">Payée</SelectItem>
                <SelectItem value="cancelled">Annulée</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" size="sm" onClick={emailInvoice}><Mail className="size-4 mr-1" />Email</Button>
          <Button size="sm" onClick={() => window.print()}><Printer className="size-4 mr-1" />Imprimer</Button>
        </div>
      </div>

      <Card className="p-10 space-y-8 print:shadow-none print:border-0">
        <div className="flex items-start justify-between gap-8">
          <div>
            <h1 className="text-2xl font-bold">{company?.name ?? "—"}</h1>
            {company?.address && <p className="text-sm text-muted-foreground whitespace-pre-line">{company.address}</p>}
            {(company?.postal_code || company?.city) && <p className="text-sm text-muted-foreground">{company.postal_code} {company.city}</p>}
            {company?.country && <p className="text-sm text-muted-foreground">{company.country}</p>}
            <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
              {company?.siret && <div>SIRET : {company.siret}</div>}
              {company?.vat_number && <div>TVA : {company.vat_number}</div>}
              {company?.email && <div>{company.email}</div>}
              {company?.phone && <div>{company.phone}</div>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold tracking-tight">FACTURE</div>
            <div className="font-mono text-lg mt-1">{invoice.number}</div>
            <Badge className="mt-2">{INVOICE_STATUS_LABEL[invoice.status]}</Badge>
            <div className="mt-4 text-sm">
              <div><span className="text-muted-foreground">Date :</span> {formatDate(invoice.issue_date)}</div>
              {invoice.due_date && <div><span className="text-muted-foreground">Échéance :</span> {formatDate(invoice.due_date)}</div>}
            </div>
          </div>
        </div>

        <div className="border-t pt-6">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Facturé à</div>
          <div className="font-semibold">{invoice.customer_name}</div>
          {invoice.customer_address && <div className="text-sm whitespace-pre-line">{invoice.customer_address}</div>}
          {invoice.customer_email && <div className="text-sm text-muted-foreground">{invoice.customer_email}</div>}
          {invoice.customer_vat_number && <div className="text-sm text-muted-foreground">TVA : {invoice.customer_vat_number}</div>}
        </div>

        <table className="w-full text-sm">
          <thead className="border-b text-left">
            <tr>
              <th className="py-2">Description</th>
              <th className="py-2 text-right w-16">Qté</th>
              <th className="py-2 text-right w-24">PU HT</th>
              <th className="py-2 text-right w-16">TVA</th>
              <th className="py-2 text-right w-28">Total TTC</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map(it => (
              <tr key={it.id}>
                <td className="py-3">{it.description}</td>
                <td className="py-3 text-right font-mono">{it.quantity}</td>
                <td className="py-3 text-right font-mono">{formatMoney(it.unit_price)}</td>
                <td className="py-3 text-right">{it.vat_rate}%</td>
                <td className="py-3 text-right font-mono">{formatMoney(it.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end">
          <div className="w-72 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Sous-total HT</span><span className="font-mono">{formatMoney(invoice.subtotal)}</span></div>
            {invoice.discount_amount > 0 && (
              <div className="flex justify-between"><span className="text-muted-foreground">Remise</span><span className="font-mono">-{formatMoney(invoice.discount_amount)}</span></div>
            )}
            <div className="flex justify-between"><span className="text-muted-foreground">TVA</span><span className="font-mono">{formatMoney(invoice.tax_amount)}</span></div>
            <div className="flex justify-between text-lg font-bold border-t pt-2 mt-2"><span>Total TTC</span><span className="font-mono">{formatMoney(invoice.total)}</span></div>
          </div>
        </div>

        {(company?.iban || company?.bic) && (
          <div className="border-t pt-4 text-xs text-muted-foreground">
            <div className="font-medium text-foreground mb-1">Coordonnées bancaires</div>
            {company.iban && <div>IBAN : {company.iban}</div>}
            {company.bic && <div>BIC : {company.bic}</div>}
          </div>
        )}

        {invoice.notes && (
          <div className="border-t pt-4 text-sm">
            <div className="font-medium mb-1">Notes</div>
            <p className="text-muted-foreground whitespace-pre-line">{invoice.notes}</p>
          </div>
        )}

        {company?.legal_footer && (
          <div className="border-t pt-4 text-xs text-muted-foreground text-center whitespace-pre-line">
            {company.legal_footer}
          </div>
        )}
      </Card>
    </div>
  );
}
