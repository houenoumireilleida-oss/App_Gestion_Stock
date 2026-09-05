import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchMovements, fetchProducts, fetchWarehouses, formatDate, MOVEMENT_LABEL } from "@/lib/stock";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SectionHero } from "@/components/SectionHero";
import { Plus, ArrowDownRight, ArrowUpRight, RefreshCw, ArrowLeftRight, Package, AlertTriangle, PackageMinus, Warehouse } from "lucide-react";

export const Route = createFileRoute("/_authenticated/movements/")({
  head: () => ({ meta: [{ title: "Mouvements de stock — StockFlow" }] }),
  component: MovementsList,
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

function MovementsList() {
  const moves = useQuery({ queryKey: ["movements", "all"], queryFn: () => fetchMovements(200) });
  const products = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const warehouses = useQuery({ queryKey: ["warehouses"], queryFn: fetchWarehouses });
  const profiles = useQuery({ queryKey: ["profiles"], queryFn: fetchProfiles });
  const operatorName = (userId: string | null) => (profiles.data ?? []).find(p => p.user_id === userId)?.display_name ?? "—";

  const icon = {
    in: <ArrowDownRight className="size-4 text-success" />,
    out: <ArrowUpRight className="size-4 text-destructive" />,
    adjustment: <RefreshCw className="size-4 text-warning" />,
    transfer: <ArrowLeftRight className="size-4 text-chart-2" />,
  } as const;

  return (
    <div>
      <SectionHero
        eyebrow="Stock"
        title="Inventaire multi-sites, mouvements, défectueux et déstockage"
        links={STOCK_LINKS}
      />
      <div className="p-6 lg:p-10 space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="size-11 rounded-xl bg-[var(--sidebar)] text-white grid place-items-center shrink-0">
              <ArrowLeftRight className="size-5" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Mouvements</h1>
              <p className="text-sm text-muted-foreground">{moves.data?.length ?? 0} mouvement{(moves.data?.length ?? 0) > 1 ? "s" : ""} récent{(moves.data?.length ?? 0) > 1 ? "s" : ""}</p>
            </div>
          </div>
          <Link to="/movements/new"><Button><Plus className="size-4 mr-1" /> Nouveau mouvement</Button></Link>
        </header>

        {moves.data && moves.data.length > 0 ? (
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="overflow-hidden lg:col-span-2">
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="table-head-dark text-left">
                  <tr>
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Nature</th>
                    <th className="px-4 py-2">Référence</th>
                    <th className="px-4 py-2 text-right">Quantité</th>
                    <th className="px-4 py-2">Site</th>
                    <th className="px-4 py-2">Opérateur</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {moves.data.map(m => {
                    const p = products.data?.find(p => p.id === m.product_id);
                    const w = warehouses.data?.find(w => w.id === m.warehouse_id);
                    const dest = warehouses.data?.find(w => w.id === m.destination_warehouse_id);
                    const nature = m.reason ? `${MOVEMENT_LABEL[m.type]} — ${m.reason}` : MOVEMENT_LABEL[m.type];
                    return (
                      <tr key={m.id} className="hover:bg-muted/30">
                        <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">{formatDate(m.created_at)}</td>
                        <td className="px-4 py-2"><span className="inline-flex items-center gap-1.5">{icon[m.type]} {nature}</span></td>
                        <td className="px-4 py-2 font-mono text-xs">{p?.sku ?? "—"}</td>
                        <td className="px-4 py-2 text-right font-mono tabular-nums">
                          {m.type === "out" || m.type === "transfer" ? "−" : "+"}{m.quantity}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {w?.name ?? "—"}{dest && ` → ${dest.name}`}
                        </td>
                        <td className="px-4 py-2">{operatorName(m.created_by)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </Card>

            <Card className="p-5 border-l-4 border-l-destructive h-fit">
              <p className="text-xs font-semibold uppercase tracking-wide text-destructive mb-2">Règles de gestion</p>
              <ul className="space-y-1.5 text-sm text-foreground/90 list-disc list-inside">
                <li>Mise à jour automatique du stock à chaque vente encaissée.</li>
                <li>Sortie de type déstockage impossible sans approbation admin.</li>
                <li>Inventaire tournant avec écarts justifiés obligatoires.</li>
              </ul>
            </Card>
          </div>
        ) : (
          <Card className="p-12 text-center">
            <ArrowLeftRight className="size-10 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium">Aucun mouvement enregistré</p>
            <p className="text-sm text-muted-foreground mt-1">Enregistrez une entrée, une sortie ou un ajustement de stock.</p>
            <Link to="/movements/new"><Button className="mt-4"><Plus className="size-4 mr-1" /> Créer un mouvement</Button></Link>
          </Card>
        )}
      </div>
    </div>
  );
}