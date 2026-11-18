import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Brand } from "@/components/app-shell/brand";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { getProfile } from "@/lib/profile";

import { skipOnboarding } from "./actions";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Set up your business" };

export default async function OnboardingPage() {
  const user = await requireUser();
  const profile = await getProfile();
  if (profile?.onboarded_at) redirect("/dashboard");

  const defaults = {
    business_name: profile?.business_name ?? "",
    currency: profile?.currency ?? "USD",
    email: profile?.email ?? user.email ?? "",
    phone: profile?.phone ?? "",
    address_line1: profile?.address_line1 ?? "",
    city: profile?.city ?? "",
    country: profile?.country ?? "",
  };

  return (
    <main className="flex min-h-dvh flex-col items-center gap-8 bg-muted/40 px-4 py-10">
      <Brand href="/" />
      <div className="w-full max-w-lg rounded-xl border bg-card p-6 shadow-sm sm:p-8">
        <div className="mb-6 grid gap-1">
          <h1 className="text-xl font-semibold tracking-tight">Set up your business</h1>
          <p className="text-sm text-muted-foreground">
            These details appear on your invoices. You can change them any time in Settings.
          </p>
        </div>
        <OnboardingForm defaults={defaults} />
        <form action={skipOnboarding} className="mt-3">
          <Button type="submit" variant="ghost" size="lg" className="w-full text-muted-foreground">
            Skip for now
          </Button>
        </form>
      </div>
    </main>
  );
}
