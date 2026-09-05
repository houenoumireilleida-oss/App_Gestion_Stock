import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchSales } from "@/lib/sales";
import { fetchDisbursement } from "@/lib/workflows";
import { fetchProducts, fetchStockLevels, formatMoney } from "@/lib/stock";
import { fetchDefective } from "@/lib/workflows";
import { exportSalesReport, exportDefectiveReport, exportDestockingReport,
  exportDisbursementReport, exportCashClosuresReport, exportAccountingCSV } from "@/lib/exports";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SectionHero } from "@/components/SectionHero";
import { toast } from "sonner";
import { useState } from "react";
import { BarChart3, Banknote, PiggyBank, Download, Receipt, AlertTriangle, PackageMinus, FileSpreadsheet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/finance-reports")({
  head: () => ({ meta: [{ title: "Rapports — StockFlow" }] }),
  component: ReportsPage,
});

const FINANCE_LINKS = [
  { to: "/disbursement", label: "Décaissements", icon: Banknote },
  { to: "/treasury", label: "Trésorerie", icon: PiggyBank },
  { to: "/finance-reports", label: "Rapports", icon: BarChart3 },
];

function daysAgoLabel(d: Date) {
  return d.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "").toUpperCase();
}

function ReportsPage() {
  const sales = useQuery({ queryKey: ["sales", "reports"], queryFn: () => fetchSales(1000) });
  const disbursement = useQuery({ queryKey: ["disbursement"], queryFn: fetchDisbursement });
  const defective = useQuery({ queryKey: ["defective"], queryFn: fetchDefective });
  const products = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const levels = useQuery({ queryKey: ["stock_levels"], queryFn: fetchStockLevels });
  const [exporting, setExporting] = useState<string | null>(null);

  const sevenDaysAgo = new Date(); sevenDaysAgo.setHours(0, 0, 0, 0); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

  const salesLast7 = (sales.data ?? []).filter(s => s.status === "completed" && new Date(s.created_at) >= sevenDaysAgo);
  const revenue7 = salesLast7.reduce((s, x) => s + x.total, 0);
  const avgBasket = salesLast7.length > 0 ? revenue7 / salesLast7.length : 0;

  const defectiveLoss7 = (defective.data ?? [])
    .filter(d => d.status !== "rejected" && new Date(d.created_at) >= sevenDaysAgo)
    .reduce((s, d) => {
      const p = (products.data ?? []).find(p => p.id === d.product_id);
      return s + (p ? p.cost * d.quantity : 0);
    }, 0);

  const disbursement7 = (disbursement.data ?? [])
    .filter(d => d.status === "paid" && new Date(d.created_at) >= sevenDaysAgo)
    .reduce((s, d) => s + d.amount, 0);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (6 - i));
    const next = new Date(d); next.setDate(d.getDate() + 1);
    const total = (sales.data ?? []).filter(s => s.status === "completed" && new Date(s.created_at) >= d && new Date(s.created_at) < next)
      .reduce((s, x) => s + x.total, 0);
    return { label: daysAgoLabel(d), total };
  });
  const maxDay = Math.max(1, ...days.map(d => d.total));

  const rupturedLines = (levels.data ?? []).filter(l => l.quantity <= 0).length;
  const totalLines = (levels.data ?? []).length;
  const ruptureRate = totalLines > 0 ? Math.round((rupturedLines / totalLines) * 100) : 0;

  const reports = [
    { title: "Rapport des ventes", desc: "Par produit, période, vendeur et point de vente", formats: "EXCEL", icon: Receipt, run: exportSalesReport, key: "sales" },
    { title: "Rapport des matériaux défectueux", desc: "Coût des pertes, volumes et tendances", formats: "EXCEL", icon: AlertTriangle, run: exportDefectiveReport, key: "defective" },
    { title: "Rapport des déstockages", desc: "Volumes, valeurs et motifs approuvés", formats: "EXCEL", icon: PackageMinus, run: exportDestockingReport, key: "destocking" },
    { title: "Rapport des décaissements", desc: "Par catégorie, période et bénéficiaire", formats: "EXCEL", icon: Banknote, run: exportDisbursementReport, key: "disbursement" },
    { title: "Clôtures de caisse et écarts", desc: "Rapprochement journalier par caisse", formats: "EXCEL", icon: PiggyBank, run: exportCashClosuresReport, key: "cash" },
    { title: "Export comptable", desc: "Écritures simplifiées (ventes et décaissements payés)", formats: "CSV", icon: FileSpreadsheet, run: exportAccountingCSV, key: "accounting" },
  ];

  async function runExport(key: string, fn: () => Promise<void>) {
    setExporting(key);
    try { await fn(); toast.success("Export généré"); }
    catch (e) { toast.error((e as Error).message); }
    finally { setExporting(null); }
  }

  return (
    <div>
      <SectionHero
        eyebrow="Finances"
        title="Décaissements sous approbation, trésorerie et rapports"
        links={FINANCE_LINKS}
      />
      <div className="p-6 lg:p-10 space-y-6">
        <header className="flex items-center gap-3">
          <span className="size-11 rounded-xl bg-[var(--sidebar)] text-white grid place-items-center shrink-0">
            <BarChart3 className="size-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Rapports</h1>
            <p className="text-sm text-muted-foreground">Période : 7 derniers jours</p>
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-5 card-accent-top card-accent-navy">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">CA 7 jours</p>
            <p className="text-2xl font-semibold mt-2 tracking-tight">{formatMoney(revenue7)}</p>
          </Card>
          <Card className="p-5 card-accent-top card-accent-teal">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Panier moyen</p>
            <p className="text-2xl font-semibold mt-2 tracking-tight">{formatMoney(avgBasket)}</p>
            <p className="text-xs text-muted-foreground mt-1">{salesLast7.length} vente{salesLast7.length > 1 ? "s" : ""}</p>
          </Card>
          <Card className="p-5 card-accent-top card-accent-danger">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Pertes défectueux</p>
            <p className="text-2xl font-semibold mt-2 tracking-tight">{formatMoney(defectiveLoss7)}</p>
          </Card>
          <Card className="p-5 card-accent-top border-t-warning">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Décaissements</p>
            <p className="text-2xl font-semibold mt-2 tracking-tight">{formatMoney(disbursement7)}</p>
          </Card>
        </div>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Chiffre d'affaires hebdomadaire</h2>
          <Card className="p-6">
            <div className="flex items-end gap-3 h-48">
              {days.map(d => (
                <div key={d.label} className="flex-1 flex flex-col items-center gap-2">
                  <span className="text-xs text-muted-foreground">{d.total > 0 ? `${Math.round(d.total / 1000)}k` : "0"}</span>
                  <div className="w-full rounded-t-md" style={{ height: `${Math.max(8, (d.total / maxDay) * 150)}px`, background: "var(--sidebar)" }} />
                  <span className="text-[11px] font-medium text-muted-foreground uppercase">{d.label}</span>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Exports disponibles</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {reports.map(r => (
              <Card key={r.key} className="p-5 flex flex-col justify-between">
                <div>
                  <p className="font-semibold flex items-center gap-2"><r.icon className="size-4 text-primary" /> {r.title}</p>
                  <p className="text-sm text-muted-foreground mt-1">{r.desc}</p>
                </div>
                <div className="flex items-center justify-between mt-4 pt-3 border-t">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{r.formats}</span>
                  <Button size="sm" onClick={() => runExport(r.key, r.run)} disabled={exporting === r.key}>
                    <Download className="size-4" /> {exporting === r.key ? "Export…" : "Exporter"}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Taux de rupture</h2>
          <Card className="p-5 card-accent-top border-t-warning">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Références en rupture</p>
            <p className="text-2xl font-semibold mt-2 tracking-tight">{ruptureRate}%</p>
            <p className="text-xs text-muted-foreground mt-1">{rupturedLines} ligne{rupturedLines > 1 ? "s" : ""} sur {totalLines} suivie{totalLines > 1 ? "s" : ""} en stock</p>
          </Card>
        </section>

        <p className="text-xs text-muted-foreground">
          Synthèse opérationnelle indicative construite à partir des ventes, décaissements et déclarations de défectueux enregistrés
          dans l'application. Ce n'est pas un état financier comptable complet (charges de personnel, taxes, amortissements ne sont pas
          suivis ici). Les exports sont disponibles au format Excel (ou CSV pour l'export comptable) — le PDF n'est pas encore implémenté.
        </p>
      </div>
    </div>
  );
}