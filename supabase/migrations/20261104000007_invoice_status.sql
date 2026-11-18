-- IP-201 to IP-204: invoice status changes and the edit lock.
--
-- Lifecycle: draft -> sent (issue) -> paid (mark as paid)
--            sent -> draft (reopen; keeps the number)
--            paid -> sent  (undo a payment recorded by mistake)
-- "Overdue" isn't stored: it's a sent invoice past its due date, worked out
-- when displayed so it can never be stale.
--
-- The rules are enforced here, not only in the app, so they also hold for
-- requests made straight to the database API.

-- 1. Issued invoices can't be silently overwritten.
create or replace function public.guard_invoice_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     and (old.status, new.status) not in (('draft', 'sent'), ('sent', 'paid'), ('paid', 'sent'), ('sent', 'draft')) then
    raise exception 'invalid_status_change' using errcode = 'P0001',
      detail = format('Can''t change an invoice from %s to %s.', old.status, new.status);
  end if;

  if old.status <> 'draft' and (
    new.client_id, new.issue_date, new.due_date, new.currency, new.reference,
    new.discount_type, new.discount_value, new.tax_rate_bps,
    new.subtotal_minor, new.discount_minor, new.taxable_minor, new.tax_minor, new.total_minor,
    new.notes, new.terms, new.payment_instructions, new.business_snapshot, new.client_snapshot
  ) is distinct from (
    old.client_id, old.issue_date, old.due_date, old.currency, old.reference,
    old.discount_type, old.discount_value, old.tax_rate_bps,
    old.subtotal_minor, old.discount_minor, old.taxable_minor, old.tax_minor, old.total_minor,
    old.notes, old.terms, old.payment_instructions, old.business_snapshot, old.client_snapshot
  ) then
    raise exception 'invoice_locked' using errcode = 'P0001',
      detail = 'Issued invoices can''t be edited. Reopen it as a draft first.';
  end if;

  if new.status <> 'draft' and (new.business_snapshot is null or new.client_snapshot is null) then
    raise exception 'missing_snapshot' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger invoices_guard_update
  before update on public.invoices
  for each row execute function public.guard_invoice_update();

-- Line items of an issued invoice are frozen too. When an invoice is deleted,
-- its items cascade after the parent row is gone, so that still works.
create or replace function public.guard_invoice_items()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_invoice uuid := coalesce(new.invoice_id, old.invoice_id);
begin
  if exists (select 1 from public.invoices i where i.id = v_invoice and i.status <> 'draft') then
    raise exception 'invoice_locked' using errcode = 'P0001',
      detail = 'Issued invoices can''t be edited. Reopen it as a draft first.';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger invoice_items_guard
  before insert or update or delete on public.invoice_items
  for each row execute function public.guard_invoice_items();

-- Only drafts can be deleted; issued invoices are part of the user's records.
drop policy "Users can delete their own invoices" on public.invoices;
create policy "Users can delete their own draft invoices"
  on public.invoices for delete to authenticated
  using ((select auth.uid()) = user_id and status = 'draft');

-- 2. Issue: snapshot the business and client, record issued_at, lock.
create or replace function public.issue_invoice(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v public.invoices;
begin
  select * into v from public.invoices i where i.id = p_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if v.status <> 'draft' then raise exception 'not_draft' using errcode = 'P0001'; end if;
  if v.client_id is null then raise exception 'no_client' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.invoice_items it where it.invoice_id = p_id and btrim(it.description) <> '') then
    raise exception 'no_items' using errcode = 'P0001';
  end if;

  update public.invoices i set
    status = 'sent',
    issued_at = now(),
    business_snapshot = (
      select jsonb_build_object(
        'name', p.business_name, 'email', p.email, 'phone', p.phone, 'website', p.website,
        'address_line1', p.address_line1, 'address_line2', p.address_line2, 'city', p.city,
        'state', p.state, 'postal_code', p.postal_code, 'country', p.country, 'tax_id', p.tax_id
      )
      from public.profiles p where p.id = v.user_id
    ),
    client_snapshot = (
      select jsonb_build_object(
        'name', c.name, 'company', c.company, 'email', c.email, 'phone', c.phone,
        'address_line1', c.address_line1, 'address_line2', c.address_line2, 'city', c.city,
        'state', c.state, 'postal_code', c.postal_code, 'country', c.country, 'tax_id', c.tax_id
      )
      from public.clients c where c.id = v.client_id
    )
  where i.id = p_id;
end;
$$;

-- 3. Record full payment on a sent invoice.
create or replace function public.mark_invoice_paid(p_id uuid, p_paid_on date)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_paid_on is null or p_paid_on > current_date + 1 then
    raise exception 'invalid_paid_date' using errcode = 'P0001';
  end if;
  update public.invoices i set status = 'paid', paid_at = p_paid_on::timestamptz
   where i.id = p_id and i.status = 'sent';
  if not found then raise exception 'not_sent' using errcode = 'P0001'; end if;
end;
$$;

-- 4. Undo a payment recorded by mistake.
create or replace function public.mark_invoice_unpaid(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.invoices i set status = 'sent', paid_at = null
   where i.id = p_id and i.status = 'paid';
  if not found then raise exception 'not_paid' using errcode = 'P0001'; end if;
end;
$$;

-- 5. Reopen a sent invoice for editing. The number is kept.
create or replace function public.reopen_invoice(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.invoices i set status = 'draft', issued_at = null
   where i.id = p_id and i.status = 'sent';
  if not found then raise exception 'not_sent' using errcode = 'P0001'; end if;
end;
$$;

revoke execute on function public.guard_invoice_update() from public, anon, authenticated;
revoke execute on function public.guard_invoice_items() from public, anon, authenticated;
revoke execute on function public.issue_invoice(uuid) from public, anon;
revoke execute on function public.mark_invoice_paid(uuid, date) from public, anon;
revoke execute on function public.mark_invoice_unpaid(uuid) from public, anon;
revoke execute on function public.reopen_invoice(uuid) from public, anon;
grant execute on function public.issue_invoice(uuid) to authenticated;
grant execute on function public.mark_invoice_paid(uuid, date) to authenticated;
grant execute on function public.mark_invoice_unpaid(uuid) to authenticated;
grant execute on function public.reopen_invoice(uuid) to authenticated;

notify pgrst, 'reload schema';
