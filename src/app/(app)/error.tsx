"use client";

import { ErrorState } from "@/components/error-state";

// Inside the app shell, so the sidebar stays usable when a page fails.
export default function AppError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState {...props} />;
}
