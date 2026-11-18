"use client";

import { useActionState } from "react";

import { requestPasswordReset } from "@/app/auth/actions";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import type { FormState } from "@/lib/validation/form-state";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(requestPasswordReset, {});

  if (state.success) return <FormMessage state={state} />;

  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        errors={state.fieldErrors?.email}
      />
      <SubmitButton pending={pending} pendingLabel="Sending link…">
        Send reset link
      </SubmitButton>
    </form>
  );
}
