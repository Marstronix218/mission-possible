import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: { table: string; op: string; args: unknown[] }[] = [];
let attemptRow: Record<string, unknown> | null = null;
const userId = "11111111-1111-4111-8111-111111111111";
const attemptId = "22222222-2222-4222-8222-222222222222";

function builder(table: string) {
  const result = () =>
    table === "attempts"
      ? { data: attemptRow, error: null }
      : { data: null, error: null };
  const b: Record<string, unknown> = {};
  for (const op of ["select", "eq", "is", "order", "limit", "update"])
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
      "mission_ranking",
      expect.objectContaining({ p_slug: "los-angeles", p_class: null }),
    );
  });
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
