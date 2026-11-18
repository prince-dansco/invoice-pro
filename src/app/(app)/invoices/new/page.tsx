import type { Metadata } from "next";

import { addDays } from "@/lib/invoice/draft";
import { todayIn } from "@/lib/invoice/status";
import { bpsToPercent } from "@/lib/rates";

import { loadEditorContext } from "../editor-context";
import { InvoiceEditor } from "../invoice-editor";

export const metadata: Metadata = { title: "New invoice" };

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const { profile, clients, business, nextNumberPreview } = await loadEditorContext();
  const { client } = await searchParams;
  const today = todayIn();

  return (
    <InvoiceEditor
      invoiceId={null}
      invoiceNumber={null}
      nextNumberPreview={nextNumberPreview}
      business={business}
      clients={clients}
      paymentTermsDays={profile.payment_terms_days}
      // New invoices start from the business defaults in Settings (IP-131, IP-165).
      initial={{
        client_id: clients.some((c) => c.id === client) ? client! : null,
        issue_date: today,
        due_date: addDays(today, profile.payment_terms_days),
        currency: profile.currency,
        reference: "",
        discount_type: "none",
        discount_value: "",
        tax_rate: bpsToPercent(profile.default_tax_rate_bps),
        notes: profile.default_notes ?? "",
        terms: profile.default_terms ?? "",
        payment_instructions: profile.default_payment_instructions ?? "",
        items: [],
      }}
    />
  );
}
