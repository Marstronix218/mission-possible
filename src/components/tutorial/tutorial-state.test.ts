import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

// Exercise the external-store snapshots without mounting React or a DOM.
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

describe("tutorial session", () => {
  it("starts unseen and can open for a first-time player", async () => {
    const state = await import("./tutorial-state");
    expect(state.readTutorialSeen()).toBe(false);
    expect(state.useTutorialOpen()).toBe(false);
    state.openTutorial();
    expect(state.useTutorialOpen()).toBe(true);
    expect(state.readTutorialSeen()).toBe(false);
  });

  it("remembers skip/completion and supports an explicit replay", async () => {
    const state = await import("./tutorial-state");
    state.openTutorial();
    state.closeTutorial();
    expect(state.useTutorialOpen()).toBe(false);
    expect(localStorage.getItem(state.tutorialSeenKey)).toBe("1");
    // A fresh module models returning on a later page visit.
    vi.resetModules();
    const returning = await import("./tutorial-state");
    expect(returning.readTutorialSeen()).toBe(true);
    expect(returning.useTutorialOpen()).toBe(false);
    returning.openTutorial();
    expect(returning.useTutorialOpen()).toBe(true);
  });

  it("does not nag again within the session when storage is blocked", async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("Storage blocked");
      },
      setItem: () => {
        throw new Error("Storage blocked");
      },
    });
    const state = await import("./tutorial-state");
    expect(state.readTutorialSeen()).toBe(false);
    state.openTutorial();
    state.closeTutorial();
    expect(state.readTutorialSeen()).toBe(true);
    expect(state.useTutorialOpen()).toBe(false);
  });
});
