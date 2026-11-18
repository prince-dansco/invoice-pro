"use client";

import { useActionState, useEffect, useState } from "react";
import { z } from "zod";

import { saveClient, type ClientFormState, type SavedClient } from "@/app/(app)/clients/actions";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextareaField } from "@/components/forms/textarea-field";
import { cn } from "@/lib/utils";
import { CLIENT_FIELDS, clientSchema } from "@/lib/validation/client";

type Props = {
  /** Existing client to edit; omit to create a new one. */
  client?: { id: string } & Partial<Record<(typeof CLIENT_FIELDS)[number], string | null>>;
  onSaved?: (client: SavedClient, message: string) => void;
  /** Compact layout for the inline dialog: hides address and notes behind a toggle. */
  compact?: boolean;
  submitLabel?: string;
};

export function ClientForm({ client, onSaved, compact, submitLabel = "Save client" }: Props) {
  const [state, action, pending] = useActionState<ClientFormState, FormData>(saveClient, {});
  const [clientErrors, setClientErrors] = useState<Record<string, string[] | undefined> | null>(null);
  const [showMore, setShowMore] = useState(!compact);

  useEffect(() => {
    if (state.client && state.success) onSaved?.(state.client, state.success);
    // onSaved is a callback prop; only react to new results.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const v: Record<string, string> =
    state.values ?? Object.fromEntries(CLIENT_FIELDS.map((k) => [k, client?.[k] ?? ""]));
  const e = clientErrors ?? state.fieldErrors ?? {};

  function validate(ev: React.FormEvent<HTMLFormElement>) {
    // React bubbles events through portals, so inside the invoice editor this
    // submit would otherwise reach the editor's own form and save the invoice.
    ev.stopPropagation();
    const data = Object.fromEntries(new FormData(ev.currentTarget));
    const parsed = clientSchema.safeParse(data);
    if (parsed.success) {
      setClientErrors(null);
      return;
    }
    ev.preventDefault();
    const errors = z.flattenError(parsed.error).fieldErrors;
    setClientErrors(errors);
    if (Object.keys(errors).some((k) => !["name", "company", "email", "phone"].includes(k))) setShowMore(true);
  }

  return (
    <form action={action} onSubmit={validate} className="grid gap-4" noValidate>
      {state.error && <FormMessage state={{ error: state.error }} />}
      {client && <input type="hidden" name="id" value={client.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" name="name" required maxLength={120} autoComplete="off" defaultValue={v.name} errors={e.name} />
        <Field label="Company" name="company" maxLength={120} autoComplete="off" defaultValue={v.company} errors={e.company} />
        <Field label="Email" name="email" type="email" autoComplete="off" defaultValue={v.email} errors={e.email} />
        <Field label="Phone" name="phone" type="tel" autoComplete="off" defaultValue={v.phone} errors={e.phone} />
      </div>

      {compact && !showMore && (
        <button type="button" onClick={() => setShowMore(true)} className="justify-self-start text-sm font-medium text-primary hover:underline">
          Add address and notes
        </button>
      )}

      {/* Kept mounted when hidden so typed values are still submitted. */}
      <div className={cn("grid gap-4", !showMore && "hidden")}>
        <Field label="Address line 1" name="address_line1" defaultValue={v.address_line1} errors={e.address_line1} />
        <Field label="Address line 2" name="address_line2" defaultValue={v.address_line2} errors={e.address_line2} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="City" name="city" defaultValue={v.city} errors={e.city} />
          <Field label="State or region" name="state" defaultValue={v.state} errors={e.state} />
          <Field label="Postal code" name="postal_code" defaultValue={v.postal_code} errors={e.postal_code} />
          <Field label="Country" name="country" defaultValue={v.country} errors={e.country} />
        </div>
        <Field label="Tax ID" name="tax_id" defaultValue={v.tax_id} errors={e.tax_id} />
        <TextareaField label="Notes" name="notes" rows={2} maxLength={2000} hint="Private. Not shown on invoices." defaultValue={v.notes} errors={e.notes} />
      </div>

      <SubmitButton pending={pending} pendingLabel="Saving…" className="sm:w-auto sm:justify-self-end">
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
