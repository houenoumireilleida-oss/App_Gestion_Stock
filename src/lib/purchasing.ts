import { supabase } from "@/integrations/supabase/client";

export type POStatus = "draft" | "ordered" | "partial" | "received" | "cancelled";

export const PO_STATUS_LABEL: Record<POStatus, string> = {
  draft: "Brouillon",
  ordered: "Commandée",
  partial: "Reçue partiellement",
  received: "Reçue",
  cancelled: "Annulée",
};

export type Supplier = {
  id: string;
  code: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  payment_terms: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
};

export type PurchaseOrder = {
  id: string;
  reference: string;
  supplier_id: string;
  warehouse_id: string;
  status: POStatus;
  expected_at: string | null;
  notes: string | null;
  created_at: string;
};

export type POItem = {
  id: string;
  po_id: string;
  product_id: string;
  ordered_qty: number;
  received_qty: number;
  unit_cost: number;
};

export type SupplierReturn = {
  id: string;
  reference: string;
  supplier_id: string;
  product_id: string;
  quantity: number;
  defective_id: string | null;
  reason: string;
  status: string;
  created_at: string;
};

export async function fetchSuppliers() {
  const { data, error } = await supabase.from("suppliers").select("*").order("name");
  if (error) throw error;
  return data as Supplier[];
}

export async function fetchPurchaseOrders() {
  const { data, error } = await supabase
    .from("purchase_orders").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data as PurchaseOrder[];
}

export async function fetchPurchaseOrder(id: string) {
  const [po, items] = await Promise.all([
    supabase.from("purchase_orders").select("*").eq("id", id).single(),
    supabase.from("purchase_order_items").select("*").eq("po_id", id),
  ]);
  if (po.error) throw po.error;
  return { po: po.data as PurchaseOrder, items: (items.data ?? []) as POItem[] };
}

export async function receivePOItem(itemId: string, qty: number) {
  const { error } = await supabase.rpc("receive_po_item", { _item_id: itemId, _qty: qty });
  if (error) throw error;
}

export async function generateReorderPO(supplierId: string, warehouseId: string): Promise<string> {
  const { data, error } = await supabase.rpc("generate_reorder_po", {
    _supplier_id: supplierId, _warehouse_id: warehouseId,
  });
  if (error) throw error;
  return data as string;
}

export async function fetchSupplierReturns() {
  const { data, error } = await supabase.from("supplier_returns").select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SupplierReturn[];
}

export async function createSupplierReturn(input: {
  supplier_id: string; product_id: string; quantity: number;
  defective_id: string | null; reason: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc("create_supplier_return", {
    _supplier_id: input.supplier_id, _product_id: input.product_id,
    _quantity: input.quantity, _defective_id: input.defective_id as string,
    _reason: input.reason,
  });
  if (error) throw error;
  return data as string;
}
