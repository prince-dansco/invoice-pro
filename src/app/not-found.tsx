import Link from "next/link";
import { FileQuestion } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="grid max-w-md justify-items-center gap-3 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
          <FileQuestion className="size-6" aria-hidden />
        </span>
        <h1 className="text-lg font-semibold">Page not found</h1>
        <p className="text-sm text-muted-foreground">
          This page doesn&apos;t exist, or it belongs to a different account.
        </p>
        <Link href="/dashboard" className={buttonVariants({ className: "mt-2" })}>
          Go to dashboard
        </Link>
      </div>
    </main>
  );
}
