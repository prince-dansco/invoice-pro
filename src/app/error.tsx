"use client";

import { ErrorState } from "@/components/error-state";

export default function RootError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="min-h-dvh">
      <ErrorState {...props} homeHref="/" />
    </main>
  );
}
