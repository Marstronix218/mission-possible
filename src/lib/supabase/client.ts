"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { getSupabaseConfig } from "./env";
export function createClient() {
  const { url, key } = getSupabaseConfig();
  return createBrowserClient<Database>(url, key);
}
/** Call when a player enters the game, rather than for every landing-page visit. */
let pendingSession: ReturnType<typeof startPlayerSession> | undefined;
export function ensurePlayerSession() {
  if (!pendingSession) {
    pendingSession = startPlayerSession().finally(() => {
      pendingSession = undefined;
    });
  }
  return pendingSession;
}
async function startPlayerSession() {
  const client = createClient();
  const { data, error } = await client.auth.getUser();
  if (data.user) return data.user;
  if (error && error.name !== "AuthSessionMissingError") throw error;
  const result = await client.auth.signInAnonymously();
  if (result.error) throw result.error;
  if (!result.data.user) throw new Error("Unable to start player session.");
  return result.data.user;
}
/** Email authentication alone does not grant the server-controlled teacher role. */
export async function requestTeacherSignIn(email: string) {
  const client = createClient();
  const { error } = await client.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: new URL("/auth/confirm", window.location.origin).href,
    },
  });
  if (error) throw error;
}
