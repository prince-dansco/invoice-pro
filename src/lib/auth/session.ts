import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/** The signed-in user, or null. Verified with Supabase, not read from the cookie. */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/**
 * Use at the top of every Server Action and private page. Middleware already
 * redirects signed-out visitors, but actions can be called directly, so each
 * one re-checks the session itself.
 */
export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}
