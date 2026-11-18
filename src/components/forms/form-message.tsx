import { CircleAlert, CircleCheck } from "lucide-react";

import type { FormState } from "@/lib/validation/form-state";

export function FormMessage({ state }: { state: FormState }) {
  if (state.error) {
    return (
      <p role="alert" className="flex gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
        <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p role="status" className="flex gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm text-foreground">
        <CircleCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        {state.success}
      </p>
    );
  }
  return null;
}
