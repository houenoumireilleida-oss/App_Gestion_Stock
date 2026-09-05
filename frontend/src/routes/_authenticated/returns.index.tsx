import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchReturns, decideReturn } from "@/lib/workflows";
import { fetchSales } from "@/lib/sales";
import { fetchProducts, formatDate, formatMoney } from "@/lib/stock";
import { useMyRoles, hasAny } from "@/lib/roles";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SectionHero } from "@/components/SectionHero";
import { toast } from "sonner";
import { Undo2, Plus, Check, X, ShoppingCart, Receipt, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/returns/")({
  head: () => ({ meta: [{ title: "Retours clients — StockFlow" }] }),
  component: ReturnsPage,
});

const VENTE_LINKS = [
  { to: "/pos", label: "Caisse", icon: ShoppingCart },
  { to: "/sales", label: "Ventes", icon: Receipt },
  { to: "/cash-sessions", label: "Sessions & Clôture Z", icon: Wallet },
  { to: "/returns", label: "Retours clients", icon: Undo2 },
];

type ReturnItem = { id: string; return_id: string; product_id: string; quantity: number; unit_price: number };

async function fetchReturnItems(): Promise<ReturnItem[]> {
  const { data, error } = await supabase.from("customer_return_items").select("*");
  if (error) throw error;
  return data as ReturnItem[];
}

/** Readable treatment label derived from the real destination + refund_type fields
 *  (no invented data — just a plain-language combination of what's already stored). */
function treatmentLabel(destination: "stock" | "defective", refundType: "cash" | "store_credit" | "none") {
  if (destination === "defective") {
    if (refundType === "cash") return "Remboursement espèces";
    if (refundType === "store_credit") return "Avoir client";
    return "Passage en défectueux";
  }
  if (refundType === "cash") return "Remboursement espèces — stock réintégré";
  if (refundType === "store_credit") return "Avoir client";
  return "Échange — stock réintégré";
}

function ReturnsPage() {
  const qc = useQueryClient();
  const { data: roles } = useMyRoles();
  const isAdmin = hasAny(roles, "admin");
  const rows = useQuery({ queryKey: ["returns"], queryFn: fetchReturns });
  const items = useQuery({ queryKey: ["return_items"], queryFn: fetchReturnItems });
  const sales = useQuery({ queryKey: ["sales", "returns"], queryFn: () => fetchSales(300) });
  const products = useQuery({ queryKey: ["products"], queryFn: fetchProducts });

  const list = rows.data ?? [];

  async function decide(id: string, ok: boolean) {
    try {
      await decideReturn(id, ok);
      toast.success(ok ? "Retour approuvé, stock mis à jour" : "Rejeté");
      qc.invalidateQueries({ queryKey: ["returns"] });
      qc.invalidateQueries({ queryKey: ["stock_levels"] });
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div>
      <SectionHero
        eyebrow="Vente"
        title="Encaissement, tickets, sessions de caisse et retours clients"
        links={VENTE_LINKS}
      />
      <div className="p-6 lg:p-10 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="size-11 rounded-xl bg-[var(--sidebar)] text-white grid place-items-center shrink-0">
              <Undo2 className="size-5" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Retours clients</h1>
              <p className="text-sm text-muted-foreground">{list.length} retour{list.length > 1 ? "s" : ""}</p>
            </div>
          </div>
          <Link to="/returns/new"><Button><Plus className="size-4" /> Nouveau retour</Button></Link>
        </div>

        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="table-head-dark text-left">
                <tr>
                  <th className="px-4 py-2">Retour</th>
                  <th className="px-4 py-2">Vente d'origine</th>
                  <th className="px-4 py-2">Produit</th>
                  <th className="px-4 py-2 text-right">Qté</th>
                  <th className="px-4 py-2">Motif</th>
                  <th className="px-4 py-2">Traitement</th>
                  <th className="px-4 py-2">Statut</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {list.map(r => {
                  const sale = (sales.data ?? []).find(s => s.id === r.sale_id);
                  const lines = (items.data ?? []).filter(it => it.return_id === r.id);
                  const productLabel = lines.length === 0
                    ? "—"
                    : lines.length === 1
                      ? (products.data ?? []).find(p => p.id === lines[0].product_id)?.name ?? "—"
                      : `${lines.length} articles`;
                  const qty = lines.reduce((s, l) => s + l.quantity, 0);
                  return (
                    <tr key={r.id} className="hover:bg-muted/30">
                      <td className="px-4 py-2 font-mono text-xs">RET-{r.id.slice(0, 4).toUpperCase()}</td>
                      <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{sale?.reference ?? r.sale_id.slice(0, 8)}</td>
                      <td className="px-4 py-2">{productLabel}</td>
                      <td className="px-4 py-2 text-right font-mono">{qty || "—"}</td>
                      <td className="px-4 py-2 text-muted-foreground max-w-xs truncate">{r.reason}</td>
                      <td className="px-4 py-2">{treatmentLabel(r.destination, r.refund_type)}</td>
                      <td className="px-4 py-2">
                        {r.status === "pending" && <Badge variant="warning">En attente</Badge>}
                        {r.status === "approved" && <Badge variant="success">Approuvée</Badge>}
                        {r.status === "rejected" && <Badge variant="danger">Rejetée</Badge>}
                      </td>
                      <td className="px-4 py-2">
                        {isAdmin && r.status === "pending" && (
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" variant="outline" onClick={() => decide(r.id, true)}><Check className="size-4" /></Button>
                            <Button size="sm" variant="outline" onClick={() => decide(r.id, false)}><X className="size-4" /></Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {list.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Aucun retour.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-5 border-l-4 border-l-destructive">
          <p className="text-xs font-semibold uppercase tracking-wide text-destructive mb-2">Règles de traitement</p>
          <ul className="space-y-1.5 text-sm text-foreground/90 list-disc list-inside">
            <li>Produit en bon état : réintégration automatique au stock.</li>
            <li>Produit endommagé : création d'une fiche défectueux.</li>
            <li>Remboursement en espèces au-delà du seuil : approbation administrateur.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}