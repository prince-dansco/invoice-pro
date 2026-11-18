import { STATUS_LABEL, type DisplayStatus } from "@/lib/invoice/status";
import { cn } from "@/lib/utils";

const STYLE: Record<DisplayStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-primary/10 text-primary",
  paid: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  overdue: "bg-destructive/10 text-destructive",
};

export function StatusBadge({ status, className }: { status: DisplayStatus; className?: string }) {
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", STYLE[status], className)}>
      {STATUS_LABEL[status]}
    </span>
  );
}
