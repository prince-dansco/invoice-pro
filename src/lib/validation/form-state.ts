import { z } from "zod";

/** Result returned by form Server Actions and read with useActionState. */
export type FormState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  /** Echoed back so fields keep their values after a failed submit. */
  values?: Record<string, string>;
};

export function formValues(formData: FormData, keys: string[]) {
  return Object.fromEntries(keys.map((k) => [k, String(formData.get(k) ?? "")]));
}

export function invalid(error: z.ZodError, values?: Record<string, string>): FormState {
  return { fieldErrors: z.flattenError(error).fieldErrors, values };
}
