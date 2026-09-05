import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchPurchaseOrders, fetchSuppliers, PO_STATUS_LABEL, generateReorderPO, type POItem } from "@/lib/purchasing";
import { fetchWarehouses, fetchProducts, formatDate, formatMoney } from "@/lib/stock";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { SectionHero } from "@/components/SectionHero";
import { toast } from "sonner";
import { Plus, Wand2, Truck, ClipboardList, PackageX } from "lucide-react";

export const Route = createFileRoute("/_authenticated/purchase-orders/")({
  head: () => ({ meta: [{ title: "Commandes fournisseur — StockFlow" }] }),
  component: POList,
});

const PURCHASING_LINKS = [
  { to: "/suppliers", label: "Fournisseurs", icon: Truck },
  { to: "/purchase-orders", label: "Commandes", icon: ClipboardList },
  { to: "/supplier-returns", label: "Retours fournisseurs", icon: PackageX },
];

async function fetchAllPOItems(): Promise<POItem[]> {
  const { data, error } = await supabase.from("purchase_order_items").select("*");
  if (error) throw error;
  return data as POItem[];
}

function POList() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["pos"], queryFn: fetchPurchaseOrders });
  const sup = useQuery({ queryKey: ["suppliers"], queryFn: fetchSuppliers });
  const wh = useQuery({ queryKey: ["warehouses"], queryFn: fetchWarehouses });
  const products = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const items = useQuery({ queryKey: ["po_items", "all"], queryFn: fetchAllPOItems });

  const [open, setOpen] = useState(false);
  const [rSup, setRSup] = useState("");
  const [rWh, setRWh] = useState("");

  const tone: Record<string, "outline" | "warning" | "success" | "danger"> = {
    draft: "outline", ordered: "warning", partial: "warning", received: "success", cancelled: "danger",
  };

  function poItems(poId: string) {
    return (items.data ?? []).filter(it => it.po_id === poId);
  }
  function poTotal(poId: string) {
    return poItems(poId).reduce((s, it) => s + it.ordered_qty * it.unit_cost, 0);
  }
  function poArticlesLabel(poId: string) {
    const lines = poItems(poId);
    if (lines.length === 0) return "—";
    const first = lines[0];
    const p = (products.data ?? []).find(p => p.id === first.product_id);
    const label = `${p?.name ?? "Article"} × ${first.ordered_qty}`;
    return lines.length > 1 ? `${label} +${lines.length - 1}` : label;
  }

  const list = q.data ?? [];
  const engagedTotal = list.filter(p => p.status !== "cancelled").reduce((s, p) => s + poTotal(p.id), 0);
  const awaitingCount = list.filter(p => p.status === "ordered" || p.status === "partial").length;
  const receivedCount = list.filter(p => p.status === "received").length;

  async function doReorder() {
    if (!rSup || !rWh) { toast.error("Fournisseur et entrepôt requis"); return; }
    try {
      await generateReorderPO(rSup, rWh);
      toast.success("Bon de commande de réappro créé");
      setOpen(false); setRSup(""); setRWh("");
      qc.invalidateQueries({ queryKey: ["pos"] });
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div>
      <SectionHero
        eyebrow="Achats"
        title="Fournisseurs, commandes et retours d'approvisionnement"
        links={PURCHASING_LINKS}
      />
      <div className="p-6 lg:p-10 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="size-11 rounded-xl bg-[var(--sidebar)] text-white grid place-items-center shrink-0">
            <ClipboardList className="size-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Commandes</h1>
            <p className="text-sm text-muted-foreground">{list.length} bon{list.length > 1 ? "s" : ""} de commande</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button variant="outline"><Wand2 className="size-4" /> Réappro auto</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Générer un BC de réapprovisionnement</DialogTitle></DialogHeader>
              <p className="text-sm text-muted-foreground">Crée un brouillon avec tous les produits sous leur seuil bas dans l'entrepôt choisi.</p>
              <div className="space-y-3">
                <div><Label>Fournisseur</Label>
                  <Select value={rSup} onValueChange={setRSup}>
                    <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                    <SelectContent>{(sup.data ?? []).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Entrepôt</Label>
                  <Select value={rWh} onValueChange={setRWh}>
                    <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                    <SelectContent>{(wh.data ?? []).map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
                <Button onClick={doReorder}>Générer</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Link to="/purchase-orders/new"><Button><Plus className="size-4" /> Nouveau bon de commande</Button></Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5 card-accent-top card-accent-navy">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Montant engagé</p>
          <p className="text-2xl font-semibold mt-2 tracking-tight">{formatMoney(engagedTotal)}</p>
        </Card>
        <Card className="p-5 card-accent-top border-t-warning">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">En attente de réception</p>
          <p className="text-2xl font-semibold mt-2 tracking-tight">{awaitingCount}</p>
        </Card>
        <Card className="p-5 card-accent-top card-accent-teal">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Réceptionnées</p>
          <p className="text-2xl font-semibold mt-2 tracking-tight">{receivedCount}</p>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="table-head-dark text-left">
            <tr>
              <th className="px-4 py-2">Bon de commande</th>
              <th className="px-4 py-2">Fournisseur</th>
              <th className="px-4 py-2">Articles</th>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2 text-right">Montant</th>
              <th className="px-4 py-2">Statut</th>
              <th className="px-4 py-2">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {list.map(p => {
              const s = (sup.data ?? []).find(s => s.id === p.supplier_id);
              return (
                <tr key={p.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2"><Link to="/purchase-orders/$id" params={{ id: p.id }} className="text-accent hover:underline font-mono text-xs">{p.reference}</Link></td>
                  <td className="px-4 py-2">{s?.name ?? "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground">{poArticlesLabel(p.id)}</td>
                  <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">{formatDate(p.created_at)}</td>
                  <td className="px-4 py-2 text-right font-mono">{formatMoney(poTotal(p.id))}</td>
                  <td className="px-4 py-2"><Badge variant={tone[p.status]}>{PO_STATUS_LABEL[p.status]}</Badge></td>
                  <td className="px-4 py-2">
                    {p.status === "received"
                      ? <span className="text-sm text-muted-foreground">Réceptionné</span>
                      : p.status !== "cancelled" && (
                        <Link to="/purchase-orders/$id" params={{ id: p.id }}>
                          <Button size="sm" variant="outline">Réceptionner</Button>
                        </Link>
                      )}
                  </td>
                </tr>
              );
            })}
            {list.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Aucune commande.</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </Card>
      </div>
    </div>
  );
}