import { describe, expect, it } from "vitest";
import {
  leaderboardSubmission,
  leaderboardSubmissionSchema,
  publicRanking,
} from "./leaderboard";

const rows = [
  {
    user_id: "a",
    nickname: "Nova",
    score: 90,
    attempts: 2,
    improvement: 5,
    achieved: "2026-11-14T00:00:00Z",
  },
  {
    user_id: "b",
    nickname: "River",
    score: 80,
    attempts: 1,
    improvement: 0,
    achieved: "2026-11-14T01:00:00Z",
  },
];
const attempt = {
  id: "attempt-1",
  mission_slug: "los-angeles",
  classroom_id: null,
  score_total: 75,
  engine_version: "1.2.0",
};

describe("leaderboard response", () => {
  it("removes user IDs and flags only the requesting player's row", () => {
    const ranked = publicRanking(rows, "b");
    expect(ranked.map((r) => [r.entry_id, r.mine])).toEqual([
      [1, false],
      [2, true],
    ]);
    expect(ranked.some((r) => "user_id" in r)).toBe(false);
  });
  it("reports the player's rank and best score, not the client's", () => {
    const data = leaderboardSubmission(rows, "b", attempt, "1.2.0");
    expect(data.me).toEqual({ rank: 2, nickname: "River", score: 80 });
    expect(data.attempt).toMatchObject({ score: 75, ranked: true });
    expect(leaderboardSubmissionSchema.parse(data)).toEqual(data);
  });
  it("handles players outside the ranking and older engine versions", () => {
    const data = leaderboardSubmission(rows, "z", attempt, "2.0.0");
    expect(data.me).toBeNull();
    expect(data.attempt.ranked).toBe(false);
  });
  it("rejects malformed submissions", () => {
    expect(
      leaderboardSubmissionSchema.safeParse({ rows: [{}], me: null }).success,
    ).toBe(false);
  });
});
