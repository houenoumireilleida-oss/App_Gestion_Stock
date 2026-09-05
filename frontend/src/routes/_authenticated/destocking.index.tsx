import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { fetchDestocking, decideDestocking, STATUS_LABEL } from "@/lib/workflows";
import { fetchProducts, fetchWarehouses, formatDate } from "@/lib/stock";
import { useMyRoles, hasAny } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SectionHero } from "@/components/SectionHero";
import { toast } from "sonner";
import { PackageMinus, Plus, Check, X, Package, ArrowLeftRight, AlertTriangle, Warehouse } from "lucide-react";

export const Route = createFileRoute("/_authenticated/destocking/")({
  head: () => ({ meta: [{ title: "Déstockage — StockFlow" }] }),
  component: DestockingPage,
});

const STOCK_LINKS = [
  { to: "/products", label: "Produits", icon: Package },
  { to: "/movements", label: "Mouvements", icon: ArrowLeftRight },
  { to: "/defective", label: "Défectueux", icon: AlertTriangle },
  { to: "/destocking", label: "Déstockage", icon: PackageMinus },
  { to: "/warehouses", label: "Entrepôts", icon: Warehouse },
];

function statusVariant(status: string): "warning" | "success" | "danger" {
  if (status === "approved") return "success";
  if (status === "rejected") return "danger";
  return "warning";
}

function DestockingPage() {
  const qc = useQueryClient();
  const { data: roles } = useMyRoles();
  const isAdmin = hasAny(roles, "admin");
  const rows = useQuery({ queryKey: ["destocking"], queryFn: fetchDestocking });
  const products = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const wh = useQuery({ queryKey: ["warehouses"], queryFn: fetchWarehouses });
  const pMap = new Map((products.data ?? []).map(p => [p.id, p]));
  const wMap = new Map((wh.data ?? []).map(w => [w.id, w.name]));
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [approve, setApprove] = useState(true);
  const [note, setNote] = useState("");
  const [partialQty, setPartialQty] = useState<string>("");
  const list = rows.data ?? [];
  const decidingRow = list.find(r => r.id === decidingId);

  const now = new Date();
  const thisMonthCount = list.filter(r => {
    const d = new Date(r.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const approvedCount = list.filter(r => r.status === "approved").length;
  const rejectedCount = list.filter(r => r.status === "rejected").length;

  async function submit() {
    if (!decidingId) return;
    try {
      const partial = partialQty.trim() ? parseInt(partialQty) : null;
      await decideDestocking(decidingId, approve, note, partial);
      toast.success(approve ? "Approuvée, stock mis à jour" : "Rejetée");
      setDecidingId(null); setNote(""); setPartialQty("");
      qc.invalidateQueries({ queryKey: ["destocking"] });
      qc.invalidateQueries({ queryKey: ["stock_levels"] });
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div>
      <SectionHero
        eyebrow="Stock"
        title="Inventaire multi-sites, mouvements, défectueux et déstockage"
        links={STOCK_LINKS}
      />
      <div className="p-6 lg:p-10 space-y-6">
        <header className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span className="size-11 rounded-xl bg-[var(--sidebar)] text-white grid place-items-center shrink-0">
              <PackageMinus className="size-5" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Déstockage</h1>
              <p className="text-sm text-muted-foreground">{list.filter(r => r.status === "pending").length} demande(s) en attente</p>
            </div>
          </div>
          <Link to="/destocking/new"><Button><Plus className="size-4" /> Nouvelle demande</Button></Link>
        </header>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="p-5 card-accent-top card-accent-navy">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Demandes du mois</p>
            <p className="text-2xl font-semibold mt-2 tracking-tight">{thisMonthCount}</p>
          </Card>
          <Card className="p-5 card-accent-top card-accent-teal">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Approuvées</p>
            <p className="text-2xl font-semibold mt-2 tracking-tight">{approvedCount}</p>
          </Card>
          <Card className="p-5 card-accent-top card-accent-danger">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Rejetées</p>
            <p className="text-2xl font-semibold mt-2 tracking-tight">{rejectedCount}</p>
          </Card>
        </div>

        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="table-head-dark text-left">
              <tr>
                <th className="px-4 py-2">Demande</th>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Référence</th>
                <th className="px-4 py-2">Produit</th>
                <th className="px-4 py-2">Site</th>
                <th className="px-4 py-2 text-right">Qté</th>
                <th className="px-4 py-2">Motif</th>
                <th className="px-4 py-2">Statut</th>
                {isAdmin && <th className="px-4 py-2"></th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {list.map(r => {
                const p = pMap.get(r.product_id);
                return (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2 font-mono text-xs">DST-{r.id.slice(0, 4).toUpperCase()}</td>
                    <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">{formatDate(r.created_at)}</td>
                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{p?.sku ?? "—"}</td>
                    <td className="px-4 py-2">{p?.name ?? "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground">{wMap.get(r.warehouse_id) ?? "—"}</td>
                    <td className="px-4 py-2 text-right font-mono">
                      {r.approved_quantity != null ? `${r.approved_quantity} / ${r.quantity}` : r.quantity}
                    </td>
                    <td className="px-4 py-2 max-w-xs truncate">{r.reason}</td>
                    <td className="px-4 py-2"><Badge variant={statusVariant(r.status)}>{STATUS_LABEL[r.status]}</Badge></td>
                    {isAdmin && (
                      <td className="px-4 py-2">
                        {r.status === "pending" && (
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" variant="outline" onClick={() => { setDecidingId(r.id); setApprove(true); }}><Check className="size-4" /></Button>
                            <Button size="sm" variant="outline" onClick={() => { setDecidingId(r.id); setApprove(false); }}><X className="size-4" /></Button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
              {list.length === 0 && <tr><td colSpan={isAdmin ? 9 : 8} className="px-4 py-8 text-center text-muted-foreground">Aucune demande.</td></tr>}
            </tbody>
          </table>
          </div>
        </Card>

        <Card className="p-5 border-l-4 border-l-destructive">
          <p className="text-xs font-semibold uppercase tracking-wide text-destructive mb-2">Règles non contournables</p>
          <ul className="space-y-1.5 text-sm text-foreground/90 list-disc list-inside">
            <li>Aucun déstockage sans approbation de l'administrateur.</li>
            <li>Toute décision est journalisée (identité + horodatage).</li>
            <li>La quantité approuvée peut être partielle par rapport à la demande initiale.</li>
          </ul>
        </Card>
      </div>

      <Dialog open={decidingId !== null} onOpenChange={o => { if (!o) { setDecidingId(null); setPartialQty(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{approve ? "Approuver la demande" : "Rejeter la demande"}</DialogTitle></DialogHeader>
          {approve && decidingRow && (
            <div className="space-y-2">
              <label className="text-sm">Quantité approuvée (max {decidingRow.quantity})</label>
              <Input type="number" min={1} max={decidingRow.quantity}
                placeholder={`Défaut : ${decidingRow.quantity}`}
                value={partialQty} onChange={e => setPartialQty(e.target.value)} />
              <p className="text-xs text-muted-foreground">Laissez vide pour approuver la quantité totale.</p>
            </div>
          )}
          <Textarea placeholder="Note (optionnelle)" value={note} onChange={e => setNote(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecidingId(null)}>Annuler</Button>
            <Button onClick={submit}>Valider</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}