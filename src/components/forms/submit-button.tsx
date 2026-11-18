import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SubmitButton({
  pending,
  pendingLabel,
  children,
  className,
}: {
  pending: boolean;
  pendingLabel: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Button type="submit" size="lg" disabled={pending} aria-disabled={pending} className={cn("w-full", className)}>
      {pending && <Loader2 className="animate-spin" aria-hidden />}
      {pending ? pendingLabel : children}
    </Button>
  );
}
