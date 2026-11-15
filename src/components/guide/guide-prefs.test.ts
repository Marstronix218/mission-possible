import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react", () => ({
  useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) =>
    snapshot(),
}));

beforeEach(() => {
  vi.resetModules();
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
  vi.stubGlobal("window", new EventTarget());
});
afterEach(() => vi.unstubAllGlobals());

describe("guide preferences", () => {
  it("keeps hiding and muting independent and remembers them on a later visit", async () => {
    const prefs = await import("./guide-prefs");
    expect(prefs.useGuidePref("hidden")).toBe(false);
    expect(prefs.useGuidePref("muted")).toBe(false);
    prefs.setGuidePref("muted", true);
    expect(prefs.useGuidePref("hidden")).toBe(false);
    prefs.setGuidePref("hidden", true);
    vi.resetModules();
    const returning = await import("./guide-prefs");
    expect(returning.useGuidePref("hidden")).toBe(true);
    expect(returning.useGuidePref("muted")).toBe(true);
    returning.setGuidePref("hidden", false);
    expect(returning.useGuidePref("hidden")).toBe(false);
    expect(returning.useGuidePref("muted")).toBe(true);
  });

  it("still lets players hide and restore the guide when storage is blocked", async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("Storage blocked");
      },
      setItem: () => {
        throw new Error("Storage blocked");
      },
    });
    const prefs = await import("./guide-prefs");
    prefs.setGuidePref("hidden", true);
    prefs.setGuidePref("muted", true);
    expect(prefs.useGuidePref("hidden")).toBe(true);
    expect(prefs.useGuidePref("muted")).toBe(true);
    prefs.setGuidePref("hidden", false);
    expect(prefs.useGuidePref("hidden")).toBe(false);
  });
});
