import "server-only";

import { getPublicEnv } from "@/lib/env";

/**
 * Whether Google sign-in is switched on in the Supabase project. Read from the
 * public auth settings endpoint and cached for five minutes, so the button
 * appears or disappears without a redeploy.
 */
export async function isGoogleEnabled(): Promise<boolean> {
  const { supabaseUrl, supabaseAnonKey } = getPublicEnv();
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: supabaseAnonKey },
      next: { revalidate: 300 },
    });
    if (!res.ok) return false;
    const settings = (await res.json()) as { external?: Record<string, boolean> };
    return settings.external?.google === true;
  } catch {
    return false;
  }
}
