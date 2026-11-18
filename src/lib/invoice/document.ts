import "server-only";

import type { PreviewData, PreviewParty } from "@/components/invoices/invoice-preview";
import { getClient } from "@/lib/clients";
import { getInvoice, type PartySnapshot } from "@/lib/invoices";
import { getLogoUrl, getProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

import { addressLines, formatDate, formatQuantity } from "./format";
import { parseQuantity } from "@/lib/money";
import { bpsToPercent } from "@/lib/rates";
import { displayStatus, todayIn, type DisplayStatus } from "./status";

function party(s: PartySnapshot | null | undefined, fallbackName: string): PreviewParty {
  return {
    name: s?.name || fallbackName,
    company: s?.company ?? null,
    email: s?.email ?? null,
    phone: s?.phone ?? null,
    website: s?.website ?? null,
    taxId: s?.tax_id ?? null,
    address: addressLines(s ?? {}),
  };
}

/**
 * Everything needed to show or print one invoice. Issued invoices use the
 * details frozen when they were issued; drafts use the current business and
 * client details. Totals are the stored, server-calculated values.
 */
export async function loadInvoiceDocument(id: string) {
  const found = await getInvoice(id);
  if (!found) return null;
  const { invoice, items } = found;
  const profile = (await getProfile())!;

  let business: PartySnapshot | null = invoice.business_snapshot;
  let client: PartySnapshot | null = invoice.client_snapshot;
  if (invoice.status === "draft") {
    business = { ...profile, name: profile.business_name };
    client = invoice.client_id ? await getClient(invoice.client_id) : null;
    // A draft whose client was deleted since keeps showing the last known details.
    if (!client && invoice.client_snapshot) client = invoice.client_snapshot;
  }

  const status: DisplayStatus = displayStatus(invoice.status, invoice.due_date, todayIn());
  const data: PreviewData = {
    business: { ...party(business, profile.business_name), logoUrl: await getLogoUrl(profile.logo_path) },
    client: client ? party(client, "Client") : null,
    number: invoice.invoice_number,
    issueDate: formatDate(invoice.issue_date),
    dueDate: formatDate(invoice.due_date),
    reference: invoice.reference ?? "",
    currency: invoice.currency,
    items: items.map((item) => ({
      description: item.description,
      quantity: formatQuantity(parseQuantity(String(item.quantity)) ?? 0),
      unitPriceMinor: item.unit_price_minor,
      lineTotalMinor: item.line_total_minor,
    })),
    totals: {
      subtotal: invoice.subtotal_minor,
      discount: invoice.discount_minor,
      taxable: invoice.taxable_minor,
      tax: invoice.tax_minor,
      total: invoice.total_minor,
    },
    discountLabel:
      invoice.discount_type === "percent"
        ? `Discount (${bpsToPercent(invoice.discount_value)}%)`
        : invoice.discount_type === "fixed"
          ? "Discount"
          : null,
    taxLabel: invoice.tax_rate_bps > 0 ? `Tax (${bpsToPercent(invoice.tax_rate_bps)}%)` : null,
    paymentInstructions: invoice.payment_instructions ?? "",
    notes: invoice.notes ?? "",
    terms: invoice.terms ?? "",
  };

  return { invoice, items, status, data, logoPath: profile.logo_path };
}

/** The logo's bytes for embedding in a PDF, converted to PNG when needed. */
export async function loadLogoForPdf(logoPath: string | null): Promise<Buffer | null> {
  if (!logoPath) return null;
  const supabase = await createClient();
  const { data } = await supabase.storage.from("logos").download(logoPath);
  if (!data) return null;
  const bytes = Buffer.from(await data.arrayBuffer());
  // The PDF renderer supports PNG and JPEG only.
  if (logoPath.endsWith(".webp")) {
    const sharp = (await import("sharp")).default;
    return sharp(bytes).png().toBuffer();
  }
  return bytes;
}
