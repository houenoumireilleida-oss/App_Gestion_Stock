import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { fetchProducts, fetchWarehouses, fetchStockLevels, formatMoney, type Product } from "@/lib/stock";
import { fetchCustomers, customerName, type Customer } from "@/lib/customers";
import { checkoutSale, PAYMENT_LABEL, type PaymentMethod } from "@/lib/sales";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Minus, Trash2, ScanLine, X, UserPlus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/pos")({
  head: () => ({ meta: [{ title: "Caisse — StockFlow" }] }),
  component: POSPage,
});

type CartLine = { product: Product; qty: number; discount: number };

function POSPage() {
  const products = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const warehouses = useQuery({ queryKey: ["warehouses"], queryFn: fetchWarehouses });
  const levels = useQuery({ queryKey: ["stock_levels"], queryFn: fetchStockLevels });
  const customers = useQuery({ queryKey: ["customers"], queryFn: fetchCustomers });
  const qc = useQueryClient();

  const [warehouseId, setWarehouseId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const [payOpen, setPayOpen] = useState(false);

  // default warehouse
  if (!warehouseId && warehouses.data && warehouses.data.length > 0) {
    setWarehouseId(warehouses.data[0].id);
  }

  const stockMap = useMemo(() => {
    const m = new Map<string, number>();
    if (warehouseId && levels.data) {
      for (const l of levels.data) {
        if (l.warehouse_id === warehouseId) m.set(l.product_id, l.quantity);
      }
    }
    return m;
  }, [levels.data, warehouseId]);

  const filtered = useMemo(() => {
    const list = products.data ?? [];
    if (!search.trim()) return list.slice(0, 24);
    const q = search.toLowerCase().trim();
    return list.filter(p =>
      p.sku.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q) ||
      (p.barcode ?? "").includes(q)
    ).slice(0, 24);
  }, [products.data, search]);

  function addToCart(p: Product) {
    setCart(prev => {
      const idx = prev.findIndex(l => l.product.id === p.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      return [...prev, { product: p, qty: 1, discount: 0 }];
    });
  }

  function setQty(productId: string, qty: number) {
    setCart(prev => prev.map(l => l.product.id === productId ? { ...l, qty: Math.max(1, qty) } : l));
  }
  function removeLine(productId: string) {
    setCart(prev => prev.filter(l => l.product.id !== productId));
  }

  // Barcode scan: Enter in search => match by barcode/sku
  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && search.trim()) {
      const q = search.trim();
      const list = products.data ?? [];
      const match = list.find(p => p.barcode === q || p.sku === q) ?? filtered[0];
      if (match) { addToCart(match); setSearch(""); }
    }
  }

  const subtotal = cart.reduce((s, l) => s + (l.product.price * l.qty) - l.discount, 0);
  const total = Math.max(0, subtotal - globalDiscount);

  function clearCart() {
    setCart([]); setGlobalDiscount(0); setCustomer(null);
  }

  return (
    <div className="h-[calc(100vh-2rem)] md:h-screen grid grid-cols-1 lg:grid-cols-[1fr_22rem]">
      {/* Catalog */}
      <div className="p-4 lg:p-6 overflow-auto">
        <header className="flex flex-wrap items-center gap-3 mb-4">
          <h1 className="text-2xl font-semibold">Caisse</h1>
          <Select value={warehouseId} onValueChange={setWarehouseId}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Entrepôt" /></SelectTrigger>
            <SelectContent>
              {(warehouses.data ?? []).map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="relative flex-1 min-w-[16rem]">
            <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              autoFocus value={search} onChange={e => setSearch(e.target.value)} onKeyDown={onSearchKey}
              placeholder="Scanner ou rechercher (nom, SKU, code-barres) — Entrée pour ajouter"
              className="pl-9"
            />
          </div>
        </header>

        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map(p => {
            const qty = stockMap.get(p.id) ?? 0;
            return (
              <button key={p.id} onClick={() => addToCart(p)}
                className="text-left bg-card border rounded-lg p-3 hover:border-accent hover:shadow-sm transition">
                <div className="text-xs text-muted-foreground">{p.sku}</div>
                <div className="font-medium text-sm line-clamp-2 min-h-[2.5rem]">{p.name}</div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm font-semibold">{formatMoney(p.price)}</span>
                  <span className={`text-xs ${qty <= p.low_stock_threshold ? "text-warning" : "text-muted-foreground"}`}>
                    {qty} en stock
                  </span>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="col-span-full text-center text-sm text-muted-foreground py-12">
              Aucun produit. <Link to="/products/new" className="text-accent hover:underline">En créer un</Link>
            </p>
          )}
        </div>
      </div>

      {/* Cart */}
      <div className="border-l bg-card flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <Select value={customer?.id ?? "_none"} onValueChange={(v) => {
              setCustomer(v === "_none" ? null : (customers.data ?? []).find(c => c.id === v) ?? null);
            }}>
              <SelectTrigger className="flex-1"><SelectValue placeholder="Client (optionnel)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— Sans client —</SelectItem>
                {(customers.data ?? []).map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {customerName(c)} · {c.loyalty_points} pts
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Link to="/customers"><Button variant="outline" size="icon"><UserPlus className="size-4" /></Button></Link>
          </div>
        </div>

        <div className="flex-1 overflow-auto divide-y">
          {cart.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">Panier vide</div>
          )}
          {cart.map(l => (
            <div key={l.product.id} className="p-3 flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{l.product.name}</div>
                <div className="text-xs text-muted-foreground">{formatMoney(l.product.price)} × {l.qty}</div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="size-7" onClick={() => setQty(l.product.id, l.qty - 1)}><Minus className="size-3" /></Button>
                <span className="w-8 text-center text-sm font-mono">{l.qty}</span>
                <Button variant="outline" size="icon" className="size-7" onClick={() => setQty(l.product.id, l.qty + 1)}><Plus className="size-3" /></Button>
                <Button variant="ghost" size="icon" className="size-7 text-destructive" onClick={() => removeLine(l.product.id)}><Trash2 className="size-3" /></Button>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t space-y-3">
          <div className="flex items-center justify-between text-sm">
            <label>Remise globale (FCFA)</label>
            <Input type="number" min={0} step="1" value={globalDiscount || ""}
              onChange={e => setGlobalDiscount(parseFloat(e.target.value) || 0)}
              className="w-24 text-right" />
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Sous-total</span><span>{formatMoney(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-lg font-semibold">
            <span>Total TTC</span><span>{formatMoney(total)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={clearCart} disabled={cart.length === 0}>
              <X className="size-4" /> Annuler
            </Button>
            <Button onClick={() => setPayOpen(true)} disabled={cart.length === 0 || !warehouseId}>
              Encaisser
            </Button>
          </div>
        </div>
      </div>

      <PaymentDialog
        open={payOpen} onOpenChange={setPayOpen}
        total={total}
        onConfirm={async (payments) => {
          try {
            const id = await checkoutSale({
              warehouse_id: warehouseId,
              customer_id: customer?.id ?? null,
              discount_amount: globalDiscount,
              items: cart.map(l => ({
                product_id: l.product.id,
                quantity: l.qty,
                unit_price: l.product.price,
                discount_amount: l.discount,
              })),
              payments,
            });
            toast.success("Vente enregistrée");
            qc.invalidateQueries({ queryKey: ["stock_levels"] });
            qc.invalidateQueries({ queryKey: ["movements", "recent"] });
            qc.invalidateQueries({ queryKey: ["customers"] });
            qc.invalidateQueries({ queryKey: ["sales"] });
            clearCart();
            setPayOpen(false);
            // open ticket in new tab
            window.open(`/sales/${id}?print=1`, "_blank");
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Erreur encaissement";
            toast.error(msg);
          }
        }}
      />
    </div>
  );
}

function PaymentDialog({ open, onOpenChange, total, onConfirm }: {
  open: boolean; onOpenChange: (v: boolean) => void; total: number;
  onConfirm: (payments: { method: PaymentMethod; amount: number; tendered?: number; change_given?: number }[]) => void;
}) {
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [lines, setLines] = useState<{ method: PaymentMethod; amount: number }[]>([]);
  const [tendered, setTendered] = useState<string>("");

  const paidSoFar = lines.reduce((s, l) => s + l.amount, 0);
  const remaining = Math.max(0, total - paidSoFar);
  const change = method === "cash" && tendered ? Math.max(0, parseFloat(tendered) - remaining) : 0;

  function addPayment(splitAmount?: number) {
    const amt = splitAmount ?? remaining;
    if (amt <= 0) return;
    setLines(prev => [...prev, { method, amount: amt }]);
    setTendered("");
  }

  function confirm() {
    const all = [...lines];
    if (remaining > 0) all.push({ method, amount: remaining });
    onConfirm(all.map(l => ({
      method: l.method, amount: l.amount,
      tendered: l.method === "cash" && tendered ? parseFloat(tendered) : undefined,
      change_given: l.method === "cash" ? change : 0,
    })));
    setLines([]); setTendered("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Paiement · {formatMoney(total)}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {lines.length > 0 && (
            <div className="border rounded-md divide-y">
              {lines.map((l, i) => (
                <div key={i} className="flex items-center justify-between p-2 text-sm">
                  <span>{PAYMENT_LABEL[l.method]}</span>
                  <span className="font-mono">{formatMoney(l.amount)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between p-2 text-sm font-medium">
                <span>Restant</span><span className="font-mono">{formatMoney(remaining)}</span>
              </div>
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">
            {(["cash", "card", "transfer", "check", "voucher", "other"] as PaymentMethod[]).map(m => (
              <Button key={m} variant={method === m ? "default" : "outline"} onClick={() => setMethod(m)}>
                {PAYMENT_LABEL[m]}
              </Button>
            ))}
          </div>
          {method === "cash" && (
            <div className="space-y-2">
              <label className="text-sm">Montant reçu (FCFA)</label>
              <Input type="number" step="1" value={tendered} onChange={e => setTendered(e.target.value)}
                placeholder={Math.round(remaining).toString()} />
              {change > 0 && (
                <div className="text-sm">Rendu : <span className="font-semibold">{formatMoney(change)}</span></div>
              )}
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => addPayment(remaining / 2)} disabled={remaining <= 0}>
              Paiement fractionné (½)
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={confirm}>Valider l'encaissement</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
