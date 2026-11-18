# InvoicePro architecture

## Starting point

The repository started empty (only editor config in `.qodo/`). Everything here was scaffolded in Phase 1.

## Stack

| Concern | Choice |
| --- | --- |
| Package manager | pnpm 10 (Node 22) |
| Framework | Next.js 15 App Router, React 19, Turbopack |
| Language | TypeScript, `strict: true` |
| Styling | Tailwind CSS v4, theme tokens in `src/app/globals.css` |
| Components | shadcn/ui (Base UI primitives), Lucide icons, Sonner toasts |
| Backend | Supabase: Postgres with row-level security, Auth, Storage |
| Validation | Zod, on both client and server |
| PDF | `@react-pdf/renderer` (Phase 5) |
| Email | Resend (optional, Phase 6) |
| Hosting | Vercel |

## Layout

```
src/
  app/
    page.tsx              public landing page
    (app)/                signed-in area, shares the app shell
      layout.tsx          sidebar + top bar
      dashboard/ invoices/ clients/ settings/
  components/
    app-shell/            sidebar, mobile nav, top bar, page header
    ui/                   shadcn/ui components
  lib/
    env.ts                validated public env vars
    supabase/
      client.ts           browser client (anon key)
      server.ts           server client bound to the user's cookies
      admin.ts            service-role client, server-only
      middleware.ts       session refresh
  middleware.ts
```

## Supabase clients

- **Browser (`client.ts`)** and **server (`server.ts`)** clients use the anon key and act as the signed-in user, so row-level security applies to every query.
- **Admin (`admin.ts`)** uses the service-role key and bypasses RLS. It imports `server-only`, so the build fails if client code imports it. Use it only for trusted operations that can't run as the user.
- **Middleware** refreshes the session cookie on each request. Route protection is added in IP-124.

## Rules carried through every phase

- Money is stored and calculated as integer minor units. Totals are recalculated on the server; browser-supplied totals are ignored.
- Every server action re-checks the session and ownership, and only updates whitelisted fields.
- Invoices keep snapshots of business and client details so history doesn't change.
- Invoice numbers are generated atomically in the database.

## Database

Migrations live in `supabase/migrations/` and run in filename order:

1. `..._core_schema.sql`: `profiles`, `clients`, `invoices`, `invoice_items`, `updated_at` triggers, and a trigger that creates a profile for each new auth user.
2. `..._keys_and_indexes.sql`: composite foreign keys on `(id, user_id)`, so an invoice can only reference the same user's client and an item the same user's invoice. Also `unique (user_id, invoice_number)` and indexes.
3. `..._row_level_security.sql`: RLS on every table; users can only touch their own rows and anonymous access is revoked.
4. `..._invoice_numbers.sql`: numbers like `INV-001`, assigned by a trigger from a counter on the profile. The row lock on that counter serializes concurrent inserts. Any number sent by the client is ignored, and numbers can't be changed later.

Money is stored as `bigint` minor units and rates as basis points (`750` = 7.5%).

`node --env-file=.env.local scripts/verify-db.mjs` checks RLS, numbering and constraints against the real project. It uses two throwaway users and deletes them afterwards.

## Authentication

- Email/password, password recovery and Google OAuth all return through `/auth/callback`, which exchanges the code for a session and only redirects to same-site paths.
- `middleware.ts` sends signed-out visitors from private pages to `/login?next=...` and signed-in users away from the sign-in pages.
- Every Server Action calls `requireUser()` again, because actions can be called directly.
- New users go to `/onboarding` until `profiles.onboarded_at` is set. Skipping onboarding also sets it.
- The Google button only appears when Google is enabled in Supabase; this is checked every five minutes.

### Supabase dashboard settings

- **Authentication > URL Configuration**: set Site URL, and add `http://localhost:3000/**` plus the production URL to Redirect URLs.
- **Authentication > Providers > Google**: add the Google OAuth client ID and secret. The button appears automatically once enabled.
- **Authentication > Emails**: change the links in two templates so they work in any browser, including mail apps. The default `{{ .ConfirmationURL }}` link uses PKCE, which only works in the browser where the user signed up.
  - **Confirm signup**: `<a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email">Confirm your email</a>`
  - **Reset password**: `<a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery">Reset your password</a>`

  `{{ .RedirectTo }}` is the app's `/auth/callback?next=...` URL, which already has a query string, hence the `&`.

## Environment variables

See `.env.example`.

| Variable | Where it's used | Exposed to browser |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | all Supabase clients | yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser and server clients | yes |
| `SUPABASE_SERVICE_ROLE_KEY` | `lib/supabase/admin.ts` only | **no** |
| `RESEND_API_KEY` | email delivery (Phase 6, optional) | no |

A missing required variable throws `Missing environment variable X. Copy .env.example to .env.local and fill it in.`

## External services

- **Supabase project**: database, Auth (email/password plus Google OAuth) and a Storage bucket for logos.
- **Google Cloud OAuth client**: for Google sign-in (IP-123).
- **Resend**: optional, for sending invoices by email.
- **Vercel**: deployment.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | development server |
| `pnpm build` | production build |
| `pnpm start` | serve the production build |
| `pnpm lint` | ESLint |
| `pnpm exec tsc --noEmit` | type check |
