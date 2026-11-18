/**
 * Only allow redirects to paths on this site. Rejects absolute URLs and
 * protocol-relative paths like "//evil.example" to prevent open redirects.
 */
export function safeNext(next: unknown, fallback = "/dashboard"): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return fallback;
  }
  return next;
}
