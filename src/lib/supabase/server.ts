import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { getSupabaseConfig } from "./env";
export async function createClient() {
  const store = await cookies();
  const { url, key } = getSupabaseConfig();
  return createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(values) {
        // Server Components cannot write cookies; proxy.ts handles refresh there.
        try {
          for (const { name, value, options } of values)
            store.set(name, value, options);
        } catch (error) {
          if (
            !(error instanceof Error) ||
            !error.message.includes("Cookies can only be modified")
          )
            throw error;
        }
      },
    },
  });
}
