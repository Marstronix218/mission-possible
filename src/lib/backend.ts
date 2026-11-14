import "server-only";
import { createClient } from "@supabase/supabase-js";
export function database() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Live backend is not configured.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function identity(request: Request) {
  const db = database();
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer "))
    throw new HttpError(401, "Sign in to continue.");
  const { data, error } = await db.auth.getUser(header.slice(7));
  if (error || !data.user)
    throw new HttpError(401, "Your session has expired. Sign in again.");
  return { db, user: data.user };
}
export function check(error: { message: string } | null) {
  if (error) throw new HttpError(400, error.message);
}
