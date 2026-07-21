import { supabase } from "@/integrations/supabase/client";

export type PaymentMethod = "cash" | "card" | "transfer" | "check" | "voucher" | "other";

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash: "Espèces",
  card: "Carte",
  transfer: "Virement",
  check: "Chèque",
  voucher: "Avoir",
  other: "Autre",
};

export type SaleStatus = "completed" | "refunded" | "partial_refund" | "voided";

export type Sale = {
  id: string;
  reference: string;
  warehouse_id: string;
  customer_id: string | null;
  cashier_id: string | null;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  status: SaleStatus;
  refunded_sale_id: string | null;
  notes: string | null;
  created_at: string;
};

export type SaleItem = {
  id: string;
  sale_id: string;
  product_id: string;
  product_name: string;
  sku: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  vat_rate: number;
  line_total: number;
};

export type SalePayment = {
  id: string;
  sale_id: string;
  method: PaymentMethod;
  amount: number;
  tendered: number | null;
  change_given: number;
};

export type CheckoutPayload = {
  warehouse_id: string;
  customer_id?: string | null;
  cash_session_id?: string | null;
  discount_amount?: number;
  items: { product_id: string; quantity: number; unit_price: number; discount_amount?: number }[];
  payments: { method: PaymentMethod; amount: number; tendered?: number; change_given?: number }[];
};

export async function checkoutSale(payload: CheckoutPayload): Promise<string> {
  const { data, error } = await supabase.rpc("checkout_sale", { _payload: payload });
  if (error) throw error;
  return data as string;
}

export async function refundSale(saleId: string, reason: string): Promise<string> {
  const { data, error } = await supabase.rpc("refund_sale", { _sale_id: saleId, _reason: reason });
  if (error) throw error;
  return data as string;
}

export async function fetchSales(limit = 100) {
  const { data, error } = await supabase
    .from("sales")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as Sale[];
}

export async function fetchSale(id: string) {
  const [s, items, payments] = await Promise.all([
    supabase.from("sales").select("*").eq("id", id).single(),
    supabase.from("sale_items").select("*").eq("sale_id", id),
    supabase.from("sale_payments").select("*").eq("sale_id", id),
  ]);
  if (s.error) throw s.error;
  return {
    sale: s.data as Sale,
    items: (items.data ?? []) as SaleItem[],
    payments: (payments.data ?? []) as SalePayment[],
  };
}
