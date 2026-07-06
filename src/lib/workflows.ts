import { supabase } from "@/integrations/supabase/client";

// ============ TYPES ============
export type Severity = "mineur" | "majeur" | "critique";
export type DefCategory = "casse" | "vol" | "peremption" | "defaut_fournisseur" | "autre";
export type DefStatus = "applied" | "pending_confirmation" | "confirmed" | "rejected";
export type RequestStatus = "pending" | "approved" | "rejected" | "executed";
export type DisbStatus = "pending" | "approved" | "rejected" | "paid";
export type DisbCategory = "achat" | "salaire" | "loyer" | "charges" | "maintenance" | "autre";
export type ReturnDestination = "stock" | "defective";
export type RefundType = "cash" | "store_credit" | "none";
export type ReturnStatus = "pending" | "approved" | "rejected";

export const SEVERITY_LABEL: Record<Severity, string> = { mineur: "Mineur", majeur: "Majeur", critique: "Critique" };
export const DEF_CAT_LABEL: Record<DefCategory, string> = {
  casse: "Casse", vol: "Vol", peremption: "Péremption",
  defaut_fournisseur: "Défaut fournisseur", autre: "Autre",
};
export const DISB_CAT_LABEL: Record<DisbCategory, string> = {
  achat: "Achat", salaire: "Salaire", loyer: "Loyer",
  charges: "Charges", maintenance: "Maintenance", autre: "Autre",
};
export const STATUS_LABEL: Record<string, string> = {
  pending: "En attente", approved: "Approuvée", rejected: "Rejetée", executed: "Exécutée",
  paid: "Payée", applied: "Appliquée", pending_confirmation: "À confirmer", confirmed: "Confirmée",
};
export const STATUS_TONE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-900",
  pending_confirmation: "bg-amber-100 text-amber-900",
  approved: "bg-emerald-100 text-emerald-900",
  executed: "bg-emerald-100 text-emerald-900",
  applied: "bg-emerald-100 text-emerald-900",
  confirmed: "bg-emerald-100 text-emerald-900",
  paid: "bg-blue-100 text-blue-900",
  rejected: "bg-rose-100 text-rose-900",
};

export type DefectiveItem = {
  id: string; product_id: string; warehouse_id: string; quantity: number;
  severity: Severity; category: DefCategory; reason: string;
  status: DefStatus; reported_by: string | null; decided_by: string | null;
  decided_at: string | null; created_at: string; evidence_url: string | null;
};
export type DestockingRequest = {
  id: string; product_id: string; warehouse_id: string; quantity: number;
  reason: string; status: RequestStatus; requested_by: string | null;
  approver_id: string | null; approver_note: string | null;
  decided_at: string | null; created_at: string;
};
export type DisbursementRequest = {
  id: string; amount: number; category: DisbCategory; beneficiary: string;
  description: string; justification_url: string | null; status: DisbStatus;
  requested_by: string | null; approver_id: string | null;
  approver_note: string | null; decided_at: string | null; paid_at: string | null;
  payment_method: string | null; created_at: string;
};
export type CustomerReturn = {
  id: string; sale_id: string; reason: string; destination: ReturnDestination;
  refund_type: RefundType; refund_amount: number; status: ReturnStatus;
  requested_by: string | null; approver_id: string | null;
  decided_at: string | null; created_at: string;
};
export type NotificationRow = {
  id: string; user_id: string; type: string; title: string;
  body: string | null; link: string | null; read_at: string | null; created_at: string;
};

// ============ FETCHERS ============
async function list<T>(table: string): Promise<T[]> {
  const { data, error } = await supabase.from(table as never).select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as T[];
}
export const fetchDefective = () => list<DefectiveItem>("defective_items");
export const fetchDestocking = () => list<DestockingRequest>("destocking_requests");
export const fetchDisbursement = () => list<DisbursementRequest>("disbursement_requests");
export const fetchReturns = () => list<CustomerReturn>("customer_returns");

