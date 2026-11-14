import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/env";
import { safeRedirectPath } from "@/lib/api/redirect";
export async function GET(request: NextRequest) {
  if (!hasSupabaseConfig())
    return NextResponse.json(
      {
        error: {
          code: "NOT_CONFIGURED",
          message: "Authentication is not configured.",
        },
      },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  const token_hash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  if (token_hash && type === "email") {
    const client = await createClient();
    const { error } = await client.auth.verifyOtp({
      token_hash,
      type: "email",
    });
    if (!error)
      return NextResponse.redirect(
        new URL(
          safeRedirectPath(request.nextUrl.searchParams.get("next")),
          request.url,
        ),
        { headers: { "Cache-Control": "private, no-store" } },
      );
  }
  return NextResponse.json(
    {
      error: {
        code: "INVALID_AUTH_LINK",
        message: "This sign-in link is invalid or expired.",
      },
    },
    { status: 400, headers: { "Cache-Control": "private, no-store" } },
  );
}
