import { NextResponse } from "next/server";
import { isMockMode } from "@/lib/data-mode";
import { hasSupabaseConfig } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (isMockMode) return NextResponse.redirect(new URL("/teacher", url));

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const emailToken = tokenHash && url.searchParams.get("type") === "email";
  let authenticated = false;
  if (hasSupabaseConfig() && (code || emailToken)) {
    try {
      const client = await createClient();
      const { error } = code
        ? await client.auth.exchangeCodeForSession(code)
        : await client.auth.verifyOtp({
            token_hash: tokenHash!,
            type: "email",
          });
      authenticated = !error;
    } catch {
      // Expired links and temporary auth failures keep credentials out of the response.
    }
  }
  return NextResponse.redirect(
    new URL(authenticated ? "/teacher" : "/teacher?authError=expired", url),
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
