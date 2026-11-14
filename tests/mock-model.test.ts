import { describe, it, expect, beforeEach } from "vitest";
import {
  createDemoState,
  performDemoAction,
  demoClassId,
  demoTeacherId,
  type DemoState,
  type DemoContext,
} from "../src/components/results/mock-model";
import { defaultDesign, getMission } from "../src/components/results/missions";
import { runSimulation } from "../src/lib/sim";
let state: DemoState;
let serial = 10;
const ctx = (
  role: "student" | "teacher" = "student",
  userId = role === "teacher" ? demoTeacherId : "demo-student",
): DemoContext => ({
  role,
  userId,
  now: "2026-11-14T23:00:00.000Z",
  uuid: () => `00000000-0000-4000-8000-${String(serial++).padStart(12, "0")}`,
});
beforeEach(() => {
  state = createDemoState();
  serial = 10;
});
describe("browser-local mock classroom behavior", () => {
  it("seeds explicitly fictional players with real computed engine scores", () => {
    expect(state.members.every((m) => m.nickname.startsWith("Demo "))).toBe(
      true,
    );
    for (const a of state.attempts)
      expect(a.result).toEqual(
        runSimulation(getMission(a.mission_slug)!, a.design, a.constraints),
      );
  });
  it("requires joining and handles duplicate nicknames case-insensitively", () => {
    expect(() =>
      performDemoAction(state, "classroom", { id: demoClassId }, ctx()),
    ).toThrow("Join");
    expect(() =>
      performDemoAction(
        state,
        "joinClass",
        { code: "ORBIT1", nickname: "demo nova" },
        ctx(),
      ),
    ).toThrow("already used");
    performDemoAction(
      state,
      "joinClass",
      { code: "ORBIT1", nickname: "Moon Scout" },
      ctx(),
    );
    expect(
      performDemoAction(state, "classroom", { id: demoClassId }, ctx()),
    ).toMatchObject({ id: demoClassId });
  });
  it("enforces attempt limits and idempotent submission retries", () => {
    performDemoAction(
      state,
      "joinClass",
      { code: "ORBIT1", nickname: "Moon Scout" },
      ctx(),
    );
    const input = {
      missionSlug: "los-angeles",
      classroomId: demoClassId,
      design: defaultDesign,
      requestId: "attempt-1",
    };
    const first = performDemoAction(state, "attempt", input, ctx());
    expect(performDemoAction(state, "attempt", input, ctx())).toEqual(first);
    performDemoAction(
      state,
      "attempt",
      { ...input, requestId: "attempt-2" },
      ctx(),
    );
    performDemoAction(
      state,
      "attempt",
      { ...input, requestId: "attempt-3" },
      ctx(),
    );
    expect(() =>
      performDemoAction(
        state,
        "attempt",
        { ...input, requestId: "attempt-4" },
        ctx(),
      ),
    ).toThrow("Attempt limit");
  });
  it("locks scoring settings while permitting code rotation and archiving", () => {
    const c = state.classrooms[0];
    expect(() =>
      performDemoAction(
        state,
        "updateClass",
        { id: c.id, settings: { ...c, budget_m: 300 } },
        ctx("teacher"),
      ),
    ).toThrow("locked");
    performDemoAction(
      state,
      "updateClass",
      { id: c.id, operation: "rotate" },
      ctx("teacher"),
    );
    expect(() =>
      performDemoAction(
        state,
        "joinClass",
        { code: "ORBIT1", nickname: "Moon Scout" },
        ctx(),
      ),
    ).toThrow("invalid");
    performDemoAction(
      state,
      "updateClass",
      { id: c.id, operation: "archive" },
      ctx("teacher"),
    );
    expect(c.is_active).toBe(false);
  });
  it("creates a classroom with custom conditions and enforces its deadline", () => {
    const c = performDemoAction(
      state,
      "createClass",
      {
        settings: {
          name: "Flood Lab",
          mission_slug: "houston",
          budget_m: 200,
          mass_kg: 450,
          max_attempts: 2,
          deadline: "2026-11-14T22:00:00.000Z",
        },
      },
      ctx("teacher"),
    ) as { join_code: string };
    expect(() =>
      performDemoAction(
        state,
        "joinClass",
        { code: c.join_code, nickname: "Scout" },
        ctx(),
      ),
    ).toThrow("expired");
  });
  it("protects teacher operations during student roleplay and revokes removed membership", () => {
    expect(() =>
      performDemoAction(state, "students", { id: demoClassId }, ctx()),
    ).toThrow("teacher");
    performDemoAction(
      state,
      "joinClass",
      { code: "ORBIT1", nickname: "Moon Scout" },
      ctx(),
    );
    performDemoAction(
      state,
      "removeStudent",
      { id: demoClassId, userId: "demo-student" },
      ctx("teacher"),
    );
    expect(() =>
      performDemoAction(state, "classroom", { id: demoClassId }, ctx()),
    ).toThrow("Join");
  });
  it("keeps class scores separate, requires nickname opt-in for solo scores, and omits user IDs", () => {
    const input = {
      missionSlug: "phoenix",
      design: defaultDesign,
      requestId: "solo-1",
    };
    performDemoAction(state, "attempt", input, ctx());
    expect(
      performDemoAction(state, "ranking", { missionSlug: "phoenix" }, ctx()),
    ).toEqual([]);
    performDemoAction(state, "setNickname", { nickname: "Moon Scout" }, ctx());
    const ranking = performDemoAction(
      state,
      "ranking",
      { missionSlug: "phoenix" },
      ctx(),
    ) as Record<string, unknown>[];
    expect(ranking).toHaveLength(1);
    expect(ranking[0].nickname).toBe("Moon Scout");
    expect(ranking[0]).not.toHaveProperty("user_id");
    performDemoAction(state, "setNickname", { nickname: null }, ctx());
    expect(
      performDemoAction(state, "ranking", { missionSlug: "phoenix" }, ctx()),
    ).toEqual([]);
  });
});
