import { NextResponse, type NextRequest } from "next/server";

import { getUser } from "@/lib/auth/session";
import { loadInvoiceDocument } from "@/lib/invoice/document";
import type { PageSize } from "@/lib/pdf/invoice-pdf";
import { renderInvoicePdf } from "@/lib/pdf/render";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Middleware already guards /invoices, but route handlers check for themselves.
  const user = await getUser();
  if (!user) return new NextResponse("Not found", { status: 404 });

  // Built from saved, server-calculated data. RLS returns nothing for another
  // user's invoice, which becomes the same 404 as a missing one.
  const doc = await loadInvoiceDocument((await params).id);
  if (!doc) return new NextResponse("Not found", { status: 404 });

  const size: PageSize = request.nextUrl.searchParams.get("size") === "letter" ? "LETTER" : "A4";
  const { bytes, fileName } = await renderInvoicePdf(doc, size);

  const disposition = request.nextUrl.searchParams.get("inline") === "1" ? "inline" : "attachment";
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
