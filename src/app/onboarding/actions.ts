"use server";

import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formValues, invalid, type FormState } from "@/lib/validation/form-state";
import { ONBOARDING_FIELDS, onboardingSchema } from "@/lib/validation/profile";

export async function completeOnboarding(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const values = formValues(formData, ONBOARDING_FIELDS);
  const parsed = onboardingSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error, values);

  // Only the parsed, whitelisted fields are written.
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ ...parsed.data, onboarded_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) return { error: "We couldn't save your details. Please try again.", values };

  redirect("/dashboard");
}

/** Business details can be added later in Settings, so this step is skippable. */
export async function skipOnboarding() {
  const user = await requireUser();
  const supabase = await createClient();
  await supabase.from("profiles").update({ onboarded_at: new Date().toISOString() }).eq("id", user.id);
  redirect("/dashboard");
}
