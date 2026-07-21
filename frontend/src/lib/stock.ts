// Helpers for stock queries
import { supabase } from "@/integrations/supabase/client";

export type Product = {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  category: string | null;
  unit: string;
  price: number;
  cost: number;
  vat_rate: number;
  image_url: string | null;
  low_stock_threshold: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Warehouse = {
  id: string;
  code: string;
  name: string;
  address: string | null;
  is_active: boolean;
  created_at: string;
};

export type StockLevel = {
  id: string;
  product_id: string;
  warehouse_id: string;
  quantity: number;
  updated_at: string;
};

export type MovementType = "in" | "out" | "adjustment" | "transfer";

export type StockMovement = {
  id: string;
  product_id: string;
  warehouse_id: string;
  destination_warehouse_id: string | null;
  type: MovementType;
  quantity: number;
  reason: string | null;
  reference: string | null;
  created_at: string;
};

export function formatMoney(n: number) {
  const amount = Math.round(Number.isFinite(n) ? n : 0);
  const formatted = new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(amount).replace(/\s/g, " ");

  return `${formatted} FCFA`;
}

export function formatDate(s: string) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(s));
}

export async function fetchProducts() {
  const { data, error } = await supabase.from("products").select("*").order("name");
  if (error) throw error;
  return data as Product[];
}

export async function fetchWarehouses() {
  const { data, error } = await supabase.from("warehouses").select("*").order("name");
  if (error) throw error;
  return data as Warehouse[];
}

export async function fetchStockLevels() {
  const { data, error } = await supabase.from("stock_levels").select("*");
  if (error) throw error;
  return data as StockLevel[];
}

export async function fetchMovements(limit = 50) {
  const { data, error } = await supabase
    .from("stock_movements")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as StockMovement[];
}

export const MOVEMENT_LABEL: Record<MovementType, string> = {
  in: "Entrée",
  out: "Sortie",
  adjustment: "Ajustement",
  transfer: "Transfert",
};
