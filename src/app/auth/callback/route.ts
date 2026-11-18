import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { isRecoveryToken } from "@/lib/auth/recovery";
import { safeNext } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing point for email confirmation, password recovery and Google sign-in.
 *
 * Two link formats are supported:
 * - `token_hash` + `type`, from the custom email templates. Works in any
 *   browser, so this is the preferred format for emails.
 * - `code` (PKCE). Only works in the browser that started the flow, because
 *   the code verifier is stored in a cookie there.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  let next = safeNext(searchParams.get("next"));
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();
  let ok = false;
  let accessToken: string | undefined;

  if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    ok = !error;
    accessToken = data.session?.access_token;
  } else if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
    accessToken = data.session?.access_token;
  }

  // A reset link must always end on "Choose a new password", even if the
  // `next` parameter was lost on the way (see the middleware).
  if (ok && (type === "recovery" || isRecoveryToken(accessToken))) next = "/reset-password";

  if (ok) return NextResponse.redirect(new URL(next, origin));

  const login = new URL("/login", origin);
  if (searchParams.get("error_code") === "otp_expired") {
    login.searchParams.set("error", next === "/reset-password" ? "reset_link" : "expired");
  } else if (next === "/reset-password") {
    login.searchParams.set("error", "reset_link");
  } else if (code && next === "/onboarding") {
    // Supabase confirms the address before redirecting here, so a failed code
    // exchange (usually a different browser) still leaves the email confirmed.
    login.searchParams.set("error", "confirmed");
    login.searchParams.set("next", next);
  } else {
    login.searchParams.set("error", "link");
  }
  return NextResponse.redirect(login);
}
