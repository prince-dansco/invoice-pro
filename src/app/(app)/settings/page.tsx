import type { Metadata } from "next";

import { PageHeader } from "@/components/app-shell/page-header";
import { FormSection } from "@/components/forms/form-section";
import { getLogoUrl, getProfile } from "@/lib/profile";
import { bpsToPercent } from "@/lib/rates";

import { LogoUploader } from "./logo-uploader";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  // The (app) layout has already required a signed-in, onboarded user.
  const profile = (await getProfile())!;
  const logoUrl = await getLogoUrl(profile.logo_path);

  const text = (v: string | null) => v ?? "";
  const defaults = {
    business_name: profile.business_name,
    email: text(profile.email),
    phone: text(profile.phone),
    website: text(profile.website),
    address_line1: text(profile.address_line1),
    address_line2: text(profile.address_line2),
    city: text(profile.city),
    state: text(profile.state),
    postal_code: text(profile.postal_code),
    country: text(profile.country),
    tax_id: text(profile.tax_id),
    currency: profile.currency,
    payment_terms_days: String(profile.payment_terms_days),
    invoice_prefix: profile.invoice_prefix,
    next_invoice_number: String(profile.next_invoice_number),
    default_tax_rate_bps: bpsToPercent(profile.default_tax_rate_bps),
    default_payment_instructions: text(profile.default_payment_instructions),
    default_notes: text(profile.default_notes),
    default_terms: text(profile.default_terms),
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Settings" description="Business details, branding and invoice defaults." />
      <div className="grid gap-6">
        <FormSection title="Logo" description="Appears on your invoices and PDFs.">
          <LogoUploader logoUrl={logoUrl} />
        </FormSection>
        <SettingsForm defaults={defaults} />
      </div>
    </div>
  );
}
