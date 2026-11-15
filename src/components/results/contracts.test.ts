import { describe, it, expect } from "vitest";
import { classSchema, designSchema, nicknameSchema } from "./contracts";
import { defaultDesign } from "./missions";
describe("classroom inputs", () => {
  it("accepts anonymous nicknames and rejects emails, code injection, and filtered words", () => {
    expect(nicknameSchema.safeParse("Orbit Explorer").success).toBe(true);
    for (const s of ["a", "kid@example.com", "<script>", "shithead"])
      expect(nicknameSchema.safeParse(s).success).toBe(false);
  });
  it("rejects invalid budgets, mission names, deadlines, and attempts", () => {
    const valid = {
      name: "Science",
      mission_slug: "houston",
      budget_m: 250,
      mass_kg: 500,
      max_attempts: 3,
      deadline: null,
    };
    expect(classSchema.safeParse(valid).success).toBe(true);
    for (const patch of [
      { budget_m: -1 },
      { max_attempts: 0 },
      { mission_slug: "unknown" },
      { deadline: "yesterday" },
    ])
      expect(classSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
  });
  it("does not accept client-supplied scores or invalid designs", () => {
    expect(designSchema.safeParse(defaultDesign).success).toBe(true);
    expect(
      designSchema.safeParse({ ...defaultDesign, score: 100 }).success,
    ).toBe(false);
    expect(
      designSchema.safeParse({ ...defaultDesign, groundStations: 999 }).success,
    ).toBe(false);
  });
  it("accepts mission decisions strictly", () => {
    const decisions = {
      focus: "hazard",
      downlink: "save-power",
      retask: { day: 2, quadrant: "ne" },
    };
    expect(
      designSchema.safeParse({ ...defaultDesign, decisions }).success,
    ).toBe(true);
    expect(
      designSchema.safeParse({ ...defaultDesign, decisions: {} }).success,
    ).toBe(true);
    for (const bad of [
      { focus: "everywhere" },
      { downlink: "instant" },
      { retask: { day: 1.5, quadrant: "ne" } },
      { retask: { day: 31, quadrant: "ne" } },
      { retask: { day: -1, quadrant: "ne" } },
      { retask: { day: 1, quadrant: "north" } },
      { retask: { day: 1, quadrant: "ne", boost: 9 } },
      { focus: "wide", score: 100 },
    ])
      expect(
        designSchema.safeParse({ ...defaultDesign, decisions: bad }).success,
      ).toBe(false);
  });
});
