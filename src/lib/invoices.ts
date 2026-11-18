import "server-only";

import { createClient } from "@/lib/supabase/server";

export type InvoiceStatus = "draft" | "sent" | "paid";

/** Business or client details frozen onto an invoice when it's issued. */
export type PartySnapshot = {
  name?: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  tax_id?: string | null;
};

export type InvoiceRow = {
  id: string;
  invoice_number: string;
  status: InvoiceStatus;
  client_id: string | null;
  issue_date: string;
  due_date: string | null;
  currency: string;
  reference: string | null;
  discount_type: "percent" | "fixed" | null;
  discount_value: number;
  tax_rate_bps: number;
  subtotal_minor: number;
  discount_minor: number;
  taxable_minor: number;
  tax_minor: number;
  total_minor: number;
  notes: string | null;
  terms: string | null;
  payment_instructions: string | null;
  client_snapshot: PartySnapshot | null;
  business_snapshot: PartySnapshot | null;
  issued_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
};

export type InvoiceItemRow = {
  id: string;
  position: number;
  description: string;
  quantity: string | number;
  unit_price_minor: number;
  line_total_minor: number;
};

const COLUMNS =
  "id, invoice_number, status, client_id, issue_date, due_date, currency, reference, discount_type, discount_value, tax_rate_bps, subtotal_minor, discount_minor, taxable_minor, tax_minor, total_minor, notes, terms, payment_instructions, client_snapshot, business_snapshot, issued_at, paid_at, created_at, updated_at";

/** One invoice with its items, or null if missing or another user's (RLS). */
export async function getInvoice(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data: invoice } = await supabase.from("invoices").select(COLUMNS).eq("id", id).maybeSingle<InvoiceRow>();
  if (!invoice) return null;
  const { data: items } = await supabase
    .from("invoice_items")
    .select("id, position, description, quantity, unit_price_minor, line_total_minor")
    .eq("invoice_id", id)
    .order("position")
    .returns<InvoiceItemRow[]>();
  return { invoice, items: items ?? [] };
}
