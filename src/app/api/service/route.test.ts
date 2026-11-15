import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: { table: string; op: string; args: unknown[] }[] = [];
let classRow: Record<string, unknown> | null = null;
let attemptRow: Record<string, unknown> | null = null;
const userId = "11111111-1111-4111-8111-111111111111";
const attemptId = "22222222-2222-4222-8222-222222222222";

function builder(table: string) {
  const result = () =>
    table === "attempts"
      ? { data: attemptRow, error: null }
      : { data: table === "classrooms" ? classRow : null, error: null };
  const b: Record<string, unknown> = {};
  for (const op of ["select", "eq", "is", "in", "order", "limit", "update"])
    b[op] = (...args: unknown[]) => {
      calls.push({ table, op, args });
      return b;
    };
  b.maybeSingle = async () => result();
  b.single = async () => result();
  b.then = (resolve: (v: unknown) => unknown) => resolve(result());
  return b;
}
const db = {
  from: (table: string) => builder(table),
  rpc: vi.fn(async () => ({
    data: [
      {
        user_id: "other",
        nickname: "Nova",
        score: 90,
        attempts: 1,
        improvement: 0,
        achieved: "2026-11-14T00:00:00Z",
      },
      {
        user_id: userId,
        nickname: "Pilot Kai",
        score: 70,
        attempts: 2,
        improvement: 3,
        achieved: "2026-11-14T01:00:00Z",
      },
    ],
    error: null,
  })),
};

vi.mock("@/lib/data-mode", () => ({ isMockMode: false }));
vi.mock("@/lib/backend", () => {
  class HttpError extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
    }
  }
  return {
    HttpError,
    identity: async () => ({ db, user: { id: userId } }),
    check: (error: { message: string } | null) => {
      if (error) throw new HttpError(400, error.message);
    },
  };
});

const { POST } = await import("./route");
const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/service", {
      method: "POST",
      headers: { authorization: "Bearer test" },
      body: JSON.stringify(body),
    }),
  );

beforeEach(() => {
  classRow = null;
  calls.length = 0;
  db.rpc.mockClear();
  attemptRow = {
    id: attemptId,
    mission_slug: "los-angeles",
    classroom_id: null,
    score_total: 64,
    engine_version: "old",
  };
});

