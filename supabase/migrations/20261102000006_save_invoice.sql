-- IP-164: save an invoice and its line items in one transaction, so a failed
-- save can never leave an invoice with missing or half-replaced items.
--
-- Runs as the calling user (security invoker), so row-level security and the
-- composite (invoice_id, user_id) foreign key still apply. Only the columns
-- listed here can be written; anything else in p_invoice is ignored. Totals
-- are calculated by the app server, never taken from the browser.
-- Only drafts can be edited; issued invoices are handled by IP-202.

create or replace function public.save_invoice(p_id uuid, p_invoice jsonb, p_items jsonb)
returns table (saved_id uuid, saved_number text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  r public.invoices;
begin
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) > 200 then
    raise exception 'Invalid line items' using errcode = '22023';
  end if;

  r := jsonb_populate_record(null::public.invoices, p_invoice);

  if p_id is null then
    insert into public.invoices (
      client_id, issue_date, due_date, currency, reference,
      discount_type, discount_value, tax_rate_bps,
      subtotal_minor, discount_minor, taxable_minor, tax_minor, total_minor,
      notes, terms, payment_instructions
    ) values (
      r.client_id, r.issue_date, r.due_date, r.currency, r.reference,
      r.discount_type, r.discount_value, r.tax_rate_bps,
      r.subtotal_minor, r.discount_minor, r.taxable_minor, r.tax_minor, r.total_minor,
      r.notes, r.terms, r.payment_instructions
    )
    returning id into v_id;
  else
    update public.invoices i set
      client_id = r.client_id,
      issue_date = r.issue_date,
      due_date = r.due_date,
      currency = r.currency,
      reference = r.reference,
      discount_type = r.discount_type,
      discount_value = r.discount_value,
      tax_rate_bps = r.tax_rate_bps,
      subtotal_minor = r.subtotal_minor,
      discount_minor = r.discount_minor,
      taxable_minor = r.taxable_minor,
      tax_minor = r.tax_minor,
      total_minor = r.total_minor,
      notes = r.notes,
      terms = r.terms,
      payment_instructions = r.payment_instructions
    where i.id = p_id and i.status = 'draft'
    returning i.id into v_id;

    if v_id is null then
      raise exception 'Invoice not found or no longer a draft' using errcode = 'P0002';
    end if;

    delete from public.invoice_items it where it.invoice_id = v_id;
  end if;

  insert into public.invoice_items (invoice_id, position, description, quantity, unit_price_minor, line_total_minor)
  select
    v_id,
    (e.ord - 1)::integer,
    coalesce(e.item ->> 'description', ''),
    (e.item ->> 'quantity')::numeric(12, 3),
    (e.item ->> 'unit_price_minor')::bigint,
    (e.item ->> 'line_total_minor')::bigint
  from jsonb_array_elements(p_items) with ordinality as e(item, ord);

  return query select i.id, i.invoice_number from public.invoices i where i.id = v_id;
end;
$$;

revoke execute on function public.save_invoice(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_invoice(uuid, jsonb, jsonb) to authenticated;
