import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { InvoicePreview } from "@/components/invoices/invoice-preview";
import { StatusBadge } from "@/components/invoices/status-badge";
import { defaultMessage, defaultSubject } from "@/lib/email/invoice-email";
import { getEmailConfig } from "@/lib/email/resend";
import { loadInvoiceDocument } from "@/lib/invoice/document";
import { formatDate } from "@/lib/invoice/format";
import { todayIn } from "@/lib/invoice/status";
import { formatMoney } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

import { DeliveryHistory, type Delivery } from "./delivery-history";
import { EmailInvoiceDialog } from "./email-invoice-dialog";
import { InvoiceActions } from "./invoice-actions";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const doc = await loadInvoiceDocument((await params).id);
  return { title: doc ? `Invoice ${doc.invoice.invoice_number}` : "Invoice" };
}

export default async function InvoicePage({ params }: Params) {
  const doc = await loadInvoiceDocument((await params).id);
  // RLS means another user's invoice behaves exactly like a missing one.
  if (!doc) notFound();
  const { invoice, status, data } = doc;

  const total = formatMoney(invoice.total_minor, invoice.currency);
  const supabase = await createClient();
  const { data: deliveries } = await supabase
    .from("invoice_email_deliveries")
    .select("id, recipient, status, error, created_at")
    .eq("invoice_id", invoice.id)
    .order("created_at", { ascending: false })
    .limit(10)
    .returns<Delivery[]>();
  const emailDetails = {
    businessName: data.business.name,
    clientName: data.client?.name ?? null,
    number: invoice.invoice_number,
    total,
    dueDate: data.dueDate,
  };

  const history = [
    `Created ${formatDate(invoice.created_at.slice(0, 10))}`,
    invoice.issued_at && `Issued ${formatDate(invoice.issued_at.slice(0, 10))}`,
    invoice.paid_at && `Paid ${formatDate(invoice.paid_at.slice(0, 10))}`,
  ].filter(Boolean);

  return (
    <div className="mx-auto grid max-w-4xl gap-6">
      <div className="grid gap-4">
        <Link href="/invoices" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden />
          Invoices
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{invoice.invoice_number}</h1>
          <StatusBadge status={status} />
          <span className="ml-auto text-2xl font-semibold tabular-nums">{total}</span>
        </div>
        <p className="text-sm text-muted-foreground">
          {data.client?.name ?? "No client"} · {history.join(" · ")}
          {status === "overdue" && <span className="font-medium text-destructive"> · Was due {data.dueDate}</span>}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <InvoiceActions
            id={invoice.id}
            number={invoice.invoice_number}
            status={status}
            clientName={data.client?.name ?? null}
            total={total}
            today={todayIn()}
          />
          {/* Only issued invoices can be emailed (IP-222). */}
          {status !== "draft" && (
            <EmailInvoiceDialog
              id={invoice.id}
              number={invoice.invoice_number}
              configured={getEmailConfig() !== null}
              defaults={{ to: data.client?.email ?? "", subject: defaultSubject(emailDetails), message: defaultMessage(emailDetails) }}
            />
          )}
        </div>
        <DeliveryHistory deliveries={deliveries ?? []} />
      </div>
      <InvoicePreview data={data} />
    </div>
  );
}
