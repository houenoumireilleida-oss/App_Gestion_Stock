import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { fetchSales } from "./sales";
import { fetchProducts, fetchWarehouses, formatDate } from "./stock";
import { fetchDefective, fetchDestocking, fetchDisbursement, DEF_CAT_LABEL, SEVERITY_LABEL,
  STATUS_LABEL, DISB_CAT_LABEL } from "./workflows";

type Profile = { user_id: string; display_name: string };

async function fetchProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase.from("user_profiles").select("user_id, display_name");
  if (error) throw error;
  return data as Profile[];
}

function downloadWorkbook(rows: Record<string, unknown>[], sheetName: string, filename: string) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

export async function exportSalesReport() {
  const [sales, products, warehouses, profiles] = await Promise.all([
    fetchSales(1000), fetchProducts(), fetchWarehouses(), fetchProfiles(),
  ]);
  const { data: items, error } = await supabase.from("sale_items").select("sale_id, product_id, quantity, unit_price");
  if (error) throw error;

  const rows = sales.flatMap(s => {
    const w = warehouses.find(w => w.id === s.warehouse_id);
    const vendor = profiles.find(p => p.user_id === s.cashier_id)?.display_name ?? "—";
    const lines = (items ?? []).filter((it: any) => it.sale_id === s.id);
    return lines.map((it: any) => {
      const p = products.find(p => p.id === it.product_id);
      return {
        Date: formatDate(s.created_at),
        Référence: s.reference,
        Site: w?.name ?? "—",
        Vendeur: vendor,
        Produit: p?.name ?? "—",
        Quantité: it.quantity,
        "Prix unitaire": it.unit_price,
        "Total ligne": it.quantity * it.unit_price,
        Statut: s.status,
      };
    });
  });
  downloadWorkbook(rows, "Ventes", `rapport-ventes-${Date.now()}.xlsx`);
}

export async function exportDefectiveReport() {
  const [items, products] = await Promise.all([fetchDefective(), fetchProducts()]);
  const rows = items.map(it => {
    const p = products.find(p => p.id === it.product_id);
    return {
      Fiche: `DEF-${it.id.slice(0, 4).toUpperCase()}`,
      Date: formatDate(it.created_at),
      Référence: p?.sku ?? "—",
      Produit: p?.name ?? "—",
      Quantité: it.quantity,
      Type: DEF_CAT_LABEL[it.category],
      Gravité: SEVERITY_LABEL[it.severity],
      "Coût estimé": (p?.cost ?? 0) * it.quantity,
      Statut: STATUS_LABEL[it.status] ?? it.status,
    };
  });
  downloadWorkbook(rows, "Défectueux", `rapport-defectueux-${Date.now()}.xlsx`);
}

export async function exportDestockingReport() {
  const [rows_, products, warehouses] = await Promise.all([fetchDestocking(), fetchProducts(), fetchWarehouses()]);
  const rows = rows_.map(r => {
    const p = products.find(p => p.id === r.product_id);
    const w = warehouses.find(w => w.id === r.warehouse_id);
    return {
      Demande: `DST-${r.id.slice(0, 4).toUpperCase()}`,
      Date: formatDate(r.created_at),
      Référence: p?.sku ?? "—",
      Produit: p?.name ?? "—",
      Site: w?.name ?? "—",
      "Qté demandée": r.quantity,
      "Qté approuvée": r.approved_quantity ?? "—",
      "Valeur estimée": (p?.cost ?? 0) * (r.approved_quantity ?? r.quantity),
      Motif: r.reason,
      Statut: STATUS_LABEL[r.status] ?? r.status,
    };
  });
  downloadWorkbook(rows, "Déstockages", `rapport-destockages-${Date.now()}.xlsx`);
}

export async function exportDisbursementReport() {
  const rows_ = await fetchDisbursement();
  const rows = rows_.map(r => ({
    Demande: `DEC-${r.id.slice(0, 4).toUpperCase()}`,
    Date: formatDate(r.created_at),
    Bénéficiaire: r.beneficiary,
    Catégorie: DISB_CAT_LABEL[r.category],
    Description: r.description,
    Montant: r.amount,
    "Montant approuvé": r.approved_amount ?? "—",
    Statut: STATUS_LABEL[r.status] ?? r.status,
  }));
  downloadWorkbook(rows, "Décaissements", `rapport-decaissements-${Date.now()}.xlsx`);
}

export async function exportCashClosuresReport() {
  const [{ data: sessions, error }, warehouses] = await Promise.all([
    supabase.from("cash_sessions").select("*").not("closed_at", "is", null).order("closed_at", { ascending: false }),
    fetchWarehouses(),
  ]);
  if (error) throw error;
  const rows = (sessions ?? []).map((s: any) => {
    const w = warehouses.find(w => w.id === s.warehouse_id);
    return {
      Date: formatDate(s.closed_at),
      "Point de vente": w?.name ?? "—",
      Théorique: s.expected_cash ?? 0,
      Compté: s.closing_counted ?? 0,
      Écart: s.variance ?? 0,
      Statut: s.variance && Math.abs(s.variance) > 0 ? "Écart signalé" : "Validée",
    };
  });
  downloadWorkbook(rows, "Clôtures de caisse", `clotures-caisse-${Date.now()}.xlsx`);
}

export async function exportAccountingCSV() {
  const [sales, disbursements] = await Promise.all([fetchSales(1000), fetchDisbursement()]);
  const rows: Record<string, unknown>[] = [];
  for (const s of sales.filter(s => s.status === "completed")) {
    rows.push({ Date: formatDate(s.created_at), Type: "Vente", Référence: s.reference, Libellé: "Encaissement vente", Débit: "", Crédit: s.total });
  }
  for (const d of disbursements.filter(d => d.status === "paid")) {
    rows.push({ Date: formatDate(d.created_at), Type: "Décaissement", Référence: `DEC-${d.id.slice(0, 4).toUpperCase()}`, Libellé: `${d.beneficiary} — ${DISB_CAT_LABEL[d.category]}`, Débit: d.amount, Crédit: "" });
  }
  rows.sort((a, b) => String(a.Date).localeCompare(String(b.Date)));
  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `export-comptable-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}