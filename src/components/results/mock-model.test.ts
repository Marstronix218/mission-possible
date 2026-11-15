import { describe, expect, it } from "vitest";
import {
  createDemoState,
  demoClassId,
  demoCode,
  performDemoAction,
  type DemoContext,
} from "./mock-model";
import { defaultDesign } from "./missions";
import type { LeaderboardSubmission } from "@/lib/api/leaderboard";

const player = "d2000000-0000-4000-8000-000000000001";
let n = 0;
const ctx = (userId = player): DemoContext => ({
  userId,
  role: "student",
  now: "2026-11-15T00:00:00.000Z",
  uuid: () => "d3000000-0000-4000-8000-" + String(++n).padStart(12, "0"),
});
const requestId = "d4000000-0000-4000-8000-000000000001";

function launched() {
  const state = createDemoState();
  performDemoAction(
    state,
    "attempt",
    { missionSlug: "los-angeles", design: defaultDesign, requestId },
    ctx(),
  );
  return state;
}

describe("demo leaderboard submission", () => {
  it("publishes a saved attempt under the pilot name and ranks it", () => {
    const state = launched();
    const data = performDemoAction(
      state,
      "submitScore",
      { attemptId: requestId, nickname: "Pilot Kai" },
      ctx(),
    ) as LeaderboardSubmission;
    expect(state.profiles[player].nickname).toBe("Pilot Kai");
    expect(data.me?.nickname).toBe("Pilot Kai");
    expect(data.rows.filter((r) => r.mine)).toHaveLength(1);
    expect(data.rows[(data.me?.rank ?? 0) - 1].mine).toBe(true);
    expect(data.attempt.id).toBe(requestId);
  });
  it("is idempotent on refresh and replayed attempt IDs", () => {
    const state = launched();
    const input = { attemptId: requestId, nickname: "Pilot Kai" };
    const first = performDemoAction(state, "submitScore", input, ctx());
    performDemoAction(
      state,
      "attempt",
      { missionSlug: "los-angeles", design: defaultDesign, requestId },
      ctx(),
    );
    const second = performDemoAction(state, "submitScore", input, ctx());
    expect(second).toEqual(first);
    expect(state.attempts.filter((a) => a.id === requestId)).toHaveLength(1);
    expect(
      (second as LeaderboardSubmission).rows.filter(
        (r) => r.nickname === "Pilot Kai",
      )[0].attempts,
    ).toBe(1);
  });
  it("rejects other players' attempts and invalid names", () => {
    const state = launched();
    expect(() =>
      performDemoAction(
        state,
        "submitScore",
        { attemptId: requestId, nickname: "Thief" },
        ctx("d2000000-0000-4000-8000-000000000099"),
      ),
    ).toThrow();
    expect(() =>
      performDemoAction(
        state,
        "submitScore",
        { attemptId: requestId, nickname: "x" },
        ctx(),
      ),
    ).toThrow();
    expect(state.profiles[player].nickname).toBeNull();
  });
  it("keeps classroom rankings on class nicknames", () => {
    const state = createDemoState();
    performDemoAction(
      state,
      "joinClass",
      { code: demoCode, nickname: "Class Kai" },
      ctx(),
    );
    performDemoAction(
      state,
      "attempt",
      {
        missionSlug: "los-angeles",
        design: defaultDesign,
        classroomId: demoClassId,
        requestId,
      },
      ctx(),
    );
    const data = performDemoAction(
      state,
      "submitScore",
      { attemptId: requestId, nickname: "Pilot Kai" },
      ctx(),
    ) as LeaderboardSubmission;
    expect(data.attempt.classroomId).toBe(demoClassId);
    expect(data.me?.nickname).toBe("Class Kai");
    expect(state.profiles[player].nickname).toBeNull();
  });
  it("marks the player's row in plain rankings", () => {
    const state = launched();
    performDemoAction(
      state,
      "submitScore",
      { attemptId: requestId, nickname: "Pilot Kai" },
      ctx(),
    );
    const rows = performDemoAction(
      state,
      "ranking",
      { missionSlug: "los-angeles" },
      ctx(),
    ) as { nickname: string; mine?: boolean }[];
    expect(rows.find((r) => r.mine)?.nickname).toBe("Pilot Kai");
    expect(rows.filter((r) => r.mine)).toHaveLength(1);
  });
});
