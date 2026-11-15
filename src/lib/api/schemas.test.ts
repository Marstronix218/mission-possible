import { describe, expect, it } from "vitest";
import { createAttemptSchema } from "./schemas";
import { safeRedirectPath } from "./redirect";
const input = {
  missionSlug: "los-angeles",
  design: {
    instruments: ["tir"],
    orbit: "sso_700",
    solar: "solar_m",
    battery: "battery_m",
    comm: "x_band",
    groundStations: 3,
    storage: "storage_128",
  },
};
describe("attempt boundary", () => {
  it("accepts design input", () =>
    expect(createAttemptSchema.safeParse(input).success).toBe(true));
  it.each(["score", "userId", "constraints", "classroomId"])(
    "rejects client-controlled %s",
    (key) =>
      expect(
        createAttemptSchema.safeParse({ ...input, [key]: 100 }).success,
      ).toBe(false),
  );
  it("rejects duplicate sensors and invalid ground stations", () => {
    expect(
      createAttemptSchema.safeParse({
        ...input,
        design: { ...input.design, instruments: ["tir", "tir"] },
      }).success,
    ).toBe(false);
    expect(
      createAttemptSchema.safeParse({
        ...input,
        design: { ...input.design, groundStations: 2 },
      }).success,
    ).toBe(false);
  });
});
describe("mission decisions boundary", () => {
  it("accepts valid decisions and passes them through unchanged", () => {
    const decisions = {
      focus: "hazard",
      downlink: "fast",
      retask: { day: 1, quadrant: "sw" },
    };
    const parsed = createAttemptSchema.safeParse({
      ...input,
      design: { ...input.design, decisions },
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.design.decisions).toEqual(decisions);
  });
  it.each([
    { focus: "all" },
    { downlink: "turbo" },
    { retask: { day: 0.5, quadrant: "nw" } },
    { retask: { day: 31, quadrant: "nw" } },
    { retask: { quadrant: "nw" } },
    { retask: { day: 1, quadrant: "centre" } },
    { scoreBonus: 10 },
  ])("rejects invalid decisions %j", (decisions) =>
    expect(
      createAttemptSchema.safeParse({
        ...input,
        design: { ...input.design, decisions },
      }).success,
    ).toBe(false),
  );
});
describe("auth redirect boundary", () => {
  it.each([
    "https://example.com",
    "//example.com",
    "/\\example.com",
    "/\n/example.com",
    null,
  ])("rejects unsafe target %s", (target) =>
    expect(safeRedirectPath(target)).toBe("/"),
  );
  it("preserves local paths", () =>
    expect(safeRedirectPath("/teacher?view=classes")).toBe(
      "/teacher?view=classes",
    ));
});
