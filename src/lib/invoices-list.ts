import "server-only";

import type { ListRow } from "@/lib/invoice/list";
import { createClient } from "@/lib/supabase/server";

/**
 * All of the user's invoices in the shape the list and dashboard need. Search,
 * filtering and sorting happen in code (lib/invoice/list.ts), which is ample for
 * the hundreds of invoices a small business creates.
 */
export async function loadInvoiceRows(): Promise<ListRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("id, invoice_number, status, issue_date, due_date, currency, total_minor, client_snapshot, client:clients(name)")
    .returns<(Omit<ListRow, "clientName"> & { client_snapshot: { name?: string } | null; client: { name: string } | null })[]>();
  if (error) throw new Error("Couldn't load invoices.");
  // Issued invoices show the client name as it was when issued.
  return data.map(({ client, client_snapshot, ...row }) => ({
    ...row,
    clientName: (row.status === "draft" ? client?.name : client_snapshot?.name) ?? client?.name ?? null,
  }));
}
