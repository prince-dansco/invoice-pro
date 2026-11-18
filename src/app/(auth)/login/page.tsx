import type { Metadata } from "next";
import Link from "next/link";

import { AuthHeading } from "@/components/auth/auth-heading";
import { GoogleButton, OrDivider } from "@/components/auth/google-button";
import { isGoogleEnabled } from "@/lib/auth/providers";
import { safeNext } from "@/lib/auth/redirect";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  link: "That link is invalid or has expired. Sign in, or request a new link.",
  expired: "That link has expired. Sign in, or sign up again to get a new one.",
  reset_link: "That password reset link has expired. Request a new one.",
  oauth: "Google sign-in didn't work. Try again or use your email and password.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const safe = next ? safeNext(next) : undefined;
  const google = await isGoogleEnabled();

  return (
    <>
      <AuthHeading title="Sign in" description="Welcome back. Sign in to manage your invoices." />
      <div className="grid gap-4">
        {google && (
          <>
            <GoogleButton next={safe} />
            <OrDivider />
          </>
        )}
        <LoginForm
          next={safe}
          initialState={
            error === "confirmed"
              ? { success: "Your email is confirmed. Sign in to finish setting up your account." }
              : { error: error ? ERRORS[error] : undefined }
          }
        />
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        New to InvoicePro?{" "}
        <Link href="/signup" className="font-medium text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </>
  );
}
