import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ isMockMode: false }));
const { createClient, hasSupabaseConfig, exchangeCodeForSession, verifyOtp } =
  vi.hoisted(() => ({
    createClient: vi.fn(),
    hasSupabaseConfig: vi.fn(),
    exchangeCodeForSession: vi.fn(),
    verifyOtp: vi.fn(),
  }));
vi.mock("@/lib/data-mode", () => state);
vi.mock("@/lib/supabase/env", () => ({ hasSupabaseConfig }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
import { GET } from "./route";

const callback = (query: string) =>
  GET(new Request("https://game.example/auth/confirm" + query));

describe("teacher auth callback", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    state.isMockMode = false;
    hasSupabaseConfig.mockReturnValue(true);
    createClient.mockResolvedValue({
      auth: { exchangeCodeForSession, verifyOtp },
    });
    exchangeCodeForSession.mockResolvedValue({ error: null });
    verifyOtp.mockResolvedValue({ error: null });
  });

  it("exchanges a PKCE code and redirects to the same-origin teacher page", async () => {
    const response = await callback(
      "?code=test-code&next=https://other.example",
    );
    expect(exchangeCodeForSession).toHaveBeenCalledWith("test-code");
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(
      "https://game.example/teacher",
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("verifies an email token hash from the committed email template", async () => {
    const response = await callback("?token_hash=test-hash&type=email");
    expect(verifyOtp).toHaveBeenCalledWith({
      token_hash: "test-hash",
      type: "email",
    });
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(
      "https://game.example/teacher",
    );
  });

  it("rejects non-email token types without contacting Supabase", async () => {
    const response = await callback("?token_hash=test-hash&type=recovery");
    expect(createClient).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(
      "https://game.example/teacher?authError=expired",
    );
  });

  it("shows the teacher auth error when Supabase rejects a code", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: new Error("Expired") });
    const response = await callback("?code=expired");
    expect(response.headers.get("location")).toBe(
      "https://game.example/teacher?authError=expired",
    );
  });

  it("handles an auth connection failure without exposing its details", async () => {
    exchangeCodeForSession.mockRejectedValue(
      new Error("Internal auth details"),
    );
    const response = await callback("?code=unavailable");
    expect(response.headers.get("location")).toBe(
      "https://game.example/teacher?authError=expired",
    );
  });

  it("keeps mock callbacks local even when a code is supplied", async () => {
    state.isMockMode = true;
    const response = await callback("?code=unused");
    expect(createClient).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(
      "https://game.example/teacher",
    );
  });

  it("handles missing configuration or token without creating a client", async () => {
    hasSupabaseConfig.mockReturnValue(false);
    const response = await callback("?code=unused");
    expect(createClient).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(
      "https://game.example/teacher?authError=expired",
    );
    hasSupabaseConfig.mockReturnValue(true);
    await callback("");
    expect(createClient).not.toHaveBeenCalled();
  });
});
