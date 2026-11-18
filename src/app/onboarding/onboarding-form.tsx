"use client";

import { useActionState } from "react";

import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { SelectField } from "@/components/forms/select-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { CURRENCIES } from "@/lib/currencies";
import type { FormState } from "@/lib/validation/form-state";

import { completeOnboarding } from "./actions";

const CURRENCY_OPTIONS = CURRENCIES.map((c) => ({ value: c.code, label: `${c.code} · ${c.name}` }));

export function OnboardingForm({ defaults }: { defaults: Record<string, string> }) {
  const [state, action, pending] = useActionState<FormState, FormData>(completeOnboarding, {});
  const v = state.values ?? defaults;
  const e = state.fieldErrors ?? {};

  return (
    <form action={action} className="grid gap-5" noValidate>
      <FormMessage state={state} />
      <Field
        label="Business name"
        name="business_name"
        required
        maxLength={120}
        autoComplete="organization"
        defaultValue={v.business_name}
        errors={e.business_name}
        hint="Shown at the top of every invoice. Use your own name if you freelance."
      />
      <SelectField
        label="Default currency"
        name="currency"
        defaultValue={v.currency}
        options={CURRENCY_OPTIONS}
        errors={e.currency}
      />
      <fieldset className="grid gap-4">
        <legend className="mb-1 text-sm font-medium">
          Contact details <span className="font-normal text-muted-foreground">(optional)</span>
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" name="email" type="email" autoComplete="email" defaultValue={v.email} errors={e.email} />
          <Field label="Phone" name="phone" type="tel" autoComplete="tel" defaultValue={v.phone} errors={e.phone} />
        </div>
        <Field
          label="Street address"
          name="address_line1"
          autoComplete="address-line1"
          defaultValue={v.address_line1}
          errors={e.address_line1}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="City" name="city" autoComplete="address-level2" defaultValue={v.city} errors={e.city} />
          <Field label="Country" name="country" autoComplete="country-name" defaultValue={v.country} errors={e.country} />
        </div>
      </fieldset>
      <SubmitButton pending={pending} pendingLabel="Saving…">
        Save and continue
      </SubmitButton>
    </form>
  );
}
