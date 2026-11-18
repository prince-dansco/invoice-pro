-- IP-112: row-level security. Signed-in users can only touch their own rows;
-- anonymous visitors get nothing.

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;

revoke all on public.profiles, public.clients, public.invoices, public.invoice_items from anon;

-- Profiles are created by the sign-up trigger and removed with the auth user,
-- so users can only read and update their own.
create policy "Users can view their own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- (select auth.uid()) is evaluated once per statement instead of once per row.
create policy "Users can view their own clients"
  on public.clients for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can create their own clients"
  on public.clients for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users can update their own clients"
  on public.clients for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users can delete their own clients"
  on public.clients for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can view their own invoices"
  on public.invoices for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can create their own invoices"
  on public.invoices for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users can update their own invoices"
  on public.invoices for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users can delete their own invoices"
  on public.invoices for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can view their own invoice items"
  on public.invoice_items for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can create their own invoice items"
  on public.invoice_items for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users can update their own invoice items"
  on public.invoice_items for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users can delete their own invoice items"
  on public.invoice_items for delete to authenticated
  using ((select auth.uid()) = user_id);
