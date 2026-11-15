import { describe, expect, it, vi } from "vitest";
import { createLeaderboardSubmitter } from "./submit";

const body = {
  rows: [],
  me: null,
  attempt: {
    id: "a1",
    missionSlug: "los-angeles",
    classroomId: null,
    score: 50,
    ranked: true,
  },
};

describe("automatic leaderboard submission", () => {
  it("shares one request between concurrent submissions of an attempt", async () => {
    const call = vi.fn().mockResolvedValue(body);
    const submit = createLeaderboardSubmitter(call);
    const [first, second] = await Promise.all([
      submit("a1", "Nova"),
      submit("a1", "Nova"),
    ]);
    expect(call).toHaveBeenCalledTimes(1);
    expect(call).toHaveBeenCalledWith("submitScore", {
      attemptId: "a1",
      nickname: "Nova",
    });
    expect(first).toEqual(second);
  });
  it("never invents public consent for an unnamed class player", async () => {
    const call = vi.fn().mockResolvedValue(body);
    await createLeaderboardSubmitter(call)("a1");
    expect(call).toHaveBeenCalledWith("submitScore", { attemptId: "a1" });
  });
  it("never sends a client score", async () => {
    const call = vi.fn().mockResolvedValue(body);
    await createLeaderboardSubmitter(call)("a1", "Nova");
    expect(Object.keys(call.mock.calls[0][1])).toEqual([
      "attemptId",
      "nickname",
    ]);
  });
  it("allows a retry after a failed submission", async () => {
    const call = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(body);
    const submit = createLeaderboardSubmitter(call);
    await expect(submit("a1", "Nova")).rejects.toThrow("offline");
    await expect(submit("a1", "Nova")).resolves.toMatchObject({
      attempt: { id: "a1" },
    });
    expect(call).toHaveBeenCalledTimes(2);
  });
  it("rejects malformed server responses", async () => {
    const submit = createLeaderboardSubmitter(
      vi.fn().mockResolvedValue({ rows: "nope" }),
    );
    await expect(submit("a1", "Nova")).rejects.toThrow();
  });
});
