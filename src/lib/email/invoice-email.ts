// Builds the invoice email. Pure, so it's unit-tested. Everything the user
// typed is HTML-escaped: the message is shown as text, never as markup.

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ESCAPES[c]);

type Details = { businessName: string; clientName: string | null; number: string; total: string; dueDate: string };

export function defaultSubject(d: Details) {
  return `Invoice ${d.number} from ${d.businessName || "us"}`;
}

export function defaultMessage(d: Details) {
  return [
    `Hi${d.clientName ? ` ${d.clientName}` : ""},`,
    "",
    `Please find attached invoice ${d.number} for ${d.total}${d.dueDate ? `, due ${d.dueDate}` : ""}.`,
    "",
    "Thank you,",
    d.businessName,
  ]
    .join("\n")
    .trim();
}

export function buildInvoiceEmail(d: Details & { message: string; fileName: string }) {
  const paragraphs = d.message
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");

  const summary = [
    ["Invoice", d.number],
    ["Amount due", d.total],
    ...(d.dueDate ? [["Due date", d.dueDate]] : []),
  ]
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 16px 4px 0;color:#71717a">${escapeHtml(k)}</td><td style="padding:4px 0;font-weight:600;color:#18181b">${escapeHtml(v)}</td></tr>`,
    )
    .join("");

  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#3f3f46">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;padding:28px">
${paragraphs}
<table role="presentation" style="border-collapse:collapse;margin:8px 0 16px">${summary}</table>
<p style="margin:0;color:#71717a;font-size:13px">The invoice is attached as ${escapeHtml(d.fileName)}.</p>
</div></body></html>`;

  const text = `${d.message.trim()}\n\nInvoice: ${d.number}\nAmount due: ${d.total}${d.dueDate ? `\nDue date: ${d.dueDate}` : ""}\n\nThe invoice is attached as ${d.fileName}.`;

  return { html, text };
}
