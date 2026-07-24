import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { fetchSales, fetchSale } from "@/lib/sales";
import { formatDate, formatMoney } from "@/lib/stock";
import { createCustomerReturn, type ReturnDestination, type RefundType } from "@/lib/workflows";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/returns/new")({
  head: () => ({ meta: [{ title: "Nouveau retour — StockFlow" }] }),
  component: NewReturn,
});
function NewReturn() {
  const nav = useNavigate();
  const sales = useQuery({ queryKey: ["sales"], queryFn: () => fetchSales(50) });
  const [saleId, setSaleId] = useState("");
  const saleDetail = useQuery({
    queryKey: ["sale", saleId], enabled: !!saleId,
    queryFn: () => fetchSale(saleId),
  });
  const [qtyMap, setQtyMap] = useState<Record<string, number>>({});
  const [destination, setDest] = useState<ReturnDestination>("stock");
  const [refund_type, setRT] = useState<RefundType>("cash");
  const [reason, setReason] = useState("");
  const [loading, setL] = useState(false);

  const items = (saleDetail.data?.items ?? []).map(it => ({
    ...it, returnQty: qtyMap[it.id] ?? 0,
  }));
  const total = useMemo(() =>
    items.reduce((s, it) => s + it.returnQty * (it.unit_price ?? 0), 0),
  [items]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const toReturn = items.filter(it => it.returnQty > 0);
    if (!saleId || toReturn.length === 0 || !reason.trim()) {
      toast.error("Sélectionne au moins un article."); return;
    }
    setL(true);
    try {
      await createCustomerReturn({
        sale_id: saleId, reason, destination, refund_type, refund_amount: total,
        items: toReturn.map(it => ({ product_id: it.product_id, quantity: it.returnQty, unit_price: it.unit_price })),
      });
      toast.success("Retour envoyé pour approbation");
      nav({ to: "/returns" });
    } catch (e) { toast.error((e as Error).message); }
    finally { setL(false); }
  }

  return (
    <div className="p-4 lg:p-8 max-w-3xl">
      <h1 className="text-2xl font-semibold mb-6">Nouveau retour client</h1>
      <Card className="p-6">
        <form onSubmit={submit} className="space-y-4">
          <div><Label>Vente</Label>
            <Select value={saleId} onValueChange={setSaleId}>
              <SelectTrigger><SelectValue placeholder="Choisir une vente récente" /></SelectTrigger>
              <SelectContent>
                {(sales.data ?? []).filter(s => s.status === "completed").map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.reference} · {formatMoney(s.total)} · {formatDate(s.created_at)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {saleDetail.data && (
            <div className="border rounded-md divide-y">
              {saleDetail.data.items.map(it => (
                <div key={it.id} className="p-3 flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{it.product_name}</div>
                    <div className="text-xs text-muted-foreground">Vendu : {it.quantity} × {formatMoney(it.unit_price)}</div>
                  </div>
                  <Input type="number" min={0} max={it.quantity} value={qtyMap[it.id] ?? 0}
                    onChange={e => setQtyMap({ ...qtyMap, [it.id]: Math.max(0, Math.min(it.quantity, parseInt(e.target.value) || 0)) })}
                    className="w-20 text-right" />
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>Destination</Label>
              <Select value={destination} onValueChange={v => setDest(v as ReturnDestination)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="stock">Réintégrer au stock</SelectItem>
                  <SelectItem value="defective">Basculer en défectueux</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Remboursement</Label>
              <Select value={refund_type} onValueChange={v => setRT(v as RefundType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Espèces</SelectItem>
                  <SelectItem value="store_credit">Avoir</SelectItem>
                  <SelectItem value="none">Aucun</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div><Label>Motif</Label><Textarea value={reason} onChange={e => setReason(e.target.value)} required rows={3} /></div>

          <div className="flex items-center justify-between p-3 bg-muted/40 rounded">
            <span className="text-sm">Montant à rembourser</span>
            <span className="font-semibold">{formatMoney(total)}</span>
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => nav({ to: "/returns" })}>Annuler</Button>
            <Button type="submit" disabled={loading}>Soumettre</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
