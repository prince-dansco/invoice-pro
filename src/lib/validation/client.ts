import { z } from "zod";

import { optionalEmail, optionalText } from "./profile";

/** Shared by the browser (instant feedback) and the server (the real check). */
export const clientSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "Enter the client's name." })
    .max(120, { error: "Use 120 characters or fewer." }),
  company: optionalText(120),
  email: optionalEmail,
  phone: optionalText(40),
  address_line1: optionalText(200),
  address_line2: optionalText(200),
  city: optionalText(100),
  state: optionalText(100),
  postal_code: optionalText(20),
  country: optionalText(100),
  tax_id: optionalText(60),
  notes: optionalText(2000),
});

export const CLIENT_FIELDS = Object.keys(clientSchema.shape);
