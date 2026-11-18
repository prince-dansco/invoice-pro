// IP-242: the core journey, end to end in a real browser against the real
// Supabase project: confirm a new account, set up the business, add a client,
// create and issue an invoice, download the PDF, mark it paid, check the dashboard.

import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const email = `e2e-${Date.now()}@example.com`;
const password = `Pw-${crypto.randomUUID()}`;
let userId: string | undefined;

test.afterAll(async () => {
  if (userId) await admin.auth.admin.deleteUser(userId);
});

test("new user creates, issues, downloads and gets paid for an invoice", async ({ page }) => {
  // 1. Sign up and confirm. generateLink creates the account and returns the
  // confirmation token without sending an email (so no real inbox is needed);
  // opening it exercises the same /auth/callback route as the email link.
  const { data, error } = await admin.auth.admin.generateLink({ type: "signup", email, password });
  expect(error).toBeNull();
  userId = data.user!.id;
  await page.goto(`/auth/callback?token_hash=${data.properties!.hashed_token}&type=signup&next=/onboarding`);

  // 2. Business setup.
  await expect(page.getByRole("heading", { name: "Set up your business" })).toBeVisible();
  await page.getByLabel("Business name").fill("E2E Studio");
  await page.getByLabel("Default currency").selectOption("NGN");
  await page.getByRole("button", { name: "Save and continue" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Get started" })).toBeVisible();

  // 3. Add a client.
  await page.getByRole("link", { name: "Add client" }).click();
  await page.getByLabel("Name").fill("Ada Lovelace");
  await page.getByLabel("Email").fill("ada@example.com");
  await page.getByRole("button", { name: "Add client" }).click();
  await expect(page).toHaveURL(/\/clients$/);
  await expect(page.getByRole("link", { name: /Ada Lovelace/ })).toBeVisible();

  // 4. Create an invoice: 2 x ₦50,000 with 7.5% tax = ₦107,500.
  await page.goto("/invoices/new");
  await page.getByLabel("Bill to").selectOption({ label: "Ada Lovelace" });
  await page.getByLabel("Description, line 1").fill("Brand identity design");
  await page.getByLabel("Quantity, line 1").fill("2");
  await page.getByLabel("Unit price, line 1").fill("50000");
  await page.getByLabel("Tax rate (%)").fill("7.5");
  const preview = page.getByRole("article", { name: "Invoice preview" });
  await expect(preview.getByText("₦107,500.00")).toBeVisible();
  const saveStarted = Date.now();
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page).toHaveURL(/\/invoices\/[0-9a-f-]{36}\/edit$/, { timeout: 300_000 });
  console.log(`save + redirect took ${Date.now() - saveStarted} ms`);
  await expect(page.getByRole("heading", { name: "INV-001" })).toBeVisible();

  // Reopening the draft restores every field.
  await page.reload();
  await expect(page.getByLabel("Description, line 1")).toHaveValue("Brand identity design");
  await expect(page.getByLabel("Unit price, line 1")).toHaveValue("50000.00");

  // 5. Issue it.
  await page.getByRole("link", { name: "Preview & issue" }).click();
  await page.getByRole("button", { name: "Issue invoice" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Issue invoice" }).click();
  await expect(page.getByText("Sent", { exact: true })).toBeVisible();

  // 6. Download the PDF.
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download PDF" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("INV-001-Ada-Lovelace.pdf");

  // 7. Mark it paid.
  await page.getByRole("button", { name: "Mark as paid" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Mark as paid" }).click();
  await expect(page.getByText("Paid", { exact: true })).toBeVisible();

  // 8. The dashboard reflects the payment.
  await page.getByRole("link", { name: "Dashboard" }).first().click();
  const paidCard = page.getByRole("region", { name: "Summary" }).getByRole("link").filter({ hasText: "1 paid" });
  await expect(paidCard).toContainText("₦107,500.00");
  await expect(page.getByText("Nothing overdue")).toBeVisible();

  // 9. Sign out; private pages are closed again.
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/);
});
