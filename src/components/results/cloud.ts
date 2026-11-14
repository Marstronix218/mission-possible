"use client";
import type {SupabaseClient} from "@supabase/supabase-js";
import {createBrowserClient} from "@supabase/ssr";
let client: SupabaseClient | undefined;
export const cloudConfigured = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
export function cloud() {
  if (!cloudConfigured)
    throw new Error(
      "Live classrooms require Supabase configuration. See SETUP.md.",
    );
  return (client ??= createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  ));
}
let signingIn: Promise<string> | null = null;
export async function token() {
  const sb = cloud();
  const { data, error } = await sb.auth.getSession();
  if (error) throw error;
  if (data.session) return data.session.access_token;
  if (!signingIn)
    signingIn = (async () => {
      const { data, error } = await sb.auth.signInAnonymously();
      if (error) throw error;
      if (!data.session) throw new Error("Could not create anonymous session.");
      return data.session.access_token;
    })().finally(() => {
      signingIn = null;
    });
  return signingIn;
}
export async function api<T>(
  action: string,
  input: Record<string, unknown> = {},
): Promise<T> {
  const response = await fetch("/api/service", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + (await token()),
    },
    body: JSON.stringify({ action, ...input }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message ?? "Request failed.");
  return body as T;
}
