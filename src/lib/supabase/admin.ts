import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getSupabaseConfig } from "./env";
/** Only use after independently authenticating and authorizing the request. */
export function createAdminClient() {
  const { url } = getSupabaseConfig();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Supabase service role is not configured.");
  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
