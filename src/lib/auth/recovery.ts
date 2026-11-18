/**
 * True when an access token came from a password-reset link. Supabase records
 * how the session was created in the token's `amr` claim. The token was just
 * issued by Supabase to this server, so it is only decoded, not verified.
 */
export function isRecoveryToken(accessToken: string | undefined): boolean {
  const payload = accessToken?.split(".")[1];
  if (!payload) return false;
  try {
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      amr?: { method?: string }[];
    };
    return Array.isArray(json.amr) && json.amr.some((entry) => entry?.method === "recovery");
  } catch {
    return false;
  }
}
