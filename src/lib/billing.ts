import { supabase } from "@/integrations/supabase/client";

export type InvoiceStatus = "draft" | "issued" | "paid" | "cancelled";

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: "Brouillon",
  issued: "Émise",
  paid: "Payée",
  cancelled: "Annulée",
};

export type Invoice = {
  id: string;
  number: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string | null;
  sale_id: string | null;
  customer_id: string | null;
  customer_name: string;
  customer_address: string | null;
  customer_email: string | null;
  customer_vat_number: string | null;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total: number;
  paid_amount: number;
  notes: string | null;
  created_at: string;
};

export type InvoiceItem = {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  line_total: number;
};

export type CompanySettings = {
  id: string;
  name: string;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  siret: string | null;
  vat_number: string | null;
  email: string | null;
  phone: string | null;
  iban: string | null;
  bic: string | null;
  logo_url: string | null;
  legal_footer: string | null;
};

export async function fetchInvoices() {
  const { data, error } = await supabase
    .from("invoices").select("*")
    .order("issue_date", { ascending: false })
    .order("number", { ascending: false });
  if (error) throw error;
  return data as Invoice[];
}

export async function fetchInvoice(id: string) {
  const [inv, items] = await Promise.all([
    supabase.from("invoices").select("*").eq("id", id).single(),
    supabase.from("invoice_items").select("*").eq("invoice_id", id),
  ]);
  if (inv.error) throw inv.error;
  return { invoice: inv.data as Invoice, items: (items.data ?? []) as InvoiceItem[] };
}

export async function fetchCompanySettings(): Promise<CompanySettings | null> {
  const { data, error } = await supabase.from("company_settings").select("*").limit(1).maybeSingle();
  if (error) throw error;
  return data as CompanySettings | null;
}

export async function saveCompanySettings(patch: Partial<CompanySettings> & { id: string }) {
  const { error } = await supabase.from("company_settings").update(patch).eq("id", patch.id);
  if (error) throw error;
}

export async function createInvoiceFromSale(saleId: string): Promise<string> {
  const { data, error } = await supabase.rpc("create_invoice_from_sale", { _sale_id: saleId });
  if (error) throw error;
  return data as string;
}

export async function nextInvoiceNumber(): Promise<string> {
  const { data, error } = await supabase.rpc("next_invoice_number");
  if (error) throw error;
  return data as string;
}

export type ManualInvoiceInput = {
  customer_name: string;
  customer_address?: string;
  customer_email?: string;
  customer_vat_number?: string;
  due_date?: string | null;
  notes?: string;
  items: { description: string; quantity: number; unit_price: number; vat_rate: number }[];
  status: InvoiceStatus;
};

export async function createManualInvoice(input: ManualInvoiceInput): Promise<string> {
  const number = await nextInvoiceNumber();
  let subtotal = 0;
  let tax = 0;
  const itemsWithTotal = input.items.map(it => {
    const lineHT = it.quantity * it.unit_price;
    const lineTax = lineHT * (it.vat_rate / 100);
    const lineTotal = lineHT + lineTax;
    subtotal += lineHT;
    tax += lineTax;
    return { ...it, line_total: lineTotal };
  });
  const total = subtotal + tax;

  const { data: inv, error } = await supabase.from("invoices").insert({
    number,
    status: input.status,
    customer_name: input.customer_name,
    customer_address: input.customer_address ?? null,
    customer_email: input.customer_email ?? null,
    customer_vat_number: input.customer_vat_number ?? null,
    due_date: input.due_date ?? null,
    notes: input.notes ?? null,
    subtotal, tax_amount: tax, total,
  }).select("id").single();
  if (error) throw error;

  const rows = itemsWithTotal.map(it => ({
    invoice_id: inv.id,
    description: it.description,
    quantity: it.quantity,
    unit_price: it.unit_price,
    vat_rate: it.vat_rate,
    line_total: it.line_total,
  }));
  const { error: itemsErr } = await supabase.from("invoice_items").insert(rows);
  if (itemsErr) throw itemsErr;
  return inv.id;
}

export async function updateInvoiceStatus(id: string, status: InvoiceStatus) {
  const patch: Partial<Invoice> = { status };
  if (status === "paid") patch.paid_amount = (await fetchInvoice(id)).invoice.total;
  const { error } = await supabase.from("invoices").update(patch).eq("id", id);
  if (error) throw error;
}
