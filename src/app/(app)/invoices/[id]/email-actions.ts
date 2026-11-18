"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { buildInvoiceEmail } from "@/lib/email/invoice-email";
import { getEmailConfig, sendEmail } from "@/lib/email/resend";
import { loadInvoiceDocument } from "@/lib/invoice/document";
import { formatMoney } from "@/lib/money";
import { renderInvoicePdf } from "@/lib/pdf/render";
import { createClient } from "@/lib/supabase/server";
import { emailInvoiceSchema, type EmailInvoiceInput } from "@/lib/validation/email";

export type EmailResult =
  | { ok: true; message: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

/** Per user, across all invoices. Stops a compromised account being used to spam. */
const MAX_EMAILS_PER_HOUR = 20;

export async function emailInvoice(id: string, input: EmailInvoiceInput): Promise<EmailResult> {
  const user = await requireUser();
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "That invoice couldn't be found." };

  const parsed = emailInvoiceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields.", fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const { to, subject, message } = parsed.data;

  const config = getEmailConfig();
  if (!config) return { ok: false, error: "Email isn't set up yet. Download the PDF and send it yourself for now." };

  const doc = await loadInvoiceDocument(id);
  if (!doc) return { ok: false, error: "That invoice couldn't be found." };
  if (doc.invoice.status === "draft") return { ok: false, error: "Issue this invoice before emailing it." };

  const supabase = await createClient();
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("invoice_email_deliveries")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", since);
  if ((count ?? 0) >= MAX_EMAILS_PER_HOUR) {
    return { ok: false, error: `You can send up to ${MAX_EMAILS_PER_HOUR} emails an hour. Try again later.` };
  }

  const { bytes, fileName } = await renderInvoicePdf(doc);
  const { html, text } = buildInvoiceEmail({
    businessName: doc.data.business.name,
    clientName: doc.data.client?.name ?? null,
    number: doc.invoice.invoice_number,
    total: formatMoney(doc.invoice.total_minor, doc.invoice.currency),
    dueDate: doc.data.dueDate,
    message,
    fileName,
  });

  // Replies go to the business, not to the sending address.
  const result = await sendEmail(config, { to, subject, html, text, replyTo: doc.data.business.email, attachments: [{ filename: fileName, content: bytes }] });

  // Record every attempt (IP-223). A failure to record doesn't change what
  // happened to the email, so it's logged rather than shown as a send failure.
  const { error: recordError } = await supabase.from("invoice_email_deliveries").insert({
    invoice_id: id,
    user_id: user.id,
    recipient: to,
    subject,
    status: result.ok ? "sent" : "failed",
    provider_id: result.ok ? result.id : null,
    error: result.ok ? null : result.error.slice(0, 300),
  });
  if (recordError) console.error("Couldn't record email delivery", recordError.code);

  revalidatePath(`/invoices/${id}`);
  // Success is reported only after the provider has accepted the email (IP-222).
  return result.ok ? { ok: true, message: `Emailed ${doc.invoice.invoice_number} to ${to}.` } : { ok: false, error: result.error };
}
