// IP-222 / IP-223: the "Email invoice" dialog. Run against a server started with
// a deliberately invalid RESEND_API_KEY, so Resend rejects the request and no
// real email is ever sent. This checks that failure is reported (not shown as
// success) and that the attempt is recorded.
//
//   RESEND_API_KEY=re_invalid_for_tests EMAIL_FROM="Test <test@example.com>" next start ...
//   E2E_EMAIL=invalid-key E2E_BASE_URL=... pnpm test:e2e e2e/email.spec.ts

import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

test.skip(process.env.E2E_EMAIL !== "invalid-key", "Needs a server started with an invalid RESEND_API_KEY.");

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const email = `mail-${Date.now()}@example.com`;
const password = `Pw-${crypto.randomUUID()}`;
let userId: string | undefined;

test.afterAll(async () => {
  if (userId) await admin.auth.admin.deleteUser(userId);
});

test("email dialog prefills, reports a rejected send as a failure, and records it", async ({ page }) => {
  const { data } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  userId = data.user!.id;

  // Set up an issued invoice as the user.
  const user = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  await user.auth.signInWithPassword({ email, password });
  await user.from("profiles").update({ business_name: "Mail Test Ltd", email: "billing@example.com", currency: "NGN", onboarded_at: new Date().toISOString() }).eq("id", userId);
  const { data: client } = await user.from("clients").insert({ name: "Ada Lovelace", email: "ada@example.com" }).select().single();
  const { data: saved } = await user
    .rpc("save_invoice", {
      p_id: null,
      p_invoice: { client_id: client!.id, issue_date: "2026-11-13", due_date: "2026-11-27", currency: "NGN", discount_value: 0, tax_rate_bps: 0, subtotal_minor: 500000, discount_minor: 0, taxable_minor: 500000, tax_minor: 0, total_minor: 500000 },
      p_items: [{ description: "Consulting", quantity: "1.000", unit_price_minor: 500000, line_total_minor: 500000 }],
    })
    .single<{ saved_id: string }>();
  await user.rpc("issue_invoice", { p_id: saved!.saved_id });

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto(`/invoices/${saved!.saved_id}`);
  await page.getByRole("button", { name: "Email invoice" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("To")).toHaveValue("ada@example.com");
  await expect(dialog.getByLabel("Subject")).toHaveValue("Invoice INV-001 from Mail Test Ltd");
  await expect(dialog.getByLabel("Message")).toHaveValue(/invoice INV-001 for ₦5,000\.00, due 27 Nov 2026/);

  // A bad address is rejected before anything is sent.
  await dialog.getByLabel("To").fill("not-an-email");
  await dialog.getByRole("button", { name: "Send email" }).click();
  await expect(dialog.getByText("Enter one valid email address.")).toBeVisible();

  // Resend rejects the invalid key: the dialog stays open with the reason, and no success toast appears.
  await dialog.getByLabel("To").fill("ada@example.com");
  await dialog.getByRole("button", { name: "Send email" }).click();
  await expect(dialog.getByText("The email service rejected the API key. Check RESEND_API_KEY.")).toBeVisible();
  await expect(page.getByText(/^Emailed INV-001/)).toHaveCount(0);

  // The attempt is recorded and shown.
  await dialog.getByRole("button", { name: "Cancel" }).click();
  const history = page.getByRole("region", { name: "Email history" });
  await expect(history).toContainText("Couldn't send to ada@example.com");
  const { data: rows } = await admin.from("invoice_email_deliveries").select("status, recipient, error").eq("invoice_id", saved!.saved_id);
  expect(rows).toEqual([{ status: "failed", recipient: "ada@example.com", error: "The email service rejected the API key. Check RESEND_API_KEY." }]);
});
