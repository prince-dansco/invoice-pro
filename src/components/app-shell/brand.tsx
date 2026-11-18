import Link from "next/link";
import { ReceiptText } from "lucide-react";

export function Brand({ href = "/dashboard" }: { href?: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-md font-semibold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
        <ReceiptText className="size-4" aria-hidden />
      </span>
      InvoicePro
    </Link>
  );
}
