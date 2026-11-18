"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { FormSection } from "@/components/forms/form-section";
import { SelectField } from "@/components/forms/select-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextareaField } from "@/components/forms/textarea-field";
import { CURRENCIES } from "@/lib/currencies";
import type { FormState } from "@/lib/validation/form-state";

import { updateSettings } from "./actions";

const CURRENCY_OPTIONS = CURRENCIES.map((c) => ({ value: c.code, label: `${c.code} · ${c.name}` }));

function previewNumber(prefix: string, next: string) {
  const n = /^\d+$/.test(next) ? next.replace(/^0+(?=\d)/, "") : "1";
  return `${prefix.trim()}${n.padStart(3, "0")}`;
}

export function SettingsForm({ defaults }: { defaults: Record<string, string> }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateSettings, {});
  const v = state.values ?? defaults;
  const e = state.fieldErrors ?? {};
  const [prefix, setPrefix] = useState(v.invoice_prefix);
  const [nextNumber, setNextNumber] = useState(v.next_invoice_number);

  useEffect(() => {
    if (state.success) toast.success(state.success);
  }, [state]);

  return (
    <form action={action} className="grid gap-6" noValidate>
      {state.error && <FormMessage state={{ error: state.error }} />}

      <FormSection title="Business details" description="Shown at the top of every invoice.">
        <Field label="Business name" name="business_name" required maxLength={120} defaultValue={v.business_name} errors={e.business_name} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" name="email" type="email" defaultValue={v.email} errors={e.email} />
          <Field label="Phone" name="phone" type="tel" defaultValue={v.phone} errors={e.phone} />
          <Field label="Website" name="website" placeholder="example.com" defaultValue={v.website} errors={e.website} />
          <Field label="Tax ID" name="tax_id" hint="VAT, TIN or similar. Optional." defaultValue={v.tax_id} errors={e.tax_id} />
        </div>
      </FormSection>

      <FormSection title="Address">
        <Field label="Address line 1" name="address_line1" autoComplete="address-line1" defaultValue={v.address_line1} errors={e.address_line1} />
        <Field label="Address line 2" name="address_line2" autoComplete="address-line2" defaultValue={v.address_line2} errors={e.address_line2} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="City" name="city" autoComplete="address-level2" defaultValue={v.city} errors={e.city} />
          <Field label="State or region" name="state" autoComplete="address-level1" defaultValue={v.state} errors={e.state} />
          <Field label="Postal code" name="postal_code" autoComplete="postal-code" defaultValue={v.postal_code} errors={e.postal_code} />
          <Field label="Country" name="country" autoComplete="country-name" defaultValue={v.country} errors={e.country} />
        </div>
      </FormSection>

      <FormSection title="Invoice defaults" description="Used to prefill new invoices. You can change them on each invoice.">
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Currency" name="currency" defaultValue={v.currency} options={CURRENCY_OPTIONS} errors={e.currency} />
          <Field
            label="Payment terms (days)"
            name="payment_terms_days"
            inputMode="numeric"
            defaultValue={v.payment_terms_days}
            errors={e.payment_terms_days}
            hint="Due date = issue date + this many days."
          />
          <Field
            label="Default tax rate (%)"
            name="default_tax_rate_bps"
            inputMode="decimal"
            defaultValue={v.default_tax_rate_bps}
            errors={e.default_tax_rate_bps}
            hint="For example 7.5 for VAT. Use 0 if you don't charge tax."
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Invoice number prefix"
            name="invoice_prefix"
            maxLength={12}
            value={prefix}
            onChange={(ev) => setPrefix(ev.target.value)}
            errors={e.invoice_prefix}
          />
          <Field
            label="Next invoice number"
            name="next_invoice_number"
            inputMode="numeric"
            value={nextNumber}
            onChange={(ev) => setNextNumber(ev.target.value)}
            errors={e.next_invoice_number}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Your next invoice will be numbered{" "}
          <span className="font-medium text-foreground tabular-nums">{previewNumber(prefix, nextNumber)}</span>. Numbers
          already used are skipped automatically.
        </p>
      </FormSection>

      <FormSection title="Payment and notes" description="Printed at the bottom of new invoices.">
        <TextareaField
          label="Payment instructions"
          name="default_payment_instructions"
          rows={3}
          maxLength={2000}
          placeholder="Bank name, account name and account number"
          defaultValue={v.default_payment_instructions}
          errors={e.default_payment_instructions}
          hint="Don't include card details. InvoicePro never collects them."
        />
        <TextareaField label="Notes" name="default_notes" rows={2} maxLength={2000} placeholder="Thank you for your business." defaultValue={v.default_notes} errors={e.default_notes} />
        <TextareaField label="Terms" name="default_terms" rows={2} maxLength={2000} defaultValue={v.default_terms} errors={e.default_terms} />
      </FormSection>

      <div className="sticky bottom-0 -mx-4 flex justify-end border-t bg-background/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        <SubmitButton pending={pending} pendingLabel="Saving…" className="w-auto">
          Save settings
        </SubmitButton>
      </div>
    </form>
  );
}
