"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { isIsoDate } from "@/lib/invoice/draft";
import { todayIn } from "@/lib/invoice/status";
import { createClient } from "@/lib/supabase/server";

export type StatusResult = { ok: true; message: string } | { ok: false; error: string };

const idSchema = z.uuid();

// Error keys raised by the database functions in the invoice status migration.
const MESSAGES: Record<string, string> = {
  not_found: "That invoice couldn't be found.",
  not_draft: "This invoice has already been issued.",
  no_client: "Choose a client before issuing this invoice.",
  no_items: "Add at least one line item with a description before issuing.",
  not_sent: "Only sent invoices can do that. Refresh the page to see its current status.",
  not_paid: "This invoice isn't marked as paid.",
  invalid_paid_date: "Enter a payment date that isn't in the future.",
  invoice_locked: "Issued invoices can't be edited. Reopen it as a draft first.",
};

async function run(id: string, fn: string, args: Record<string, unknown>, success: string): Promise<StatusResult> {
  await requireUser();
  if (!idSchema.safeParse(id).success) return { ok: false, error: MESSAGES.not_found };

  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, { p_id: id, ...args });
  if (error) return { ok: false, error: MESSAGES[error.message] ?? "Something went wrong. Please try again." };

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  revalidatePath("/dashboard");
  return { ok: true, message: success };
}

/** Locks the invoice and freezes the business and client details on it. */
export async function issueInvoice(id: string) {
  return run(id, "issue_invoice", {}, "Invoice issued. You can now download and send it.");
}

/** Records full payment. The date can't be in the future. */
export async function markPaid(id: string, paidOn: string) {
  if (!isIsoDate(paidOn) || paidOn > todayIn()) return { ok: false, error: MESSAGES.invalid_paid_date } as const;
  return run(id, "mark_invoice_paid", { p_paid_on: paidOn }, "Marked as paid.");
}

export async function markUnpaid(id: string) {
  return run(id, "mark_invoice_unpaid", {}, "Payment removed. The invoice is unpaid again.");
}

/** Back to draft for editing. The invoice keeps its number. */
export async function reopenInvoice(id: string) {
  return run(id, "reopen_invoice", {}, "Invoice reopened as a draft.");
}

/** Only drafts can be deleted (enforced by RLS too). */
export async function deleteDraft(id: string): Promise<StatusResult> {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success) return { ok: false, error: MESSAGES.not_found };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("status", "draft")
    .select("invoice_number");
  if (error || !data?.length) return { ok: false, error: "Only draft invoices can be deleted." };
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  return { ok: true, message: `Draft ${data[0].invoice_number} deleted.` };
}
