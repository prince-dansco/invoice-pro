# InvoicePro

Create professional invoices, download them as PDFs and track what you're owed.

Built with Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui and Supabase (Postgres, Auth, Storage). See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how it fits together.

## Features

- Email/password sign-up with confirmation, password reset, and optional Google sign-in
- Business profile with logo, address, tax ID and invoice defaults
- Client directory with search and soft delete
- Invoice editor with live preview, discounts, tax and draft saving
- Totals calculated on the server in integer minor units (kobo, cents)
- PDF download (A4 or US Letter) with multi-page support
- Statuses: draft, sent, paid and overdue, with issued invoices locked against changes
- Optional: email issued invoices with the PDF attached (Resend), with a delivery history
- Dashboard with outstanding, overdue and paid totals per currency

## Requirements

- Node.js 22+
- pnpm 10+
- A Supabase project (the free plan is enough)

## Setup

1. **Install dependencies**

   ```bash
   pnpm install
   ```

2. **Configure environment variables.** Copy the example and fill in the values from Supabase, under **Project Settings > API**:

   ```bash
   cp .env.example .env.local
   ```

   | Variable | Where to find it |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` / publishable key |
   | `SUPABASE_SERVICE_ROLE_KEY` | `service_role` / secret key. Server-only; never commit it or prefix it with `NEXT_PUBLIC_`. Used by the verification scripts and tests. |
   | `RESEND_API_KEY` | Optional. A [Resend](https://resend.com) API key, to email invoices from the app. Server-only. |
   | `EMAIL_FROM` | Optional. The sender, e.g. `Your Business <invoices@yourdomain.com>`. The domain must be verified in Resend. |

3. **Create the database.** In the Supabase **SQL Editor**, run each file in [`supabase/migrations/`](supabase/migrations/) in filename order. Supabase may warn about "destructive operations"; that's expected (the files tighten permissions and replace one policy). Alternatively, with the [Supabase CLI](https://supabase.com/docs/guides/cli): `supabase link` then `supabase db push`.

4. **Configure Supabase Auth** (dashboard):
   - **Authentication > URL Configuration**: set **Site URL** to your app's URL (`http://localhost:3000` locally) and add `http://localhost:3000/**` and your production URL followed by `/**` to **Redirect URLs**.
   - **Authentication > Emails**: so confirmation and reset links work in any browser or mail app, change two templates:
     - **Confirm signup**: `<a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email">Confirm your email</a>`
     - **Reset password**: `<a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery">Reset your password</a>`
   - **Google sign-in (optional)**: under **Authentication > Providers > Google**, add an OAuth client ID and secret from Google Cloud. Add `https://<project-ref>.supabase.co/auth/v1/callback` as an authorised redirect URI in Google Cloud. The "Continue with Google" button appears automatically within five minutes of enabling it.

5. **Email (optional).** To send invoices from the app, create a [Resend](https://resend.com) account, verify your sending domain, then set `RESEND_API_KEY` and `EMAIL_FROM`. Without them, the "Email invoice" dialog explains that email isn't set up and everything else works normally. Replies go to the business email in Settings. Each account can send up to 20 emails an hour.

6. **Run it**

   ```bash
   pnpm dev
   ```

   Open http://localhost:3000.

## Checks

| Command | What it does |
| --- | --- |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript, strict mode |
| `pnpm test` | Unit tests (calculations, draft parsing, statuses, filtering) |
| `pnpm build` | Production build |
| `pnpm verify:db` | Row-level security, invoice numbering, storage and status rules against your Supabase project. Uses throwaway users and deletes them. |
| `pnpm verify:pages` | Loads every page and downloads PDFs as a throwaway user. Needs the app running; set `APP_URL` if it isn't on port 3000. |
| `pnpm test:e2e` | The full user journey in Chrome (Playwright). Starts a dev server on port 3317, or set `E2E_BASE_URL` to test a running app. |

To run the page checks and end-to-end tests against a production build while `pnpm dev` is also running, build into a separate folder so the two don't overwrite each other:

```bash
NEXT_DIST_DIR=.next-test pnpm build
NEXT_DIST_DIR=.next-test pnpm exec next start -p 3318
E2E_BASE_URL=http://localhost:3318 pnpm test:e2e
```

CI (`.github/workflows/ci.yml`) runs lint, typecheck, unit tests and build on every push. The database and end-to-end checks need a real Supabase project, so they run locally.

## Deploying to Vercel

1. Push the repository to GitHub and import it in Vercel (framework preset: Next.js).
2. Add the three environment variables from `.env.local` in **Project Settings > Environment Variables**.
3. Deploy, then add the production URL to Supabase's **Site URL** and **Redirect URLs**.

The PDF route bundles its fonts (`src/assets/fonts`, Noto Sans, SIL Open Font License) via `outputFileTracingIncludes` in `next.config.ts`.

## Project layout

```
src/app/(auth)        sign in, sign up, password reset
src/app/(app)         signed-in area: dashboard, invoices, clients, settings
src/app/auth          auth callback and actions
src/lib/invoice       calculations, draft parsing, statuses, list filtering (unit-tested)
src/lib/pdf           PDF template
src/lib/supabase      browser, server and admin clients
supabase/migrations   database schema, RLS policies and functions
scripts               database and page verification
e2e                   Playwright end-to-end test
```

## Known limitations

- Email shows whether Resend *accepted* the email, not whether it was delivered or opened (that needs Resend webhooks).
- Payments are recorded in full only; partial payments aren't supported.
- "Overdue" is calculated using Lagos time (`todayIn()` in `src/lib/invoice/status.ts`).
- Through the database API a user could store inconsistent totals on their own drafts. It only affects their own data, and totals are recalculated whenever the app saves.
