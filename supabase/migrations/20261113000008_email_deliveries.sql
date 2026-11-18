-- IP-223: a record of every attempt to email an invoice, successful or not.
-- Rows are written by the app server as the signed-in user; they're an audit
-- trail, so users can read and add their own but not change or delete them.

create table public.invoice_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  recipient text not null check (char_length(recipient) between 3 and 254),
  subject text not null check (char_length(subject) <= 200),
  status text not null check (status in ('sent', 'failed')),
  -- The email provider's message ID when it accepted the email.
  provider_id text check (char_length(provider_id) <= 200),
  -- A short, user-safe reason when it failed. Never raw provider responses.
  error text check (char_length(error) <= 300),
  created_at timestamptz not null default now(),
  constraint invoice_email_deliveries_invoice_fkey
    foreign key (invoice_id, user_id) references public.invoices (id, user_id) on delete cascade,
  constraint invoice_email_deliveries_result check (
    (status = 'sent' and provider_id is not null) or (status = 'failed' and error is not null)
  )
);

create index invoice_email_deliveries_invoice_idx on public.invoice_email_deliveries (invoice_id, created_at desc);
-- Used by the sending rate limit.
create index invoice_email_deliveries_user_idx on public.invoice_email_deliveries (user_id, created_at desc);

alter table public.invoice_email_deliveries enable row level security;
revoke all on public.invoice_email_deliveries from anon;
-- Append-only for users: no update or delete grants or policies.
revoke update, delete, truncate on public.invoice_email_deliveries from authenticated;

create policy "Users can view their own email deliveries"
  on public.invoice_email_deliveries for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can record their own email deliveries"
  on public.invoice_email_deliveries for insert to authenticated
  with check ((select auth.uid()) = user_id);

notify pgrst, 'reload schema';
