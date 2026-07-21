import { supabase } from "@/integrations/supabase/client";

export type Customer = {
  id: string;
  code: string | null;
  first_name: string | null;
  last_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  loyalty_points: number;
  notes: string | null;
  is_active: boolean;
  created_at: string;
};

export function customerName(c: Pick<Customer, "first_name" | "last_name">) {
  return [c.first_name, c.last_name].filter(Boolean).join(" ");
}

export async function fetchCustomers() {
  const { data, error } = await supabase.from("customers").select("*").order("last_name");
  if (error) throw error;
  return data as Customer[];
}
