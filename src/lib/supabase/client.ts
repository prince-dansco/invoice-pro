import { createBrowserClient } from "@supabase/ssr";

import { getPublicEnv } from "@/lib/env";

/** Supabase client for Client Components. Uses the anon key only. */
export function createClient() {
  const { supabaseUrl, supabaseAnonKey } = getPublicEnv();
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
