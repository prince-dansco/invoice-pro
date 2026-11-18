import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { getInvoice } from "@/lib/invoices";
import { currencyDigits, minorToInput, parseQuantity, quantityToInput } from "@/lib/money";
import { bpsToPercent } from "@/lib/rates";

import { loadEditorContext } from "../../editor-context";
import { InvoiceEditor } from "../../invoice-editor";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const found = await getInvoice((await params).id);
  return { title: found ? `Edit ${found.invoice.invoice_number}` : "Invoice" };
}

export default async function EditInvoicePage({ params }: Params) {
  const { id } = await params;
  const found = await getInvoice(id);
  // RLS means another user's invoice ID behaves exactly like a missing one.
  if (!found) notFound();
  const { invoice, items } = found;
  // Issued invoices are locked; their page offers "Reopen as draft" instead.
  if (invoice.status !== "draft") redirect(`/invoices/${invoice.id}`);

  const ctx = await loadEditorContext();
  const digits = currencyDigits(invoice.currency);

  // A draft may point at a client deleted since; keep showing it in the picker.
  const clients = [...ctx.clients];
  if (invoice.client_id && !clients.some((c) => c.id === invoice.client_id)) {
    clients.push({
      id: invoice.client_id,
      name: invoice.client_snapshot?.name ?? "Deleted client",
      company: invoice.client_snapshot?.company ?? null,
      address: [],
    });
  }

  return (
    <InvoiceEditor
      invoiceId={invoice.id}
      invoiceNumber={invoice.invoice_number}
      nextNumberPreview={ctx.nextNumberPreview}
      business={ctx.business}
      clients={clients}
      paymentTermsDays={ctx.profile.payment_terms_days}
      // Every stored field maps back to its editor input, so a reopened draft is identical (IP-164).
      initial={{
        client_id: invoice.client_id,
        issue_date: invoice.issue_date,
        due_date: invoice.due_date ?? "",
        currency: invoice.currency,
        reference: invoice.reference ?? "",
        discount_type: invoice.discount_type ?? "none",
        discount_value:
          invoice.discount_type === "percent"
            ? bpsToPercent(invoice.discount_value)
            : invoice.discount_type === "fixed"
              ? minorToInput(invoice.discount_value, digits)
              : "",
        tax_rate: bpsToPercent(invoice.tax_rate_bps),
        notes: invoice.notes ?? "",
        terms: invoice.terms ?? "",
        payment_instructions: invoice.payment_instructions ?? "",
        items: items.map((item) => ({
          description: item.description,
          quantity: quantityToInput(parseQuantity(String(item.quantity)) ?? 0),
          unit_price: item.unit_price_minor ? minorToInput(item.unit_price_minor, digits) : "",
        })),
      }}
    />
  );
}