// ============ MUTATIONS via RPC ============
export async function declareDefective(input: {
  product_id: string; warehouse_id: string; quantity: number;
  severity: Severity; category: DefCategory; reason: string; evidence_url?: string | null;
}) {
  const { data, error } = await supabase.rpc("declare_defective", {
    _product_id: input.product_id, _warehouse_id: input.warehouse_id,
    _quantity: input.quantity, _severity: input.severity,
    _category: input.category, _reason: input.reason,
    _evidence_url: input.evidence_url ?? null,
  });
  if (error) throw error;
  return data as string;
}
export async function decideDefective(id: string, approve: boolean) {
  const { error } = await supabase.rpc("decide_defective", { _id: id, _approve: approve });
  if (error) throw error;
}

export async function createDestocking(input: { product_id: string; warehouse_id: string; quantity: number; reason: string }) {
  const { data: u } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("destocking_requests").insert({
    ...input, requested_by: u.user?.id,
  }).select("id").single();
  if (error) throw error;
  return data.id as string;
}
export async function decideDestocking(id: string, approve: boolean, note: string) {
  const { error } = await supabase.rpc("decide_destocking", { _id: id, _approve: approve, _note: note });
  if (error) throw error;
}

export async function createDisbursement(input: {
  amount: number; category: DisbCategory; beneficiary: string; description: string; justification_url?: string | null;
}) {
  const { data: u } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("disbursement_requests").insert({
    ...input, requested_by: u.user?.id,
  }).select("id").single();
  if (error) throw error;
  return data.id as string;
}
export async function decideDisbursement(id: string, approve: boolean, note: string) {
  const { error } = await supabase.rpc("decide_disbursement", { _id: id, _approve: approve, _note: note });
  if (error) throw error;
}
export async function markDisbursementPaid(id: string, method: string) {
  const { error } = await supabase.rpc("mark_disbursement_paid", { _id: id, _method: method });
  if (error) throw error;
}
export async function uploadJustification(file: File): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  const path = `${u.user?.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error } = await supabase.storage.from("disbursement-evidence").upload(path, file);
  if (error) throw error;
  return path;
}
export async function signedJustificationUrl(path: string) {
  const { data, error } = await supabase.storage.from("disbursement-evidence").createSignedUrl(path, 300);
  if (error) throw error;
  return data.signedUrl;
}

export async function createCustomerReturn(input: {
  sale_id: string; reason: string; destination: ReturnDestination;
  refund_type: RefundType; refund_amount: number;
  items: { product_id: string; quantity: number; unit_price: number }[];
}) {
  const { data: u } = await supabase.auth.getUser();
  const { data: ret, error } = await supabase.from("customer_returns").insert({
    sale_id: input.sale_id, reason: input.reason, destination: input.destination,
    refund_type: input.refund_type, refund_amount: input.refund_amount,
    requested_by: u.user?.id,
  }).select("id").single();
  if (error) throw error;
  const rows = input.items.map(it => ({ return_id: ret.id, ...it }));
  const { error: itemsErr } = await supabase.from("customer_return_items").insert(rows);
  if (itemsErr) throw itemsErr;
  return ret.id as string;
}
export async function decideReturn(id: string, approve: boolean) {
  const { error } = await supabase.rpc("decide_customer_return", { _id: id, _approve: approve });
  if (error) throw error;
}

// ============ NOTIFICATIONS ============
export async function fetchNotifications(limit = 50) {
  const { data, error } = await supabase.from("notifications").select("*")
    .order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []) as NotificationRow[];
}
export async function markNotifRead(id: string) {
  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}
export async function markAllNotifsRead() {
  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
  if (error) throw error;
}

// ============ CASH SESSION Z ============
export async function closeCashSession(id: string, counted: number, notes: string) {
  const { data, error } = await supabase.rpc("close_cash_session", { _id: id, _counted: counted, _notes: notes });
  if (error) throw error;
  return data as string;
}
