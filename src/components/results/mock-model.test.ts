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
    expect(state.profiles[player].nickname).toBe("Pilot Kai");
    expect(
      rank(state, {
        missionSlug: "los-angeles",
        difficulty: data.scope!.difficulty,
        constraints: data.scope!.constraints,
      }).find((r) => r.mine)?.nickname,
    ).toBe("Pilot Kai");
  });
  it("keeps unnamed class players private and syncs explicitly renamed public pilots", () => {
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
    performDemoAction(state, "submitScore", { attemptId: requestId }, ctx());
    expect(state.profiles[player].nickname).toBeNull();
    expect(
      rank(state, {
        missionSlug: "los-angeles",
        difficulty: "custom",
        constraints: { budgetM: 250, massKg: 500 },
      }).some((r) => r.mine),
    ).toBe(false);
    performDemoAction(
      state,
      "submitScore",
      { attemptId: requestId, nickname: "New Pilot" },
      ctx(),
    );
    expect(state.profiles[player].nickname).toBe("New Pilot");
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

type Row = {
  entry_id: number;
  nickname: string;
  score: number;
  attempts: number;
  players?: number;
  mine?: boolean;
};
const rank = (
  state: ReturnType<typeof createDemoState>,
  input: Record<string, unknown>,
  userId = player,
) => performDemoAction(state, "ranking", input, ctx(userId)) as Row[];

describe("demo leaderboard scopes", () => {
  it("keeps one best row per player and never mixes difficulty tiers", () => {
    const state = createDemoState();
    // Fixtures: three demo pilots with two solo (standard) attempts each, plus
    // the same designs in the demo class (250/500 vs 220/450 → custom).
    const standard = rank(state, { missionSlug: "los-angeles" });
    expect(standard.map((r) => r.nickname).sort()).toEqual([
      "Demo Nova",
      "Demo Orbit Fox",
      "Demo River",
    ]);
    expect(standard.every((r) => r.attempts === 2)).toBe(true);
    const custom = rank(state, {
      missionSlug: "los-angeles",
      difficulty: "custom",
      constraints: { budgetM: 250, massKg: 500 },
    });
    expect(custom.every((r) => r.attempts === 2)).toBe(true);
    expect(
      rank(state, { missionSlug: "los-angeles", difficulty: "tight" }),
    ).toEqual([]);
    // Different missions never share a board.
    expect(rank(state, { missionSlug: "houston" })).toEqual([]);
  });
  it("separates exact limits inside a tier and lists only public scopes", () => {
    const state = createDemoState();
    const base = state.attempts.find((a) => a.classroom_id === null)!;
    state.attempts.push({
      ...base,
      id: "higher-budget",
      score_total: 100,
      constraints: { budgetM: 225, massKg: 450 },
    });
    expect(
      rank(state, { missionSlug: "los-angeles" }).every((r) => r.score < 100),
    ).toBe(true);
    expect(
      rank(state, {
        missionSlug: "los-angeles",
        constraints: { budgetM: 225, massKg: 450 },
      }).map((r) => r.score),
    ).toEqual([100]);
    const conditions = performDemoAction(
      state,
      "rankingConditions",
      { missionSlug: "los-angeles", difficulty: "standard" },
      ctx(),
    );
    expect(conditions).toEqual([
      { budgetM: 220, massKg: 450 },
      { budgetM: 225, massKg: 450 },
    ]);
  });
  it("excludes other simulator versions from rankings", () => {
    const state = createDemoState();
    const nova = state.attempts.find(
      (a) => a.classroom_id === null && a.user_id.endsWith("1"),
    )!;
    state.attempts.push({
      ...nova,
      id: "old-engine",
      score_total: 100,
      engine_version: "0.0.1",
    });
    const rows = rank(state, { missionSlug: "los-angeles" });
    expect(rows.every((r) => r.score < 100)).toBe(true);
    expect(rows.find((r) => r.nickname === "Demo Nova")?.attempts).toBe(2);
  });
  it("ranks class boards on class attempts only, under the class tier", () => {
    const state = createDemoState();
    performDemoAction(
      state,
      "joinClass",
      { code: demoCode, nickname: "Class Kai" },
      ctx(),
    );
    const rows = rank(state, {
      missionSlug: "los-angeles",
      classroomId: demoClassId,
    });
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.attempts === 2)).toBe(true);
    // Asking a class for another tier is honest: nothing matches.
    expect(
      rank(state, {
        missionSlug: "los-angeles",
        classroomId: demoClassId,
        difficulty: "standard",
      }),
    ).toEqual([]);
    expect(() =>
      rank(state, { missionSlug: "houston", classroomId: demoClassId }),
    ).toThrow();
    expect(() =>
      rank(state, { missionSlug: "los-angeles", difficulty: "hard" }),
    ).toThrow();
  });
  it("adds the player's own row with its true rank below the top 100", () => {
    const state = createDemoState();
    const base = state.attempts.find((a) => a.classroom_id === null)!;
    for (let i = 0; i < 105; i++) {
      const id = "d5000000-0000-4000-8000-" + String(i).padStart(12, "0");
      state.profiles[id] = { nickname: "Pilot " + i };
      state.attempts.push({
        ...base,
        id: "many-" + i,
        user_id: id,
        score_total: 99,
      });
    }
    state.profiles[player] = { nickname: "Pilot Kai" };
    state.attempts.push({
      ...base,
      id: "mine",
      user_id: player,
      score_total: 1,
    });
    const rows = rank(state, { missionSlug: "los-angeles" });
    expect(rows).toHaveLength(101);
    const mine = rows[rows.length - 1];
    expect(mine).toMatchObject({ mine: true, entry_id: 109, players: 109 });
    expect(rows[99].entry_id).toBe(100);
  });
  it("returns the submitted attempt's scope with the ranking", () => {
    const state = launched();
    const data = performDemoAction(
      state,
      "submitScore",
      { attemptId: requestId, nickname: "Pilot Kai" },
      ctx(),
    ) as LeaderboardSubmission;
    expect(data.scope).toEqual({
      missionSlug: "los-angeles",
      difficulty: "standard",
      engineVersion: data.scope?.engineVersion,
      constraints: { budgetM: 220, massKg: 450 },
    });
    expect(data.me?.players).toBe(4);
  });
  it("lists only the caller's own attempts and classes", () => {
    const state = launched();
    performDemoAction(
      state,
      "joinClass",
      { code: demoCode, nickname: "Class Kai" },
      ctx(),
    );
    const mine = performDemoAction(state, "myAttempts", {}, ctx()) as {
      id: string;
    }[];
    expect(mine.map((a) => a.id)).toEqual([requestId]);
    expect(JSON.stringify(mine)).not.toContain("user_id");
    const classes = performDemoAction(state, "myClasses", {}, ctx()) as {
      id: string;
      role: string;
      nickname: string;
      join_code?: string;
    }[];
    expect(classes).toEqual([
      expect.objectContaining({
        id: demoClassId,
        role: "student",
        nickname: "Class Kai",
      }),
    ]);
    expect(classes[0].join_code).toBeUndefined();
  });
});
