import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const cloud = vi.hoisted(() => ({
  api: vi.fn(),
  backendAvailable: true,
  isMockMode: false,
}));
vi.mock("@/components/results/cloud", () => cloud);

const { ResultLeaderboard, isUnsavedAttempt, rankPhrase, leaderboardHref } =
  await import("./ResultLeaderboard");

const deviceOnly =
  "This attempt was saved only on this device, so it isn&#x27;t on the leaderboard.";
const render = (verified?: boolean) =>
  renderToStaticMarkup(
    createElement(ResultLeaderboard, {
      attemptId: "a1",
      missionSlug: "los-angeles",
      verified,
    }),
  );

describe("result leaderboard", () => {
  it("explains device-only attempts in live mode instead of posting them", () => {
    cloud.isMockMode = false;
    expect(render(false)).toContain(deviceOnly);
    expect(render(true)).not.toContain(deviceOnly);
    expect(cloud.api).not.toHaveBeenCalled();
  });
  it("still posts unverified attempts to the mock demo board", () => {
    cloud.isMockMode = true;
    expect(render(false)).not.toContain(deviceOnly);
    cloud.isMockMode = false;
  });
  it("treats a 404 from the server as an unsaved attempt", () => {
    expect(
      isUnsavedAttempt(Object.assign(new Error("x"), { status: 404 })),
    ).toBe(true);
    expect(
      isUnsavedAttempt(Object.assign(new Error("x"), { status: 500 })),
    ).toBe(false);
    expect(isUnsavedAttempt(new Error("offline"))).toBe(false);
    expect(isUnsavedAttempt(null)).toBe(false);
  });
  it("says 'in the top 100' when the ranking is cut off at the RPC limit", () => {
    expect(rankPhrase(7, 100)).toBe("#7 in the top 100");
    expect(rankPhrase(3, 12)).toBe("#3 of 12");
  });
  it("uses the exact player count when the scoped ranking provides it", () => {
    expect(rankPhrase(140, 101, 300)).toBe("#140 of 300");
  });
  it("links to the same mission + difficulty scope on the full page", () => {
    expect(leaderboardHref("phoenix", undefined, "tight")).toBe(
      "/leaderboard?tab=global&mission=phoenix&difficulty=tight",
    );
    expect(
      leaderboardHref("phoenix", undefined, "relaxed", {
        budgetM: 300,
        massKg: 600,
      }),
    ).toBe(
      "/leaderboard?tab=global&mission=phoenix&difficulty=relaxed&budget=300&mass=600",
    );
    expect(leaderboardHref("phoenix", "c1", "custom")).toBe(
      "/leaderboard?tab=class&classroom=c1",
    );
  });
});
