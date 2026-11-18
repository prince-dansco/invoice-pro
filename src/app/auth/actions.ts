"use server";

import { redirect } from "next/navigation";

import { getOrigin } from "@/lib/auth/origin";
import { safeNext } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "@/lib/validation/auth";
import { formValues, invalid, type FormState } from "@/lib/validation/form-state";

const GENERIC_ERROR = "Something went wrong. Please try again.";

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, ["email"]);
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, values);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "email_not_confirmed") {
      return { error: "Confirm your email address first. Check your inbox for the link.", values };
    }
    if (error.code === "invalid_credentials") {
      return { error: "That email and password don't match. Try again or reset your password.", values };
    }
    if (error.status === 429) return { error: "Too many attempts. Wait a minute and try again.", values };
    return { error: GENERIC_ERROR, values };
  }

  redirect(safeNext(formData.get("next")));
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, ["email"]);
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, values);

  const supabase = await createClient();
  const origin = await getOrigin();
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: `${origin}/auth/callback?next=/onboarding` },
  });
  if (error) {
    if (error.code === "weak_password") {
      return { fieldErrors: { password: [error.message] }, values };
    }
    if (error.status === 429) return { error: "Too many attempts. Wait a minute and try again.", values };
    return { error: GENERIC_ERROR, values };
  }

  // With email confirmation off, Supabase signs the user in straight away.
  if (data.session) redirect("/onboarding");

  // Supabase returns the same response for new and existing addresses, so this
  // message doesn't reveal whether an account exists.
  return { success: `We've sent a confirmation link to ${parsed.data.email}. Open it to finish signing up.` };
}

export async function signInWithGoogle(formData: FormData) {
  const supabase = await createClient();
  const origin = await getOrigin();
  const next = safeNext(formData.get("next"));
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) redirect("/login?error=oauth");
  redirect(data.url);
}

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData, ["email"]);
  const parsed = forgotPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, values);

  const supabase = await createClient();
  const origin = await getOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });
  if (error?.status === 429) return { error: "Too many requests. Wait a minute and try again.", values };

  // Same message whether or not the account exists.
  return { success: `If an account exists for ${parsed.data.email}, we've sent a link to reset the password.` };
}

export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your reset link has expired. Request a new one." };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") {
      return { fieldErrors: { password: ["Choose a password you haven't used before."] } };
    }
    if (error.code === "weak_password") return { fieldErrors: { password: [error.message] } };
    return { error: GENERIC_ERROR };
  }

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
