import { describe, expect, it } from "vitest";
import { buildProgress, type ProgressAttempt } from "./progress";

const defaults = { budgetM: 200, massKg: 400 };
const breakdown = (accuracy: number, coverage: number) => ({
  accuracy,
  responseTime: 50,
  coverage,
  costEfficiency: 60,
  reliability: 70,
  total: 0,
});
let n = 0;
const attempt = (
  score: number,
  over: Partial<ProgressAttempt> = {},
): ProgressAttempt => ({
  id: "a" + ++n,
  missionSlug: "chicago",
  classroomId: null,
  at: `2026-11-1${n}T00:00:00.000Z`,
  score,
  engineVersion: "1.2.0",
  constraints: defaults,
  ...over,
});
const build = (rows: ProgressAttempt[]) =>
  buildProgress(
    rows,
    (slug) => (slug === "unknown" ? undefined : defaults),
    (slug) => (slug === "chicago" ? "Chicago" : slug),
  );

describe("buildProgress", () => {
  it("summarizes missions with best, latest and attempt counts", () => {
    n = 0;
    const p = build([
      attempt(40),
      attempt(55),
      attempt(50),
      attempt(70, { missionSlug: "denver" }),
      attempt(99, { missionSlug: "unknown" }),
    ]);
    expect(p.missionsCompleted).toBe(2);
    expect(p.totalAttempts).toBe(4);
    const chicago = p.missions.find((m) => m.missionSlug === "chicago")!;
    expect(chicago).toMatchObject({ attempts: 3, best: 55, latest: 50 });
    // Most recently played mission first.
    expect(p.missions[0].missionSlug).toBe("denver");
  });
  it("computes deltas and component changes between consecutive attempts", () => {
    n = 0;
    const p = build([
      attempt(40, { breakdown: breakdown(30, 40) }),
      attempt(52.5, { breakdown: breakdown(42, 40) }),
      attempt(50, { breakdown: breakdown(42, 35.5) }),
    ]);
    const points = p.missions[0].groups[0].points;
    expect(points.map((x) => x.delta)).toEqual([null, 12.5, -2.5]);
    expect(points[1].changes).toEqual([{ component: "accuracy", delta: 12 }]);
    expect(points[2].changes).toEqual([{ component: "coverage", delta: -4.5 }]);
    expect(points.map((x) => x.best)).toEqual([false, true, false]);
    const summary = p.missions[0].groups[0].summary;
    expect(summary).toContain(
      "rose from 40.0 to 52.5 (+12.5 points) over 3 attempts",
    );
    expect(summary).toContain("Biggest gain: Accuracy +12.0");
    expect(summary).toContain(
      "2.5 points below the one before; Coverage fell the most",
    );
  });
  it("never compares attempts across difficulty or engine version", () => {
    n = 0;
    const p = build([
      attempt(40),
      attempt(80, { constraints: { budgetM: 120, massKg: 400 } }),
      attempt(60, { engineVersion: "1.1.0" }),
      attempt(45),
    ]);
    const groups = p.missions[0].groups;
    expect(groups).toHaveLength(3);
    const standard = groups.find(
      (g) => g.difficulty === "standard" && g.engineVersion === "1.2.0",
    )!;
    expect(standard.points.map((x) => x.score)).toEqual([40, 45]);
    expect(standard.points[1].delta).toBe(5);
    expect(groups.find((g) => g.difficulty === "tight")!.points).toHaveLength(
      1,
    );
  });
  it("never treats more generous limits within one tier as a design improvement", () => {
    n = 0;
    const p = build([
      attempt(50, { constraints: { budgetM: 300, massKg: 600 } }),
      attempt(90, { constraints: { budgetM: 500, massKg: 900 } }),
      attempt(60, { constraints: { budgetM: 300, massKg: 600 } }),
    ]);
    const groups = p.missions[0].groups;
    expect(groups).toHaveLength(2);
    expect(
      groups
        .find((g) => g.constraints.budgetM === 300)
        ?.points.map((p) => p.delta),
    ).toEqual([null, 10]);
    expect(
      groups.find((g) => g.constraints.budgetM === 500)?.points[0].delta,
    ).toBeNull();
  });
  it("encourages a second attempt and flags a missing breakdown", () => {
    n = 0;
    const p = build([attempt(40), attempt(30)]);
    const g = p.missions[0].groups[0];
    expect(g.points[1].breakdown).toBe(false);
    expect(g.summary).toContain(
      "first Chicago attempt (40.0) is still your best",
    );
    const single = build([attempt(61)]);
    expect(single.missions[0].groups[0].summary).toContain(
      "One Chicago attempt so far",
    );
  });
  it("is empty without attempts", () => {
    expect(build([])).toEqual({
      missionsCompleted: 0,
      totalAttempts: 0,
      missions: [],
    });
  });
});
