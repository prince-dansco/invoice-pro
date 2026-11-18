import "server-only";

import { createClient } from "@/lib/supabase/server";

export type Client = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  tax_id: string | null;
  notes: string | null;
  created_at: string;
};

const COLUMNS =
  "id, name, company, email, phone, address_line1, address_line2, city, state, postal_code, country, tax_id, notes, created_at";

/**
 * The term is wrapped in double quotes in the filter below, which makes commas
 * and brackets literal. Removing quotes and backslashes means it can't break out
 * of those quotes to add conditions, and removing % and * stops wildcards.
 */
function cleanSearch(q: string) {
  return q.replace(/["\\%*]/g, "").trim().slice(0, 100);
}

/** Active clients, optionally filtered by name, company or email. RLS limits rows to the user. */
export async function listClients(query?: string) {
  const supabase = await createClient();
  let request = supabase.from("clients").select(COLUMNS).is("deleted_at", null).order("name");

  const q = query ? cleanSearch(query) : "";
  if (q) {
    const pattern = `"%${q}%"`;
    request = request.or(`name.ilike.${pattern},company.ilike.${pattern},email.ilike.${pattern}`);
  }

  const { data, error } = await request.returns<Client[]>();
  if (error) throw new Error("Couldn't load clients.");
  return data;
}

export async function hasAnyClients() {
  const supabase = await createClient();
  const { count } = await supabase
    .from("clients")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null);
  return (count ?? 0) > 0;
}

/** One active client, or null if it doesn't exist, is deleted, or belongs to someone else. */
export async function getClient(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("clients")
    .select(COLUMNS)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle<Client>();
  return data;
}
