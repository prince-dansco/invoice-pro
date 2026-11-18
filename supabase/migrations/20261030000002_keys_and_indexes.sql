-- IP-113: foreign keys, unique constraints and indexes.

-- Composite keys let child rows reference (id, user_id), so an invoice can only
-- point at the same user's client, and an item at the same user's invoice.
alter table public.clients add constraint clients_id_user_id_key unique (id, user_id);
alter table public.invoices add constraint invoices_id_user_id_key unique (id, user_id);

-- Clients are soft-deleted, so this only fires when an account is removed.
-- The invoice keeps its client snapshot either way.
alter table public.invoices
  add constraint invoices_client_fkey
  foreign key (client_id, user_id) references public.clients (id, user_id)
  on delete set null (client_id);

alter table public.invoice_items
  add constraint invoice_items_invoice_fkey
  foreign key (invoice_id, user_id) references public.invoices (id, user_id)
  on delete cascade;

alter table public.invoices
  add constraint invoices_user_id_invoice_number_key unique (user_id, invoice_number);

create index clients_user_id_idx on public.clients (user_id) where deleted_at is null;
create index invoices_user_id_idx on public.invoices (user_id);
create index invoices_user_id_status_idx on public.invoices (user_id, status);
create index invoices_user_id_due_date_idx on public.invoices (user_id, due_date);
create index invoices_client_id_idx on public.invoices (client_id);
create index invoice_items_invoice_id_idx on public.invoice_items (invoice_id, position);
create index invoice_items_user_id_idx on public.invoice_items (user_id);
