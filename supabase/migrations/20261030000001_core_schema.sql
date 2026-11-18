-- IP-111: core tables.
-- Money is stored as integer minor units (kobo, cents). Rates are basis points
-- (750 = 7.5%). Invoices keep JSON snapshots of the business and client so
-- history doesn't change when those records are edited or deleted.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- One row per user, created automatically on sign-up.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  business_name text not null default '' check (char_length(business_name) <= 120),
  email text check (char_length(email) <= 254),
  phone text check (char_length(phone) <= 40),
  website text check (char_length(website) <= 200),
  address_line1 text check (char_length(address_line1) <= 200),
  address_line2 text check (char_length(address_line2) <= 200),
  city text check (char_length(city) <= 100),
  state text check (char_length(state) <= 100),
  postal_code text check (char_length(postal_code) <= 20),
  country text check (char_length(country) <= 100),
  tax_id text check (char_length(tax_id) <= 60),
  logo_path text check (char_length(logo_path) <= 300),
  currency char(3) not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  payment_terms_days integer not null default 14 check (payment_terms_days between 0 and 365),
  invoice_prefix text not null default 'INV-' check (char_length(invoice_prefix) <= 12),
  next_invoice_number integer not null default 1 check (next_invoice_number between 1 and 999999999),
  default_tax_rate_bps integer not null default 0 check (default_tax_rate_bps between 0 and 10000),
  default_notes text check (char_length(default_notes) <= 2000),
  default_terms text check (char_length(default_terms) <= 2000),
  default_payment_instructions text check (char_length(default_payment_instructions) <= 2000),
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  company text check (char_length(company) <= 120),
  email text check (char_length(email) <= 254),
  phone text check (char_length(phone) <= 40),
  address_line1 text check (char_length(address_line1) <= 200),
  address_line2 text check (char_length(address_line2) <= 200),
  city text check (char_length(city) <= 100),
  state text check (char_length(state) <= 100),
  postal_code text check (char_length(postal_code) <= 20),
  country text check (char_length(country) <= 100),
  tax_id text check (char_length(tax_id) <= 60),
  notes text check (char_length(notes) <= 2000),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id uuid,
  -- Assigned by the trigger in the invoice numbering migration.
  invoice_number text not null check (char_length(invoice_number) between 1 and 40),
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid')),
  issue_date date not null default current_date,
  due_date date,
  currency char(3) not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  reference text check (char_length(reference) <= 100),
  discount_type text check (discount_type in ('percent', 'fixed')),
  -- Percent discounts are basis points; fixed discounts are minor units.
  discount_value bigint not null default 0 check (discount_value >= 0),
  tax_rate_bps integer not null default 0 check (tax_rate_bps between 0 and 10000),
  subtotal_minor bigint not null default 0 check (subtotal_minor >= 0),
  discount_minor bigint not null default 0 check (discount_minor >= 0),
  taxable_minor bigint not null default 0 check (taxable_minor >= 0),
  tax_minor bigint not null default 0 check (tax_minor >= 0),
  total_minor bigint not null default 0 check (total_minor >= 0),
  notes text check (char_length(notes) <= 2000),
  terms text check (char_length(terms) <= 2000),
  payment_instructions text check (char_length(payment_instructions) <= 2000),
  business_snapshot jsonb,
  client_snapshot jsonb,
  issued_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoices_due_after_issue check (due_date is null or due_date >= issue_date),
  constraint invoices_percent_discount_max check (discount_type is distinct from 'percent' or discount_value <= 10000),
  constraint invoices_paid_has_paid_at check (status <> 'paid' or paid_at is not null)
);

create trigger invoices_set_updated_at
  before update on public.invoices
  for each row execute function public.set_updated_at();

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  position integer not null default 0 check (position >= 0),
  description text not null default '' check (char_length(description) <= 1000),
  quantity numeric(12, 3) not null default 1 check (quantity >= 0),
  unit_price_minor bigint not null default 0 check (unit_price_minor >= 0),
  line_total_minor bigint not null default 0 check (line_total_minor >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger invoice_items_set_updated_at
  before update on public.invoice_items
  for each row execute function public.set_updated_at();
