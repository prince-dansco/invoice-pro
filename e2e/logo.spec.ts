// A WebP logo is converted to PNG in the browser before upload, because PDFs can
// only embed PNG and JPEG and the server no longer has an image converter.

import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import sharp from "sharp";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const email = `logo-${Date.now()}@example.com`;
const password = `Pw-${crypto.randomUUID()}`;
let userId: string | undefined;

test.afterAll(async () => {
  if (!userId) return;
  const { data } = await admin.storage.from("logos").list(userId);
  if (data?.length) await admin.storage.from("logos").remove(data.map((f) => `${userId}/${f.name}`));
  await admin.auth.admin.deleteUser(userId);
});

test("a WebP logo is uploaded as PNG", async ({ page }) => {
  const { data } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  userId = data.user!.id;
  await admin.from("profiles").update({ business_name: "Logo Test Ltd", currency: "NGN", onboarded_at: new Date().toISOString() }).eq("id", userId);

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  // The dev server compiles the dashboard on first use, which can be slow here.
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 480_000 });

  await page.goto("/settings");
  const webp = await sharp({ create: { width: 2400, height: 800, channels: 4, background: "#24408e" } }).webp().toBuffer();
  await page.locator('input[type="file"][name="logo"]').setInputFiles({ name: "brand.webp", mimeType: "image/webp", buffer: webp });
  await expect(page.getByText("Logo updated.")).toBeVisible({ timeout: 300_000 });

  const { data: profile } = await admin.from("profiles").select("logo_path").eq("id", userId).single();
  expect(profile!.logo_path).toMatch(/\.png$/);
  const { data: file } = await admin.storage.from("logos").download(profile!.logo_path!);
  const meta = await sharp(Buffer.from(await file!.arrayBuffer())).metadata();
  expect(meta.format).toBe("png");
  // Scaled down to 1200px on the longest side.
  expect([meta.width, meta.height]).toEqual([1200, 400]);
});
