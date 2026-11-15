import { describe, expect, it } from "vitest";
import {
  defaultRankingDifficulty,
  difficultyOf,
  isDifficulty,
} from "./difficulty";

const defaults = { budgetM: 200, massKg: 400 };
const tier = (budgetM: number, massKg: number) =>
  difficultyOf({ budgetM, massKg }, defaults);

describe("difficultyOf", () => {
  it("is standard at the defaults and within 5%", () => {
    expect(tier(200, 400)).toBe("standard");
    expect(tier(190, 420)).toBe("standard");
    expect(tier(210, 380)).toBe("standard");
  });
  it("treats missing constraints (legacy attempts) as the defaults", () => {
    expect(difficultyOf(null, defaults)).toBe("standard");
    expect(difficultyOf(undefined, defaults)).toBe("standard");
  });
  it("is tight when a limit drops below 90% and none is loosened", () => {
    expect(tier(179, 400)).toBe("tight");
    expect(tier(200, 300)).toBe("tight");
    expect(tier(100, 200)).toBe("tight");
    expect(tier(150, 420)).toBe("tight");
  });
  it("is relaxed at 115% or more with nothing tightened", () => {
    expect(tier(230, 400)).toBe("relaxed");
    expect(tier(200, 460)).toBe("relaxed");
    expect(tier(400, 800)).toBe("relaxed");
    expect(tier(230, 380)).toBe("relaxed");
  });
  it("is custom for mixed or in-between conditions", () => {
    expect(tier(150, 600)).toBe("custom"); // tighter budget, looser mass
    expect(tier(220, 400)).toBe("custom"); // +10%: neither standard nor relaxed
    expect(tier(185, 400)).toBe("custom"); // −7.5%: neither standard nor tight
  });
  it("is exact at the band edges (no floating-point drift)", () => {
    expect(tier(180, 400)).toBe("custom"); // exactly 90% is not below 90%
    expect(tier(190, 400)).toBe("standard"); // exactly 95%
    expect(tier(210, 400)).toBe("standard"); // exactly 105%
    expect(tier(230, 400)).toBe("relaxed"); // exactly 115%
    expect(
      difficultyOf(
        { budgetM: 0.3 * 700, massKg: 450 },
        { budgetM: 220, massKg: 450 },
      ),
    ).toBe("standard");
  });
  it("preserves decimal values immediately beside a tier boundary", () => {
    expect(
      difficultyOf(
        { budgetM: 197.999999999, massKg: 450 },
        { budgetM: 220, massKg: 450 },
      ),
    ).toBe("tight");
    expect(
      difficultyOf(
        { budgetM: 253 - 1e-9, massKg: 450 },
        { budgetM: 220, massKg: 450 },
      ),
    ).toBe("custom");
    expect(
      difficultyOf(
        { budgetM: 0.000000000115, massKg: 450 },
        { budgetM: 0.0000000001, massKg: 450 },
      ),
    ).toBe("relaxed");
  });
  it("uses the class conditions for class boards and standard otherwise", () => {
    expect(defaultRankingDifficulty(defaults)).toBe("standard");
    expect(
      defaultRankingDifficulty(defaults, { budget_m: 120, mass_kg: 400 }),
    ).toBe("tight");
    expect(
      defaultRankingDifficulty(defaults, { budget_m: 300, mass_kg: 500 }),
    ).toBe("relaxed");
  });
  it("recognises valid tier names only", () => {
    expect(isDifficulty("tight")).toBe(true);
    expect(isDifficulty("hard")).toBe(false);
    expect(isDifficulty(undefined)).toBe(false);
  });
});
