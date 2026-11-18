-- IP-114: atomic invoice numbers, generated in the database.
--
-- The counter lives on the user's profile. Updating that row takes a row lock,
-- so concurrent inserts for the same user queue behind each other and can never
-- receive the same number. Numbers are assigned when the invoice row is
-- created (drafts included), and any number sent by the client is ignored.

create or replace function public.assign_invoice_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prefix text;
  v_next integer;
  v_candidate text;
begin
  loop
    update public.profiles
       set next_invoice_number = next_invoice_number + 1
     where id = new.user_id
    returning invoice_prefix, next_invoice_number - 1 into v_prefix, v_next;

    if not found then
      raise exception 'No profile for user %', new.user_id;
    end if;

    -- Pad to three digits without truncating longer numbers: INV-001, INV-1234.
    v_candidate := v_prefix || lpad(v_next::text, greatest(3, length(v_next::text)), '0');

    -- Skip numbers already taken, e.g. after the user lowers the start number.
    exit when not exists (
      select 1 from public.invoices
       where user_id = new.user_id and invoice_number = v_candidate
    );
  end loop;

  new.invoice_number := v_candidate;
  return new;
end;
$$;

create trigger invoices_assign_number
  before insert on public.invoices
  for each row execute function public.assign_invoice_number();

-- Numbers are permanent once assigned.
create or replace function public.prevent_invoice_number_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.invoice_number is distinct from old.invoice_number then
    raise exception 'Invoice numbers cannot be changed';
  end if;
  return new;
end;
$$;

create trigger invoices_lock_number
  before update on public.invoices
  for each row execute function public.prevent_invoice_number_change();

-- Trigger functions shouldn't be callable through the API.
revoke execute on function public.assign_invoice_number() from public, anon, authenticated;
revoke execute on function public.prevent_invoice_number_change() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
