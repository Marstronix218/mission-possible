import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { apiFetch } from "./client";
afterEach(() => vi.unstubAllGlobals());
describe("typed API fetch", () => {
  it("preserves Headers instances and verifies the response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ count: 1 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(
      await apiFetch("/api/attempts", z.object({ count: z.number() }), {
        headers: new Headers({ "X-Test": "kept" }),
      }),
    ).toEqual({ count: 1 });
    const init = fetchMock.mock.calls[0][1];
    expect(init.headers.get("X-Test")).toBe("kept");
    expect(init.credentials).toBe("same-origin");
  });
  it("rejects malformed successful responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ count: "bad" })),
    );
    await expect(
      apiFetch("/api/attempts", z.object({ count: z.number() })),
    ).rejects.toThrow();
  });
  it("surfaces structured server errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { error: { code: "UNAUTHORIZED", message: "Sign in first." } },
            { status: 401 },
          ),
        ),
    );
    await expect(apiFetch("/api/attempts", z.unknown())).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHORIZED",
    });
  });
  it("rejects external URLs before fetching", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      apiFetch("https://example.com/api/attempts", z.unknown()),
    ).rejects.toThrow("local");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
