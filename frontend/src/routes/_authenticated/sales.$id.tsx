import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchSale, refundSale, PAYMENT_LABEL } from "@/lib/sales";
import { fetchWarehouses, formatMoney, formatDate } from "@/lib/stock";
import { fetchCustomers, customerName } from "@/lib/customers";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Printer, Mail, RotateCcw, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sales/$id")({
  head: () => ({ meta: [{ title: "Ticket — StockFlow" }] }),
  validateSearch: (s: Record<string, unknown>) => ({ print: s.print === "1" || s.print === 1 ? "1" : undefined }),
  component: SaleDetail,
});

function SaleDetail() {
  const { id } = Route.useParams();
  const search = useSearch({ from: "/_authenticated/sales/$id" });
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["sale", id], queryFn: () => fetchSale(id) });
  const warehouses = useQuery({ queryKey: ["warehouses"], queryFn: fetchWarehouses });
  const customers = useQuery({ queryKey: ["customers"], queryFn: fetchCustomers });
  const [refunding, setRefunding] = useState(false);

  useEffect(() => {
    if (search.print && q.data) {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [search.print, q.data]);

  if (q.isLoading) return <div className="p-10">Chargement…</div>;
  if (!q.data) return <div className="p-10">Vente introuvable</div>;
  const { sale, items, payments } = q.data;
  const w = (warehouses.data ?? []).find(w => w.id === sale.warehouse_id);
  const c = (customers.data ?? []).find(c => c.id === sale.customer_id);

  async function handleRefund() {
    if (!confirm("Confirmer le remboursement complet de cette vente ?")) return;
    setRefunding(true);
    try {
      await refundSale(id, "Remboursement guichet");
      toast.success("Vente remboursée — stock ré-entré");
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["sale", id] });
      qc.invalidateQueries({ queryKey: ["stock_levels"] });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setRefunding(false);
    }
  }

  function emailTicket() {
    if (!c?.email) {
      toast.error("Aucun email client");
      return;
    }
    const body = [
      `Bonjour ${customerName(c)},`,
      ``,
      `Voici votre ticket — ${sale.reference}`,
      ...items.map(it => `${it.product_name} × ${it.quantity} = ${formatMoney(it.line_total)}`),
      ``,
      `Total : ${formatMoney(sale.total)}`,
      `Merci de votre visite.`,
    ].join("\n");
    window.location.href = `mailto:${c.email}?subject=${encodeURIComponent("Ticket " + sale.reference)}&body=${encodeURIComponent(body)}`;
  }

  return (
    <div className="p-6 lg:p-10 max-w-3xl space-y-6 print:p-4 print:max-w-full">
      <div className="flex items-center justify-between print:hidden">
        <Link to="/sales" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"><ArrowLeft className="size-4" /> Retour</Link>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}><Printer className="size-4" /> Imprimer</Button>
          <Button variant="outline" onClick={emailTicket} disabled={!c?.email}><Mail className="size-4" /> Email</Button>
          {sale.status === "completed" && (
            <Button variant="destructive" onClick={handleRefund} disabled={refunding}>
              <RotateCcw className="size-4" /> Rembourser
            </Button>
          )}
        </div>
      </div>

      <Card className="p-6 print:shadow-none print:border-0">
        <div className="text-center border-b pb-4 mb-4">
          <h1 className="text-2xl font-bold">StockFlow</h1>
          <p className="text-sm text-muted-foreground">{w?.name ?? ""}</p>
        </div>
        <div className="flex justify-between text-sm mb-4">
          <div>
            <p className="font-mono font-semibold">{sale.reference}</p>
            <p className="text-muted-foreground">{formatDate(sale.created_at)}</p>
          </div>
          <Badge variant={sale.status === "refunded" ? "destructive" : "secondary"}>{sale.status}</Badge>
        </div>
        {c && <p className="text-sm mb-3">Client : <span className="font-medium">{customerName(c)}</span></p>}

        <table className="w-full text-sm mb-4">
          <thead><tr className="text-left text-muted-foreground border-b"><th className="py-2">Article</th><th className="text-right">Qté</th><th className="text-right">PU</th><th className="text-right">Total</th></tr></thead>
          <tbody>
            {items.map(it => (
              <tr key={it.id} className="border-b last:border-0">
                <td className="py-2">{it.product_name}<br /><span className="text-xs text-muted-foreground">{it.sku}</span></td>
                <td className="text-right">{it.quantity}</td>
                <td className="text-right font-mono">{formatMoney(it.unit_price)}</td>
                <td className="text-right font-mono">{formatMoney(it.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="space-y-1 text-sm border-t pt-3">
          <div className="flex justify-between"><span>Sous-total</span><span className="font-mono">{formatMoney(sale.subtotal)}</span></div>
          {sale.discount_amount !== 0 && <div className="flex justify-between"><span>Remise</span><span className="font-mono">−{formatMoney(Math.abs(sale.discount_amount))}</span></div>}
          <div className="flex justify-between text-muted-foreground"><span>dont TVA</span><span className="font-mono">{formatMoney(sale.tax_amount)}</span></div>
          <div className="flex justify-between text-lg font-semibold border-t pt-2 mt-2"><span>Total TTC</span><span className="font-mono">{formatMoney(sale.total)}</span></div>
        </div>

        <div className="border-t mt-4 pt-3 text-sm">
          <p className="font-medium mb-1">Paiements</p>
          {payments.map(p => (
            <div key={p.id} className="flex justify-between">
              <span>{PAYMENT_LABEL[p.method]}{p.change_given > 0 ? ` (rendu ${formatMoney(p.change_given)})` : ""}</span>
              <span className="font-mono">{formatMoney(p.amount)}</span>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">Merci de votre visite.</p>
      </Card>
    </div>
  );
}
