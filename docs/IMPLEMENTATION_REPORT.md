# InvoicePro MVP: implementation report

Status as of 18 November 2026. Covers all spec phases, 1 to 7, including the optional phase 6 (email).

## What works

| Area | Delivered |
| --- | --- |
| Foundation | Next.js 15 App Router, strict TypeScript, Tailwind v4, shadcn/ui, app shell with desktop sidebar and mobile menu |
| Database | 7 migrations: profiles, clients, invoices, items; RLS on every table; composite `(id, user_id)` foreign keys; atomic invoice numbering; logo storage; transactional `save_invoice`; status functions and edit-lock triggers |
| Auth | Email/password sign-up with confirmation, sign-in, password reset, optional Google sign-in (button appears when enabled), route protection, onboarding |
| Business profile | All §7 fields, logo upload (PNG/JPG/WebP, 1 MB, checked by content), currency, terms, numbering, tax defaults |
| Clients | List with search, create/edit with shared client + server validation, soft delete, inline creation from the editor |
| Calculations | Integer minor units, half-up rounding, discount before tax, recalculated on the server; browser totals ignored |
| Invoice editor | Header, line items, discounts, tax, notes; draft saving; live preview; responsive layout; unsaved-changes warning; Ctrl+S |
| PDF | A4/US Letter, embedded Noto Sans (₦ renders), logo (WebP converted), repeated table header, page numbers, `INV-001-Client-Name.pdf` |
| Statuses | Draft → Sent → Paid, derived Overdue (Lagos time), reopen as draft (keeps number), mark unpaid; issued invoices frozen in the database |
| Dashboard | Outstanding, overdue, paid, total invoiced, sent and draft counts from real data, per currency; overdue and recent lists; getting-started checklist |
| Invoice list | Search by number or client, status filter including Overdue, sortable columns |
| Landing page | Hero, example invoice, features, how it works, footer. No invented claims |
| Hardening | Security headers, friendly error pages, network failures never lose editor data |
| Email (phase 6) | "Email invoice" on issued invoices via Resend: prefilled recipient, subject and message, PDF attached, reply-to the business; success only after Resend accepts; every attempt recorded (append-only) and shown; 20 emails/hour per account; off and harmless when not configured |

## Checks run

All run against the real Supabase project on 9 November 2026, on a production build.

| Check | Result |
| --- | --- |
| `pnpm lint` | Clean |
| `pnpm typecheck` | Clean |
| `pnpm test` | 50 unit tests pass (calculations, draft parsing, statuses, list filtering, dashboard totals, email content and validation) |
| `pnpm build` | Succeeds |
| `pnpm verify:db` | 61 checks pass: RLS for every table with a second user and anonymous access, storage policies, numbering under 20 concurrent inserts, `save_invoice` atomicity, status transitions and edit locks |
| `pnpm verify:pages` | 25 checks pass: every page renders real data, PDFs download with correct size, name, logo and ₦, multi-page PDF (60 lines, 4 pages), 404 for other users' invoices |
| `pnpm test:e2e` (core journey) | Passes: confirm sign-up, set up business, add client, create invoice (₦107,500.00), save, reload, issue, download PDF, mark paid, dashboard, sign out |
| `pnpm test:e2e` (UI review, 13 Nov) | 6 checks pass: no horizontal scrolling at 360px, mobile menu, editor Edit/Preview toggle, inline "New client", client validation/edit/search/delete, settings preview and validation, axe WCAG 2.1 AA including contrast in light and dark mode on 7 pages |

The UI review found and fixed five problems the other checks had missed:
- "New client" inside the invoice editor saved the invoice instead of creating the client (the dialog's submit bubbled to the editor's form through the React portal).
- The whole app showed a serif fallback font instead of Geist.
- Invoice amounts wrapped mid-number on phones.
- The dashboard's getting-started steps squeezed into a one-word column on phones, and placeholder text in the invoice preview failed contrast.

The PDFs were checked by extracting their text and page sizes. They haven't been inspected visually.

## Not done or not verified

- **Deployment (IP-252):** not deployed. It needs the code pushed to GitHub and a Vercel project; the steps are in the README.
- **CI:** the workflow exists but hasn't run, because nothing has been pushed yet.
- **Password reset (IP-122):** tested with a real inbox on 18 November. A reset link now always opens "Choose a new password", even if Supabase sends it to the Site URL because the redirect URL isn't on its allow list.
- **Still needs a person:** a real Google sign-in once a Google OAuth client is configured (IP-123), and opening a downloaded PDF to check it looks right.
- **Supabase dashboard settings** (README, step 4): redirect URLs, the two email templates, and optionally Google.

## Known limitations

- Email needs a Resend account, a verified sending domain, and `RESEND_API_KEY` / `EMAIL_FROM`. Only the rejected-send path has been tested (with an invalid key); a real send hasn't been tried yet. The history shows whether Resend *accepted* an email, not whether it was delivered or opened.
- Full payments only; no partial payments.
- Overdue uses Lagos time for every user.
- Totals are recalculated on every app save, but a user calling the database API directly could store inconsistent totals on their own drafts. Issued invoices are locked, and other users are unaffected.
- Deleting a draft frees nothing: its invoice number isn't reused, so numbering can have gaps.
- The free Supabase plan limits auth emails to a few per hour; configure custom SMTP before launch.

## Environment notes

On the development laptop (2 cores, often at 100% CPU), the first request to each page can take many seconds. The end-to-end test uses generous timeouts for this reason. They don't slow down passing runs.