describe("submitScore action", () => {
  it("publishes the caller's own attempt and ranks it without user IDs", async () => {
    const response = await post({
      action: "submitScore",
      attemptId,
      nickname: "Pilot Kai",
      score: 100,
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.me).toEqual({ rank: 2, nickname: "Pilot Kai", score: 70 });
    expect(body.attempt.score).toBe(64);
    expect(JSON.stringify(body)).not.toContain(userId);
    expect(calls).toContainEqual({
      table: "attempts",
      op: "eq",
      args: ["user_id", userId],
    });
    expect(calls).toContainEqual({
      table: "profiles",
      op: "update",
      args: [{ nickname: "Pilot Kai" }],
    });
    expect(db.rpc).toHaveBeenCalledWith(
      "mission_ranking_scoped",
      expect.objectContaining({
        p_slug: "los-angeles",
        p_class: null,
        p_difficulty: "standard",
        p_default_budget: 220,
        p_default_mass: 450,
        p_user: userId,
      }),
    );
    expect(body.scope).toEqual({
      missionSlug: "los-angeles",
      difficulty: "standard",
      engineVersion: expect.any(String),
      constraints: { budgetM: 220, massKg: 450 },
    });
  });
  it.each([undefined, "Public Pilot"])(
    "class nickname stays separate from explicit public opt-in %s",
    async (nickname) => {
      classRow = {
        id: attemptId,
        teacher_id: userId,
        mission_slug: "los-angeles",
        budget_m: 150,
        mass_kg: 450,
      };
      attemptRow = {
        ...attemptRow,
        classroom_id: attemptId,
        constraints: { budgetM: 150, massKg: 450 },
      };
      const response = await post({
        action: "submitScore",
        attemptId,
        ...(nickname ? { nickname } : {}),
      });
      expect(response.status).toBe(200);
      expect(
        calls.filter((c) => c.table === "profiles" && c.op === "update"),
      ).toEqual(
        nickname
          ? [{ table: "profiles", op: "update", args: [{ nickname }] }]
          : [],
      );
      expect(db.rpc).toHaveBeenCalledWith(
        "mission_ranking_scoped",
        expect.objectContaining({ p_budget: 150, p_mass: 450 }),
      );
    },
  );
  it("returns 404 when the attempt is not the caller's saved attempt", async () => {
    attemptRow = null;
    const response = await post({
      action: "submitScore",
      attemptId,
      nickname: "Pilot Kai",
    });
    expect(response.status).toBe(404);
    expect(calls.some((c) => c.table === "profiles")).toBe(false);
  });
  it.each([
    { attemptId: "not-a-uuid", nickname: "Pilot Kai" },
    { attemptId, nickname: "kid@example.com" },
    { attemptId, nickname: "x" },
  ])("rejects invalid input %j", async (input) => {
    const response = await post({ action: "submitScore", ...input });
    expect(response.status).toBe(400);
  });
  it("requires a pilot name for solo attempts", async () => {
    const response = await post({ action: "submitScore", attemptId });
    expect(response.status).toBe(400);
  });
});

describe("ranking action", () => {
  it.each([
    { missionSlug: "atlantis" },
    { missionSlug: "los-angeles", difficulty: "insane" },
    { missionSlug: "los-angeles", classroomId: "class-1" },
  ])("rejects invalid filters %j", async (input) => {
    const response = await post({ action: "ranking", ...input });
    expect(response.status).toBe(400);
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it("ranks one mission + difficulty + engine scope without user IDs", async () => {
    db.rpc.mockResolvedValueOnce({
      data: [
        {
          user_id: "other",
          nickname: "Nova",
          score: 90,
          attempts: 1,
          improvement: 0,
          achieved: "2026-11-14T00:00:00Z",
          rank: 1,
          players: 250,
        },
        {
          user_id: userId,
          nickname: "Pilot Kai",
          score: 20,
          attempts: 2,
          improvement: 3,
          achieved: "2026-11-14T01:00:00Z",
          rank: 240,
          players: 250,
        },
      ],
      error: null,
    } as never);
    const response = await post({
      action: "ranking",
      missionSlug: "phoenix",
      difficulty: "tight",
    });
    expect(response.status).toBe(200);
    const rows = await response.json();
    expect(db.rpc).toHaveBeenCalledWith("mission_ranking_scoped", {
      p_slug: "phoenix",
      p_class: null,
      p_engine: expect.any(String),
      p_default_budget: 180,
      p_default_mass: 380,
      p_difficulty: "tight",
      p_budget: 180,
      p_mass: 380,
      p_user: userId,
    });
    expect(rows[1]).toMatchObject({ entry_id: 240, players: 250, mine: true });
    expect(JSON.stringify(rows)).not.toContain(userId);
  });
  it("passes exact caller-selected limits separately from the tier", async () => {
    await post({
      action: "ranking",
      missionSlug: "los-angeles",
      difficulty: "relaxed",
      constraints: { budgetM: 440, massKg: 900 },
    });
    expect(db.rpc).toHaveBeenCalledWith(
      "mission_ranking_scoped",
      expect.objectContaining({
        p_difficulty: "relaxed",
        p_budget: 440,
        p_mass: 900,
      }),
    );
  });
  it("defaults the global board to standard conditions", async () => {
    await post({ action: "ranking", missionSlug: "los-angeles" });
    expect(db.rpc).toHaveBeenCalledWith(
      "mission_ranking_scoped",
      expect.objectContaining({ p_difficulty: "standard" }),
    );
  });
});

describe("ranking condition discovery", () => {
  it("returns only numeric limits for the chosen mission, tier and current engine", async () => {
    db.rpc.mockResolvedValueOnce({
      data: [{ budget_m: 440, mass_kg: 900 }],
      error: null,
    } as never);
    const response = await post({
      action: "rankingConditions",
      missionSlug: "los-angeles",
      difficulty: "relaxed",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([{ budgetM: 440, massKg: 900 }]);
    expect(db.rpc).toHaveBeenCalledWith("mission_ranking_conditions", {
      p_slug: "los-angeles",
      p_engine: expect.any(String),
      p_default_budget: 220,
      p_default_mass: 450,
      p_difficulty: "relaxed",
    });
  });
});

describe("myAttempts action", () => {
  it("reads only the caller's own attempts", async () => {
    attemptRow = [] as never;
    const response = await post({ action: "myAttempts" });
    expect(response.status).toBe(200);
    expect(calls).toContainEqual({
      table: "attempts",
      op: "eq",
      args: ["user_id", userId],
    });
    const select = calls.find(
      (c) => c.table === "attempts" && c.op === "select",
    );
    expect(String(select?.args[0])).not.toContain("user_id");
    expect(String(select?.args[0])).not.toContain("design");
  });
});
