import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  business_name: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  tax_id: string | null;
  logo_path: string | null;
  currency: string;
  payment_terms_days: number;
  invoice_prefix: string;
  next_invoice_number: number;
  default_tax_rate_bps: number;
  default_payment_instructions: string | null;
  default_notes: string | null;
  default_terms: string | null;
  onboarded_at: string | null;
};

const COLUMNS =
  "id, business_name, email, phone, website, address_line1, address_line2, city, state, postal_code, country, tax_id, logo_path, currency, payment_terms_days, invoice_prefix, next_invoice_number, default_tax_rate_bps, default_payment_instructions, default_notes, default_terms, onboarded_at";

/** The signed-in user's profile. Row-level security limits this to their own row. */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select(COLUMNS).maybeSingle<Profile>();
  return data;
});

/** Short-lived URL for the private logo, or null if there isn't one. */
export async function getLogoUrl(logoPath: string | null) {
  if (!logoPath) return null;
  const supabase = await createClient();
  const { data } = await supabase.storage.from("logos").createSignedUrl(logoPath, 60 * 60);
  return data?.signedUrl ?? null;
}
