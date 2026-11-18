import "server-only";

import { renderToBuffer } from "@react-pdf/renderer";

import { loadLogoForPdf, type loadInvoiceDocument } from "@/lib/invoice/document";

import { InvoicePdf, type PageSize } from "./invoice-pdf";

type InvoiceDocument = NonNullable<Awaited<ReturnType<typeof loadInvoiceDocument>>>;

/** "INV-001" + "Ada Lovelace" -> "INV-001-Ada-Lovelace.pdf", safe for any file system. */
export function pdfFileName(number: string, clientName: string | undefined) {
  const slug = (str: string) =>
    str
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 60);
  return [slug(number) || "invoice", clientName && slug(clientName)].filter(Boolean).join("-") + ".pdf";
}

/** The invoice PDF used by both the download route and email attachments. */
export async function renderInvoicePdf(doc: InvoiceDocument, size: PageSize = "A4") {
  const logo = await loadLogoForPdf(doc.logoPath).catch(() => null);
  const bytes = await renderToBuffer(<InvoicePdf data={doc.data} logo={logo} size={size} isDraft={doc.invoice.status === "draft"} />);
  return { bytes, fileName: pdfFileName(doc.invoice.invoice_number, doc.data.client?.name) };
}
