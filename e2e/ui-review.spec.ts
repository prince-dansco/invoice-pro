// Interface checks that otherwise need a person: phone-width layouts, the mobile
// menu, the editor's Edit/Preview toggle, the inline "New client" dialog, client
// form validation, the settings preview, and automated accessibility (axe,
// including colour contrast) in light and dark mode.
//
// Set SCREENSHOT_DIR to save screenshots for a visual look.

import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const email = `ui-${Date.now()}@example.com`;
const password = `Pw-${crypto.randomUUID()}`;
let userId: string;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  userId = data.user.id;
  await admin
    .from("profiles")
    .update({ business_name: "UI Review Studio", currency: "NGN", default_tax_rate_bps: 750, onboarded_at: new Date().toISOString() })
    .eq("id", userId);
});

test.afterAll(async () => {
  if (userId) await admin.auth.admin.deleteUser(userId);
});

async function shot(page: Page, name: string) {
  if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/${name}.png`, fullPage: true });
}

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function noHorizontalScroll(page: Page) {
  const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(scroll, "page is wider than the screen").toBeLessThanOrEqual(client);
}

async function axe(page: Page, label: string) {
  // Contrast results on an unstyled page are meaningless, so fail clearly if CSS didn't load.
  const font = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  expect(font, `stylesheet didn't load on ${label}`).toContain("Geist");
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} × ${v.nodes[0]?.target.join(" ")}`);
  expect(summary, `accessibility problems on ${label}`).toEqual([]);
}

test.describe("phone width (360px)", () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test("landing page fits and has a clear call to action", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Create your first invoice" }).first()).toBeVisible();
    await noHorizontalScroll(page);
    await shot(page, "landing-360");
  });

  test("mobile menu, editor toggle and inline new client", async ({ page }) => {
    await signIn(page);
    await noHorizontalScroll(page);
    await shot(page, "dashboard-360");

    // Mobile menu opens, navigates and closes.
    await expect(page.getByRole("navigation", { name: "Main" })).toBeHidden();
    await page.getByRole("button", { name: "Open menu" }).click();
    const menu = page.getByRole("dialog");
    await expect(menu).toBeVisible();
    await shot(page, "menu-360");
    await menu.getByRole("link", { name: "Invoices" }).click();
    await expect(page).toHaveURL(/\/invoices$/);
    await expect(menu).toBeHidden();

    // Editor: type something first, then add a client from the dialog.
    await page.goto("/invoices/new");
    await page.getByLabel("Description, line 1").fill("Logo refresh");
    await page.getByLabel("Unit price, line 1").fill("25000");
    await noHorizontalScroll(page);
    await shot(page, "editor-edit-360");

    await page.getByRole("button", { name: "New client" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill("Chidi Okafor");
    await dialog.getByRole("button", { name: "Add client" }).click();
    await expect(dialog).toBeHidden();
    // The new client is selected and nothing typed earlier was lost.
    await expect(page.getByLabel("Bill to").locator("option:checked")).toHaveText("Chidi Okafor");
    await expect(page.getByLabel("Description, line 1")).toHaveValue("Logo refresh");
    await expect(page.getByLabel("Unit price, line 1")).toHaveValue("25000");

    // Preview toggle.
    await page.getByRole("button", { name: "Preview" }).click();
    const preview = page.getByRole("article", { name: "Invoice preview" });
    await expect(preview).toBeVisible();
    await expect(preview.getByText("Chidi Okafor")).toBeVisible();
    await expect(preview.getByText("₦26,875.00")).toBeVisible(); // 25,000 + 7.5%
    await expect(page.getByLabel("Description, line 1")).toBeHidden();
    await noHorizontalScroll(page);
    await shot(page, "editor-preview-360");
    await page.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByLabel("Description, line 1")).toBeVisible();
  });
});

test.describe("desktop", () => {
  test.use({ viewport: { width: 1280, height: 860 } });

  test("client form validates in the browser, then edits, searches and deletes", async ({ page }) => {
    await signIn(page);
    await page.goto("/clients/new");

    // Invalid email is caught before anything is sent.
    let posted = false;
    page.on("request", (r) => {
      if (r.method() === "POST" && r.url().includes("/clients/new")) posted = true;
    });
    await page.getByLabel("Email").fill("not-an-email");
    await page.getByRole("button", { name: "Add client" }).click();
    await expect(page.getByText("Enter the client's name.")).toBeVisible();
    await expect(page.getByText("Enter a valid email address.")).toBeVisible();
    expect(posted, "the form was sent despite errors").toBe(false);
    await shot(page, "client-errors");

    await page.getByLabel("Name").fill("Ngozi Eze");
    await page.getByLabel("Email").fill("ngozi@example.com");
    await page.getByLabel("Company").fill("Eze & Sons, Ltd");
    await page.getByRole("button", { name: "Add client" }).click();
    await expect(page).toHaveURL(/\/clients$/);

    await page.getByLabel("Search clients").fill("sons, ltd");
    await expect(page).toHaveURL(/q=sons/);
    await expect(page.getByRole("link", { name: /Ngozi Eze/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Chidi Okafor/ })).toBeHidden();

    await page.getByRole("link", { name: /Ngozi Eze/ }).click();
    await page.getByLabel("Phone").fill("0803 000 0000");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page).toHaveURL(/\/clients$/);

    await page.getByRole("link", { name: /Ngozi Eze/ }).click();
    await expect(page.getByLabel("Phone")).toHaveValue("0803 000 0000");
    await page.getByRole("button", { name: "Delete client" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete client" }).click();
    await expect(page).toHaveURL(/\/clients$/);
    await expect(page.getByRole("link", { name: /Ngozi Eze/ })).toBeHidden();
  });

  test("settings shows the next invoice number as you type", async ({ page }) => {
    await signIn(page);
    await page.goto("/settings");
    await page.getByLabel("Invoice number prefix").fill("UIR-");
    await page.getByLabel("Next invoice number").fill("42");
    await expect(page.getByText("UIR-042")).toBeVisible();
    await page.getByLabel("Default tax rate (%)").fill("101");
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText("Enter a percentage from 0 to 100, like 7.5.")).toBeVisible();
    await page.getByLabel("Default tax rate (%)").fill("7.5");
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText("Settings saved.")).toBeVisible();
    await shot(page, "settings");
  });

  for (const scheme of ["light", "dark"] as const) {
    test(`accessibility and contrast, ${scheme} mode`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/");
      await axe(page, `landing (${scheme})`);
      await page.goto("/login");
      await axe(page, `login (${scheme})`);
      await signIn(page);
      for (const path of ["/dashboard", "/invoices", "/invoices/new", "/clients", "/settings"]) {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        await axe(page, `${path} (${scheme})`);
      }
      await shot(page, `settings-${scheme}`);
    });
  }
});
