import { describe, expect, it } from "vitest";

import { emailInvoiceSchema } from "@/lib/validation/email";

import { buildInvoiceEmail, defaultMessage, defaultSubject, escapeHtml } from "./invoice-email";

const details = { businessName: "E2E Studio", clientName: "Ada Lovelace", number: "INV-001", total: "₦107,500.00", dueDate: "18 Nov 2026" };

describe("invoice email", () => {
  it("prefills a subject and message from the invoice", () => {
    expect(defaultSubject(details)).toBe("Invoice INV-001 from E2E Studio");
    expect(defaultMessage(details)).toContain("Hi Ada Lovelace,");
    expect(defaultMessage(details)).toContain("invoice INV-001 for ₦107,500.00, due 18 Nov 2026");
  });

  it("escapes anything the user typed, so it can't inject markup", () => {
    const { html } = buildInvoiceEmail({ ...details, message: `<script>alert(1)</script>\n<a href="x">click</a>`, fileName: "INV-001.pdf" });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain('<a href="x">');
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;<br>&lt;a href=&quot;x&quot;&gt;click&lt;/a&gt;");
    expect(escapeHtml(`'"&`)).toBe("&#39;&quot;&amp;");
  });

  it("turns blank lines into paragraphs and keeps a plain-text version", () => {
    const { html, text } = buildInvoiceEmail({ ...details, message: "Hello\n\nLine one\nLine two", fileName: "INV-001-Ada-Lovelace.pdf" });
    expect(html.match(/<p style="margin:0 0 16px">/g)).toHaveLength(2);
    expect(html).toContain("Line one<br>Line two");
    expect(text).toContain("Amount due: ₦107,500.00");
    expect(text).toContain("INV-001-Ada-Lovelace.pdf");
  });
});

describe("emailInvoiceSchema", () => {
  const valid = { to: "ada@example.com", subject: "Invoice INV-001", message: "Hi" };

  it("accepts one valid recipient", () => {
    expect(emailInvoiceSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects bad or multiple recipients and header injection in the subject", () => {
    expect(emailInvoiceSchema.safeParse({ ...valid, to: "not-an-email" }).success).toBe(false);
    expect(emailInvoiceSchema.safeParse({ ...valid, to: "a@example.com, b@example.com" }).success).toBe(false);
    expect(emailInvoiceSchema.safeParse({ ...valid, subject: "Hi\r\nBcc: victim@example.com" }).success).toBe(false);
    expect(emailInvoiceSchema.safeParse({ ...valid, subject: "" }).success).toBe(false);
  });
});
