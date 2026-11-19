// Loads the app's pages as a throwaway signed-in user and checks they render real data.
//
//   APP_URL=http://localhost:3000 node --env-file=.env.local scripts/verify-pages.mjs
import { createClient } from "@supabase/supabase-js";

const base = process.env.APP_URL ?? "http://localhost:3000";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const ref = new URL(url).hostname.split(".")[0];
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const email = `render-check-${Date.now()}@example.com`, password = `Pw-${crypto.randomUUID()}`;
const { data: u } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
const c = createClient(url, anon, { auth: { persistSession: false } });
const { data: auth } = await c.auth.signInWithPassword({ email, password });

// @supabase/ssr cookie format: "base64-" + base64url(JSON session), chunked at 3180 chars.
const value = "base64-" + Buffer.from(JSON.stringify(auth.session)).toString("base64url");
const name = `sb-${ref}-auth-token`;
const chunks = value.match(/.{1,3180}/g);
const cookie = chunks.length === 1 ? `${name}=${value}` : chunks.map((ch, i) => `${name}.${i}=${ch}`).join("; ");

let failures = 0;
const check = (label, ok, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
};

try {
  await c.from("profiles").update({
    business_name: "Render Check Ltd", currency: "NGN", default_tax_rate_bps: 750,
    default_payment_instructions: "GTBank 0123456789", onboarded_at: new Date().toISOString(),
  }).eq("id", u.user.id);
  const { data: client } = await c.from("clients").insert({ name: "Ada Lovelace", company: "Analytical Ltd", city: "Lagos" }).select().single();
  const { data: saved } = await c.rpc("save_invoice", {
    p_id: null,
    p_invoice: { client_id: client.id, issue_date: "2026-11-04", due_date: "2026-11-18", currency: "NGN", discount_value: 0, tax_rate_bps: 750, subtotal_minor: 10000000, discount_minor: 0, taxable_minor: 10000000, tax_minor: 750000, total_minor: 10750000, payment_instructions: "GTBank 0123456789" },
    p_items: [{ description: "Brand identity design", quantity: "2.000", unit_price_minor: 5000000, line_total_minor: 10000000 }],
  }).single();

  const get = async (path) => {
    const res = await fetch(base + path, { headers: { cookie }, redirect: "manual" });
    // React separates adjacent text with <!-- --> markers; drop them so phrases match.
    const html = res.status === 200 ? (await res.text()).replaceAll("<!-- -->", "") : "";
    return { status: res.status, location: res.headers.get("location"), html };
  };

  // A second, long invoice that gets issued: exercises the status flow and multi-page PDFs.
  const many = Array.from({ length: 60 }, (_, i) => ({ description: `Consulting session ${i + 1}: a longer description that wraps onto a second line in the PDF table`, quantity: "1.000", unit_price_minor: 1000000, line_total_minor: 1000000 }));
  const { data: long } = await c.rpc("save_invoice", {
    p_id: null,
    p_invoice: { client_id: client.id, issue_date: "2026-10-01", due_date: "2026-10-15", currency: "NGN", discount_value: 0, tax_rate_bps: 0, subtotal_minor: 60000000, discount_minor: 0, taxable_minor: 60000000, tax_minor: 0, total_minor: 60000000 },
    p_items: many,
  }).single();
  const issue = await c.rpc("issue_invoice", { p_id: long.saved_id });
  check("long invoice issued", !issue.error, issue.error?.message);

  const pages = [
    ["/dashboard", ["Outstanding", "₦600,000.00", "Overdue", "INV-002", "Recent invoices"]],
    ["/invoices", ["INV-001", "INV-002", "Ada Lovelace", "₦107,500.00", "Draft", "Overdue"]],
    ["/invoices?status=overdue", ["INV-002", "Showing 1 of 2"]],
    ["/invoices?q=ada&sort=total&dir=asc", ["Showing 2 of 2"]],
    [`/invoices/${saved.saved_id}`, ["INV-001", "Issue invoice", "Download PDF", "Brand identity design"]],
    [`/invoices/${long.saved_id}`, ["INV-002", "Overdue", "Mark as paid", "Reopen as draft", "Consulting session 60"]],
    ["/invoices/new", ["New invoice", "Render Check Ltd", "Ada Lovelace", "GTBank 0123456789", "INV-003"]],
    [`/invoices/${saved.saved_id}/edit`, ["INV-001", "Brand identity design", "₦107,500.00", "₦7,500.00", "Analytical Ltd"]],
    ["/clients", ["Ada Lovelace"]],
    [`/clients/${client.id}`, ["Ada Lovelace", "Delete client"]],
    ["/settings", ["Render Check Ltd", "INV-003"]],
    ["/login", []],
  ];
  for (const [path, expects] of pages) {
    const r = await get(path);
    if (path === "/login") {
      check("signed-in user is sent from /login to /dashboard", r.status === 307 && r.location?.endsWith("/dashboard"), `${r.status} ${r.location}`);
      continue;
    }
    const missing = expects.filter((s) => !r.html.includes(s));
    check(`${path} renders`, r.status === 200 && missing.length === 0, r.status !== 200 ? `${r.status} ${r.location ?? ""}` : missing.length ? `missing: ${missing.join(", ")}` : "");
  }

  const other = await get("/invoices/00000000-0000-0000-0000-000000000000/edit");
  check("unknown invoice is a 404", other.status === 404, String(other.status));
  const lockedEdit = await get(`/invoices/${long.saved_id}/edit`);
  check("issued invoice's edit page redirects to its view page", lockedEdit.status === 307 && lockedEdit.location?.endsWith(`/invoices/${long.saved_id}`), `${lockedEdit.status} ${lockedEdit.location}`);

  // A PNG logo. (WebP is converted to PNG in the browser before upload, so only PNG and JPEG reach storage.)
  const sharp = (await import("sharp")).default;
  const png = await sharp({ create: { width: 240, height: 80, channels: 4, background: "#24408e" } }).png().toBuffer();
  const logoPath = `${u.user.id}/logo-check.png`;
  const up = await c.storage.from("logos").upload(logoPath, png, { contentType: "image/png" });
  await c.from("profiles").update({ logo_path: logoPath }).eq("id", u.user.id);
  check("test logo uploaded", !up.error, up.error?.message);

  // PDFs (IP-181 to IP-184). Saved to PDF_DIR for inspection when set.
  const { writeFile } = await import("node:fs/promises");
  for (const [label, path, name] of [
    ["draft A4", `/invoices/${saved.saved_id}/pdf`, "INV-001-Ada-Lovelace.pdf"],
    ["issued US Letter, 60 lines", `/invoices/${long.saved_id}/pdf?size=letter`, "INV-002-Ada-Lovelace.pdf"],
  ]) {
    const res = await fetch(base + path, { headers: { cookie } });
    const bytes = Buffer.from(await res.arrayBuffer());
    const disposition = res.headers.get("content-disposition") ?? "";
    check(
      `PDF ${label}`,
      res.status === 200 && res.headers.get("content-type") === "application/pdf" && bytes.subarray(0, 5).toString() === "%PDF-" && disposition.includes(`filename="${name}"`),
      `${res.status} ${res.headers.get("content-type")} ${disposition}`,
    );
    check(`PDF ${label} embeds the logo`, bytes.includes("/Subtype /Image"));
    if (process.env.PDF_DIR && res.status === 200) await writeFile(`${process.env.PDF_DIR}/${name}`, bytes);
  }
  const otherPdf = await fetch(`${base}/invoices/00000000-0000-0000-0000-000000000000/pdf`, { headers: { cookie } });
  check("PDF of an unknown or someone else's invoice is a 404", otherPdf.status === 404, String(otherPdf.status));
  const anonPdf = await fetch(`${base}/invoices/${saved.saved_id}/pdf`, { redirect: "manual" });
  check("PDF needs a signed-in user", anonPdf.status === 307, String(anonPdf.status));

  // Public landing page.
  const landing = await fetch(base + "/").then((r) => r.text());
  check("landing page renders for visitors", landing.includes("Create your first invoice") && landing.includes("Example invoice") && landing.includes("Sign in"));
} finally {
  await admin.storage.from("logos").remove([`${u.user.id}/logo-check.png`]);
  await admin.auth.admin.deleteUser(u.user.id);
}
console.log(failures ? `\n${failures} failed` : "\nAll page checks passed.");
process.exit(failures ? 1 : 0);
