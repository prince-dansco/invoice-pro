"use client";

import { useActionState } from "react";
import Link from "next/link";

import { signIn } from "@/app/auth/actions";
import { Field } from "@/components/forms/field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import type { FormState } from "@/lib/validation/form-state";

export function LoginForm({ next, initialState = {} }: { next?: string; initialState?: FormState }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signIn, initialState);

  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      {next && <input type="hidden" name="next" value={next} />}
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        errors={state.fieldErrors?.email}
      />
      <div className="grid gap-1.5">
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          errors={state.fieldErrors?.password}
        />
        <Link href="/forgot-password" className="justify-self-end text-xs text-primary hover:underline">
          Forgot password?
        </Link>
      </div>
      <SubmitButton pending={pending} pendingLabel="Signing in…">
        Sign in
      </SubmitButton>
    </form>
  );
}
