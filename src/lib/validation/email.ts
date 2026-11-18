import { z } from "zod";

export const emailInvoiceSchema = z.object({
  to: z.email({ error: "Enter one valid email address." }).trim().max(254),
  subject: z
    .string()
    .trim()
    .min(1, { error: "Enter a subject." })
    .max(200, { error: "Use 200 characters or fewer." })
    // No line breaks: they could be used to add extra email headers.
    .refine((s) => !/[\r\n]/.test(s), { error: "The subject must be on one line." }),
  message: z.string().trim().max(2000, { error: "Use 2,000 characters or fewer." }),
});

export type EmailInvoiceInput = z.input<typeof emailInvoiceSchema>;
