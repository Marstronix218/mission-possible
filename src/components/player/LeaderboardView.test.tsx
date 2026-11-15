import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/components/results/cloud", () => ({
  api: vi.fn(),
  backendAvailable: true,
  isMockMode: true,
}));

const { LeaderboardView, defaultLeaderboardTab, isLeaderboardTab } =
  await import("./LeaderboardView");
const { myRankLine } = await import("./LeaderboardGlobal");

const row = (entry_id: number, mine = false) => ({
  entry_id,
  nickname: "P" + entry_id,
  score: 50,
  attempts: 1,
  improvement: 0,
  achieved: "2026-11-14T00:00:00Z",
  players: 250,
  mine,
});

describe("leaderboard tabs", () => {
  it("picks a sensible default tab", () => {
    expect(defaultLeaderboardTab(true)).toBe("me");
    expect(defaultLeaderboardTab(false)).toBe("global");
    expect(defaultLeaderboardTab(true, "class-id")).toBe("class");
    expect(isLeaderboardTab("class")).toBe(true);
    expect(isLeaderboardTab("admin")).toBe(false);
  });
  it("renders accessible tabs with the requested one selected", () => {
    const html = renderToStaticMarkup(
      createElement(LeaderboardView, { initialTab: "global" }),
    );
    expect(html).toContain('role="tablist"');
    expect(html.match(/role="tab"/g)).toHaveLength(3);
    expect(html).toMatch(/id="leaderboard-tab-global"[^>]*aria-selected="true"|aria-selected="true"[^>]*id="leaderboard-tab-global"/);
    expect(html).toContain("GLOBAL · all pilots");
  });
  it("states the player's rank, including below the top list", () => {
    expect(myRankLine([row(1), row(2, true)])).toBe(
      "★ Your rank: #2 of 250 with 50.0 points.",
    );
    const top = Array.from({ length: 100 }, (_, i) => row(i + 1));
    expect(myRankLine([...top, row(240, true)])).toContain(
      "#240 of 250 with 50.0 points (shown below the top list)",
    );
    expect(myRankLine([row(1)])).toBeNull();
  });
});
