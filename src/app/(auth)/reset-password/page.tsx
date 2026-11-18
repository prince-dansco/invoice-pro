import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthHeading } from "@/components/auth/auth-heading";
import { getUser } from "@/lib/auth/session";

import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Choose a new password" };

// Reached from the reset email: the callback route has already signed the user in.
export default async function ResetPasswordPage() {
  const user = await getUser();
  if (!user) redirect("/login?error=reset_link");

  return (
    <>
      <AuthHeading title="Choose a new password" description={`For ${user.email}`} />
      <ResetPasswordForm />
    </>
  );
}
