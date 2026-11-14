import { afterEach, describe, expect, it, vi } from "vitest";
const { getUser, signInAnonymously } = vi.hoisted(() => ({
  getUser: vi.fn(),
  signInAnonymously: vi.fn(),
}));
vi.mock("@supabase/ssr", () => ({
  createBrowserClient: () => ({ auth: { getUser, signInAnonymously } }),
}));
import { ensurePlayerSession } from "./client";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});
describe("anonymous player session", () => {
  it("deduplicates concurrent sign-ins", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:55321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-key");
    getUser.mockResolvedValue({
      data: { user: null },
      error: { name: "AuthSessionMissingError" },
    });
    signInAnonymously.mockResolvedValue({
      data: { user: { id: "player" } },
      error: null,
    });
    const users = await Promise.all([
      ensurePlayerSession(),
      ensurePlayerSession(),
    ]);
    expect(users).toEqual([{ id: "player" }, { id: "player" }]);
    expect(signInAnonymously).toHaveBeenCalledTimes(1);
  });
  it("does not replace an identity on a temporary auth failure", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:55321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-key");
    getUser.mockResolvedValue({
      data: { user: null },
      error: new Error("Network failure"),
    });
    await expect(ensurePlayerSession()).rejects.toThrow("Network failure");
    expect(signInAnonymously).not.toHaveBeenCalled();
  });
});
