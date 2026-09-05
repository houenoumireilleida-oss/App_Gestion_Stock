import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchDefective, decideDefective, setDefectiveTreatment, SEVERITY_LABEL, DEF_CAT_LABEL, STATUS_LABEL, TREATMENT_LABEL, type DefTreatment } from "@/lib/workflows";
import { fetchProducts, fetchWarehouses, formatDate, formatMoney } from "@/lib/stock";
import { useMyRoles, hasAny } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionHero } from "@/components/SectionHero";
import { toast } from "sonner";
import { AlertTriangle, Plus, Check, X, Package, ArrowLeftRight, PackageMinus, Warehouse } from "lucide-react";

export const Route = createFileRoute("/_authenticated/defective/")({
  head: () => ({ meta: [{ title: "Défectueux — StockFlow" }] }),
  component: DefectivePage,
});

const STOCK_LINKS = [
  { to: "/products", label: "Produits", icon: Package },
  { to: "/movements", label: "Mouvements", icon: ArrowLeftRight },
  { to: "/defective", label: "Défectueux", icon: AlertTriangle },
  { to: "/destocking", label: "Déstockage", icon: PackageMinus },
  { to: "/warehouses", label: "Entrepôts", icon: Warehouse },
];

type Profile = { user_id: string; display_name: string };
async function fetchProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase.from("user_profiles").select("user_id, display_name");
  if (error) throw error;
  return data as Profile[];
}

function statusVariant(status: string): "warning" | "success" | "danger" | "secondary" {
  if (status === "confirmed") return "success";
  if (status === "rejected") return "danger";
  return "warning"; // pending_confirmation, applied
}

function DefectivePage() {
  const qc = useQueryClient();
  const { data: roles } = useMyRoles();
  const isAdmin = hasAny(roles, "admin");
  const items = useQuery({ queryKey: ["defective"], queryFn: fetchDefective });
  const products = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const wh = useQuery({ queryKey: ["warehouses"], queryFn: fetchWarehouses });
  const profiles = useQuery({ queryKey: ["profiles"], queryFn: fetchProfiles });
  const pMap = new Map((products.data ?? []).map(p => [p.id, p]));
  const wMap = new Map((wh.data ?? []).map(w => [w.id, w.name]));
  const declarantName = (userId: string | null) => (profiles.data ?? []).find(p => p.user_id === userId)?.display_name ?? "—";

  const list = items.data ?? [];
  const costOfLosses = list
    .filter(it => it.status !== "rejected")
    .reduce((s, it) => s + (pMap.get(it.product_id)?.cost ?? 0) * it.quantity, 0);
  const criticalCount = list.filter(it => it.severity === "critique").length;
  const toHandleCount = list.filter(it => it.status === "pending_confirmation" || (it.status === "applied" && !it.treatment)).length;
  const supplierReturnCount = list.filter(it => it.treatment === "retour_fournisseur").length;

  async function decide(id: string, ok: boolean) {
    try { await decideDefective(id, ok); toast.success(ok ? "Confirmé" : "Rejeté");
      qc.invalidateQueries({ queryKey: ["defective"] });
      qc.invalidateQueries({ queryKey: ["stock_levels"] });
    } catch (e) { toast.error((e as Error).message); }
  }
  async function applyTreatment(id: string, t: DefTreatment) {
    try { await setDefectiveTreatment(id, t); toast.success("Traitement enregistré");
      qc.invalidateQueries({ queryKey: ["defective"] });
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
        <header className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="size-11 rounded-xl bg-[var(--sidebar)] text-white grid place-items-center shrink-0">
              <AlertTriangle className="size-5" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Défectueux</h1>
              <p className="text-sm text-muted-foreground">{list.length} déclaration{list.length > 1 ? "s" : ""}</p>
            </div>
          </div>
          <Link to="/defective/new"><Button><Plus className="size-4" /> Nouvelle déclaration</Button></Link>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-5 card-accent-top card-accent-danger">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Coût des pertes</p>
            <p className="text-2xl font-semibold mt-2 tracking-tight">{formatMoney(costOfLosses)}</p>
          </Card>
          <Card className="p-5 card-accent-top border-t-warning">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Gravité critique</p>
            <p className="text-2xl font-semibold mt-2 tracking-tight">{criticalCount}</p>
          </Card>
          <Card className="p-5 card-accent-top border-t-warning">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">À traiter</p>
            <p className="text-2xl font-semibold mt-2 tracking-tight">{toHandleCount}</p>
          </Card>
          <Card className="p-5 card-accent-top card-accent-teal">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Retours fournisseurs</p>
            <p className="text-2xl font-semibold mt-2 tracking-tight">{supplierReturnCount}</p>
          </Card>
        </div>

        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="table-head-dark text-left">
              <tr>
                <th className="px-4 py-2">Fiche</th>
                <th className="px-4 py-2">Référence</th>
                <th className="px-4 py-2">Produit</th>
                <th className="px-4 py-2 text-right">Qté</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Gravité</th>
                <th className="px-4 py-2">Déclarant</th>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Traitement</th>
                <th className="px-4 py-2">Statut</th>
                {isAdmin && <th className="px-4 py-2"></th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {list.map(it => {
                const p = pMap.get(it.product_id);
                return (
                  <tr key={it.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2 font-mono text-xs">DEF-{it.id.slice(0, 4).toUpperCase()}</td>
                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{p?.sku ?? "—"}</td>
                    <td className="px-4 py-2">{p?.name ?? "—"}</td>
                    <td className="px-4 py-2 text-right font-mono">{it.quantity}</td>
                    <td className="px-4 py-2 text-muted-foreground">{DEF_CAT_LABEL[it.category]}</td>
                    <td className="px-4 py-2">
                      <Badge variant={it.severity === "critique" ? "danger" : it.severity === "majeur" ? "warning" : "secondary"}>
                        {SEVERITY_LABEL[it.severity]}
                      </Badge>
                    </td>
                    <td className="px-4 py-2">{declarantName(it.reported_by)}</td>
                    <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">{formatDate(it.created_at)}</td>
                    <td className="px-4 py-2">
                      {(it.status === "applied" || it.status === "confirmed") ? (
                        it.treatment ? (
                          <span className="text-sm text-muted-foreground">{TREATMENT_LABEL[it.treatment]}</span>
                        ) : (
                          <Select onValueChange={v => applyTreatment(it.id, v as DefTreatment)}>
                            <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="Choisir…" /></SelectTrigger>
                            <SelectContent>
                              {(Object.keys(TREATMENT_LABEL) as DefTreatment[]).map(t =>
                                <SelectItem key={t} value={t}>{TREATMENT_LABEL[t]}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        )
                      ) : "—"}
                    </td>
                    <td className="px-4 py-2"><Badge variant={statusVariant(it.status)}>{STATUS_LABEL[it.status]}</Badge></td>
                    {isAdmin && (
                      <td className="px-4 py-2">
                        {(it.status === "pending_confirmation" || it.status === "applied") && (
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" variant="outline" onClick={() => decide(it.id, true)}><Check className="size-4" /></Button>
                            <Button size="sm" variant="outline" onClick={() => decide(it.id, false)}><X className="size-4" /></Button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
              {list.length === 0 && (
                <tr><td colSpan={isAdmin ? 11 : 10} className="px-4 py-8 text-center text-muted-foreground">Aucune déclaration.</td></tr>
              )}
            </tbody>
          </table>
          </div>
        </Card>
      </div>
    </div>
  );
}