import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createManualInvoice, createInvoiceFromSale, type InvoiceStatus } from "@/lib/billing";
import { fetchSales } from "@/lib/sales";
import { fetchCustomers, customerName } from "@/lib/customers";
import { formatMoney, formatDate } from "@/lib/stock";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/billing/new")({
  head: () => ({ meta: [{ title: "Nouvelle facture — StockFlow" }] }),
  component: NewInvoicePage,
});

type Line = { description: string; quantity: number; unit_price: number; vat_rate: number };

function NewInvoicePage() {
  const navigate = useNavigate();
  const sales = useQuery({ queryKey: ["sales"], queryFn: () => fetchSales(200) });
  const customers = useQuery({ queryKey: ["customers"], queryFn: fetchCustomers });

  const [form, setForm] = useState({
    customer_name: "", customer_address: "", customer_email: "",
    customer_vat_number: "", due_date: "", notes: "", status: "issued" as InvoiceStatus,
  });
  const [lines, setLines] = useState<Line[]>([
    { description: "", quantity: 1, unit_price: 0, vat_rate: 20 },
  ]);
  const [submitting, setSubmitting] = useState(false);

  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unit_price, 0);
  const tax = lines.reduce((s, l) => s + l.quantity * l.unit_price * (l.vat_rate / 100), 0);
  const total = subtotal + tax;

  function updateLine(i: number, patch: Partial<Line>) {
    setLines(ls => ls.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (lines.length === 0 || !form.customer_name) return;
    setSubmitting(true);
    try {
      const id = await createManualInvoice({
        ...form,
        due_date: form.due_date || null,
        items: lines,
      });
      toast.success("Facture créée");
      navigate({ to: "/billing/$id", params: { id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally { setSubmitting(false); }
  }

  async function fromSale(saleId: string) {
    setSubmitting(true);
    try {
      const id = await createInvoiceFromSale(saleId);
      toast.success("Facture créée depuis la vente");
      navigate({ to: "/billing/$id", params: { id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally { setSubmitting(false); }
  }

  function pickCustomer(id: string) {
    const c = (customers.data ?? []).find(c => c.id === id);
    if (!c) return;
    setForm(f => ({
      ...f,
      customer_name: customerName(c) || "Client",
      customer_address: c.address ?? "",
      customer_email: c.email ?? "",
    }));
  }

  const eligibleSales = (sales.data ?? []).filter(s => s.status === "completed");

  return (
    <div className="p-6 lg:p-10 space-y-6 max-w-5xl">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Nouvelle facture</h1>
        <p className="text-muted-foreground mt-1">Émettez une facture manuelle ou à partir d'une vente.</p>
      </header>

      <Tabs defaultValue="manual">
        <TabsList>
          <TabsTrigger value="manual">Manuelle</TabsTrigger>
          <TabsTrigger value="sale">Depuis une vente</TabsTrigger>
        </TabsList>

        <TabsContent value="manual" className="mt-6">
          <form onSubmit={submit} className="space-y-6">
            <Card className="p-6 space-y-4">
              <h2 className="font-semibold">Client</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Client existant</Label>
                  <Select onValueChange={pickCustomer}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                    <SelectContent>
                      {(customers.data ?? []).map(c => (
                        <SelectItem key={c.id} value={c.id}>{customerName(c)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Nom / raison sociale *</Label>
                  <Input required value={form.customer_name}
                    onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Adresse</Label>
                  <Textarea value={form.customer_address}
                    onChange={e => setForm(f => ({ ...f, customer_address: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={form.customer_email}
                    onChange={e => setForm(f => ({ ...f, customer_email: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>N° TVA intracom.</Label>
                  <Input value={form.customer_vat_number}
                    onChange={e => setForm(f => ({ ...f, customer_vat_number: e.target.value }))} />
                </div>
              </div>
            </Card>

            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Lignes</h2>
                <Button type="button" variant="outline" size="sm"
                  onClick={() => setLines(ls => [...ls, { description: "", quantity: 1, unit_price: 0, vat_rate: 20 }])}>
                  <Plus className="size-4 mr-1" />Ligne
                </Button>
              </div>
              <div className="space-y-2">
                {lines.map((l, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-start">
                    <Input className="col-span-5" placeholder="Description" required value={l.description}
                      onChange={e => updateLine(i, { description: e.target.value })} />
                    <Input className="col-span-1" type="number" min={0} step="0.01" value={l.quantity}
                      onChange={e => updateLine(i, { quantity: Number(e.target.value) })} />
                    <Input className="col-span-2" type="number" min={0} step="1" placeholder="PU HT FCFA" value={l.unit_price}
                      onChange={e => updateLine(i, { unit_price: Number(e.target.value) })} />
                    <Input className="col-span-1" type="number" min={0} step="0.1" value={l.vat_rate}
                      onChange={e => updateLine(i, { vat_rate: Number(e.target.value) })} />
                    <div className="col-span-2 text-right text-sm font-mono pt-2">
                      {formatMoney(l.quantity * l.unit_price * (1 + l.vat_rate / 100))}
                    </div>
                    <Button type="button" variant="ghost" size="sm" className="col-span-1"
                      onClick={() => setLines(ls => ls.filter((_, idx) => idx !== i))}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-12 gap-2 text-xs text-muted-foreground border-t pt-2">
                <span className="col-span-5">Description</span>
                <span className="col-span-1">Qté</span>
                <span className="col-span-2">PU HT FCFA</span>
                <span className="col-span-1">TVA %</span>
                <span className="col-span-2 text-right">Total TTC</span>
              </div>
            </Card>

            <div className="grid sm:grid-cols-2 gap-6">
              <Card className="p-6 space-y-4">
                <div className="space-y-2">
                  <Label>Date d'échéance</Label>
                  <Input type="date" value={form.due_date}
                    onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Statut initial</Label>
                  <Select value={form.status} onValueChange={(v: InvoiceStatus) => setForm(f => ({ ...f, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Brouillon</SelectItem>
                      <SelectItem value="issued">Émise</SelectItem>
                      <SelectItem value="paid">Payée</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </Card>
              <Card className="p-6 space-y-2">
                <div className="flex justify-between text-sm"><span>Sous-total HT</span><span className="font-mono">{formatMoney(subtotal)}</span></div>
                <div className="flex justify-between text-sm"><span>TVA</span><span className="font-mono">{formatMoney(tax)}</span></div>
                <div className="flex justify-between text-lg font-semibold border-t pt-2"><span>Total TTC</span><span className="font-mono">{formatMoney(total)}</span></div>
                <Button type="submit" className="w-full mt-4" disabled={submitting}>
                  {submitting ? "Création…" : "Créer la facture"}
                </Button>
              </Card>
            </div>
          </form>
        </TabsContent>

        <TabsContent value="sale" className="mt-6">
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-2">Référence</th>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Client</th>
                  <th className="px-4 py-2 text-right">Total</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {eligibleSales.map(s => {
                  const c = (customers.data ?? []).find(c => c.id === s.customer_id);
                  return (
                    <tr key={s.id} className="hover:bg-muted/30">
                      <td className="px-4 py-2 font-mono">{s.reference}</td>
                      <td className="px-4 py-2">{formatDate(s.created_at)}</td>
                      <td className="px-4 py-2">{c ? customerName(c) : "Client comptoir"}</td>
                      <td className="px-4 py-2 text-right font-mono">{formatMoney(s.total)}</td>
                      <td className="px-4 py-2 text-right">
                        <Button size="sm" variant="outline" disabled={submitting} onClick={() => fromSale(s.id)}>Facturer</Button>
                      </td>
                    </tr>
                  );
                })}
                {eligibleSales.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    Aucune vente à facturer. <Link to="/pos" className="text-accent hover:underline">Aller à la caisse</Link>
                  </td></tr>
                )}
              </tbody>
            </table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
