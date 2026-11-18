"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";

/**
 * Shown when a page fails to load. Never displays the error itself: in
 * production Next.js replaces server error messages anyway, and a short
 * reference (digest) is enough for matching against server logs.
 */
export function ErrorState({ error, reset, homeHref = "/dashboard" }: { error: Error & { digest?: string }; reset: () => void; homeHref?: string }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto grid max-w-md justify-items-center gap-3 px-4 py-16 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="size-6" aria-hidden />
      </span>
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">
        This page couldn&apos;t be loaded. Your saved work is safe. Try again, and if it keeps happening, check your connection.
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>
          <RotateCcw aria-hidden />
          Try again
        </Button>
        <Link href={homeHref} className={buttonVariants({ variant: "outline" })}>
          Go to dashboard
        </Link>
      </div>
      {error.digest && <p className="text-xs text-muted-foreground">Reference: {error.digest}</p>}
    </div>
  );
}
