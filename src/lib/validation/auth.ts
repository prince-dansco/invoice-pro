import { z } from "zod";

const email = z.email({ error: "Enter a valid email address." }).trim().toLowerCase().max(254);
const password = z
  .string()
  .min(8, { error: "Use at least 8 characters." })
  .max(72, { error: "Use 72 characters or fewer." });

export const signInSchema = z.object({
  email,
  password: z.string().min(1, { error: "Enter your password." }),
});

export const signUpSchema = z.object({ email, password });

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({ password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, {
    error: "Passwords don't match.",
    path: ["confirm"],
  });
