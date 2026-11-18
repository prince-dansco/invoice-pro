import { useId } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type SelectFieldProps = React.ComponentProps<"select"> & {
  label: string;
  errors?: string[];
  options: { value: string; label: string }[];
};

/** Native select styled to match Input. */
export function SelectField({ label, errors, options, className, ...props }: SelectFieldProps) {
  const id = useId();
  const error = errors?.[0];

  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm dark:bg-input/30"
        {...props}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
