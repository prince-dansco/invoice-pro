"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { MAX_ITEMS, parseDraft, type DraftErrors, type DraftInput } from "@/lib/invoice/draft";
import { QTY_SCALE } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export type SaveDraftResult =
  | { ok: true; id: string; invoiceNumber: string }
  | { ok: false; error: string; errors?: DraftErrors };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Shape check only: Server Actions can be called with any payload. The real
// validation is parseDraft. Unknown keys (such as totals) are stripped.
const str = (max: number) => z.string().max(max);
const draftShape = z.object({
  client_id: z.string().max(36).nullable(),
  issue_date: str(10),
  due_date: str(10),
  currency: str(3),
  reference: str(500),
  discount_type: z.enum(["none", "percent", "fixed"]),
  discount_value: str(40),
  tax_rate: str(20),
  notes: str(5000),
  terms: str(5000),
  payment_instructions: str(5000),
  items: z.array(z.object({ description: str(5000), quantity: str(40), unit_price: str(40) })).max(MAX_ITEMS),
});

/**
 * Saves a draft invoice. Every value is re-parsed and every total recalculated
 * here: nothing numeric is taken from the browser as-is.
 */
export async function saveDraft(id: string | null, rawInput: DraftInput): Promise<SaveDraftResult> {
  const user = await requireUser();
  if (id !== null && !UUID.test(id)) return { ok: false, error: "That invoice couldn't be found." };
  const shape = draftShape.safeParse(rawInput);
  if (!shape.success) return { ok: false, error: "That invoice couldn't be saved. Refresh the page and try again." };

  const { value, errors, totals } = parseDraft(shape.data);
  if (!value) return { ok: false, error: errors.form ?? "Fix the highlighted fields, then save again.", errors };

  const supabase = await createClient();

  // The client must be one of the user's active clients. Keeping a client that
  // was deleted after this draft was created is allowed.
  if (value.client_id) {
    const { data: client } = await supabase
      .from("clients")
      .select("id, deleted_at")
      .eq("id", value.client_id)
      .eq("user_id", user.id)
      .maybeSingle<{ id: string; deleted_at: string | null }>();
    let allowed = client && !client.deleted_at;
    if (client?.deleted_at && id) {
      const { data: existing } = await supabase.from("invoices").select("client_id").eq("id", id).maybeSingle();
      allowed = existing?.client_id === value.client_id;
    }
    if (!allowed) {
      return { ok: false, error: "That client couldn't be found.", errors: { fields: { client_id: "Choose a client." }, items: {} } };
    }
  }

  const { items, ...header } = value;
  const { data, error } = await supabase
    .rpc("save_invoice", {
      p_id: id,
      p_invoice: {
        ...header,
        subtotal_minor: totals.subtotal,
        discount_minor: totals.discount,
        taxable_minor: totals.taxable,
        tax_minor: totals.tax,
        total_minor: totals.total,
      },
      p_items: items.map((item, i) => ({
        description: item.description,
        // Exact decimal string, e.g. 1500 -> "1.500".
        quantity: `${Math.floor(item.quantityMilli / QTY_SCALE)}.${String(item.quantityMilli % QTY_SCALE).padStart(3, "0")}`,
        unit_price_minor: item.unitPriceMinor,
        line_total_minor: totals.lineTotals[i],
      })),
    })
    .single<{ saved_id: string; saved_number: string }>();

  if (error || !data) {
    if (error?.code === "P0002") return { ok: false, error: "This invoice has been issued and can't be edited as a draft." };
    return { ok: false, error: "We couldn't save this invoice. Your changes are still here; please try again." };
  }

  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  return { ok: true, id: data.saved_id, invoiceNumber: data.saved_number };
}
