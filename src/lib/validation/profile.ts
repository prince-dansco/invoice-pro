import { z } from "zod";

import { CURRENCY_CODES } from "@/lib/currencies";
import { percentToBps } from "@/lib/rates";

/** Optional text: trimmed, length-limited, and stored as null when empty. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `Use ${max} characters or fewer.` })
    .transform((v) => v || null);

export const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .refine((v) => !v || z.email().safeParse(v).success, { error: "Enter a valid email address." })
  .transform((v) => v || null);

const businessName = z
  .string()
  .trim()
  .min(1, { error: "Enter your business or trading name." })
  .max(120, { error: "Use 120 characters or fewer." });

const currency = z.enum(CURRENCY_CODES, { error: "Choose a currency." });

const wholeNumber = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .regex(/^\d+$/, { error: message })
    .transform(Number)
    .refine((n) => n >= min && n <= max, { error: message });

export const onboardingSchema = z.object({
  business_name: businessName,
  email: optionalEmail,
  phone: optionalText(40),
  currency,
  address_line1: optionalText(200),
  city: optionalText(100),
  country: optionalText(100),
});

export const ONBOARDING_FIELDS = Object.keys(onboardingSchema.shape);

/** Everything editable in Settings (spec §7). */
export const settingsSchema = z.object({
  business_name: businessName,
  email: optionalEmail,
  phone: optionalText(40),
  website: optionalText(200),
  address_line1: optionalText(200),
  address_line2: optionalText(200),
  city: optionalText(100),
  state: optionalText(100),
  postal_code: optionalText(20),
  country: optionalText(100),
  tax_id: optionalText(60),
  currency,
  payment_terms_days: wholeNumber(0, 365, "Enter a number of days from 0 to 365."),
  invoice_prefix: z
    .string()
    .trim()
    .max(12, { error: "Use 12 characters or fewer." })
    .regex(/^[A-Za-z0-9\-_/#.]*$/, { error: "Use letters, numbers and - _ / # . only." }),
  next_invoice_number: wholeNumber(1, 999_999_999, "Enter a whole number of 1 or more."),
  default_tax_rate_bps: z
    .string()
    .transform((v, ctx) => {
      const bps = percentToBps(v || "0");
      if (bps === null || bps > 10000) {
        ctx.addIssue({ code: "custom", message: "Enter a percentage from 0 to 100, like 7.5." });
        return z.NEVER;
      }
      return bps;
    }),
  default_payment_instructions: optionalText(2000),
  default_notes: optionalText(2000),
  default_terms: optionalText(2000),
});

export const SETTINGS_FIELDS = Object.keys(settingsSchema.shape);
