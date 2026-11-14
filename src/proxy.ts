import { isMockMode } from "@/lib/data-mode";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig, hasSupabaseConfig } from "@/lib/supabase/env";
export async function proxy(request: NextRequest) {
  if (isMockMode || !hasSupabaseConfig()) return NextResponse.next({ request });
  let response = NextResponse.next({ request });
  const { url, key } = getSupabaseConfig();
  const client = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values, headers) {
        for (const { name, value } of values) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of values)
          response.cookies.set(name, value, options);
        for (const [name, value] of Object.entries(headers ?? {}))
          response.headers.set(name, value);
      },
    },
  });
  await client.auth.getClaims();
  return response;
}
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
