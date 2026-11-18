import type { Metadata } from "next";
import Link from "next/link";

import { AuthHeading } from "@/components/auth/auth-heading";
import { GoogleButton, OrDivider } from "@/components/auth/google-button";
import { isGoogleEnabled } from "@/lib/auth/providers";

import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignupPage() {
  const google = await isGoogleEnabled();

  return (
    <>
      <AuthHeading title="Create your account" description="Start sending professional invoices in minutes." />
      <div className="grid gap-4">
        {google && (
          <>
            <GoogleButton next="/onboarding" />
            <OrDivider />
          </>
        )}
        <SignupForm />
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
