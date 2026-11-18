import { defineConfig } from "@playwright/test";

// The tests talk to the real Supabase project in .env.local (they create and
// delete their own throwaway user).
try {
  process.loadEnvFile(".env.local");
} catch {
  // In CI the variables come from the environment instead.
}

const port = Number(process.env.E2E_PORT ?? 3317);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: "e2e",
  // Generous limits: they only bound how long a failure takes to report, and a
  // busy 2-core laptop can take well over a minute for a save plus re-render.
  timeout: 900_000,
  expect: { timeout: 120_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL,
    // Use the installed Chrome rather than downloading a browser.
    channel: process.env.E2E_CHANNEL ?? "chrome",
    actionTimeout: 120_000,
    navigationTimeout: 180_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: `pnpm exec next dev --turbopack -p ${port}`, url: baseURL, timeout: 240_000, reuseExistingServer: true },
});
