import { describe, it, expect } from "vitest";
import {
  parseSavedAttempts,
  previousComparableAttempt,
  comparableAttempts,
  type SavedAttempt,
} from "../src/components/results/history-model";
import { defaultDesign, getMission } from "../src/components/results/missions";
import { runSimulation } from "../src/lib/sim";
function attempt(id: string, at: string): SavedAttempt {
  const mission = getMission("los-angeles")!;
  return {
    id,
    at,
    slug: mission.slug,
    design: defaultDesign,
    constraints: mission.defaultConstraints,
    result: runSimulation(mission, defaultDesign, mission.defaultConstraints),
    verified: false,
  };
}
describe("saved history snapshots", () => {
  it("preserves the originally stored score and engine version without re-simulation", () => {
    const a = attempt("a", "2026-11-14T20:00:00.000Z");
    a.result.score.total = 12.3;
    a.result.engineVersion = "archived-engine";
    const rows = parseSavedAttempts(JSON.stringify([a]));
    expect(rows[0].result.score.total).toBe(12.3);
    expect(rows[0].result.engineVersion).toBe("archived-engine");
  });
  it("rejects corrupt snapshots and malformed input without inventing results", () => {
    const a = attempt("a", "2026-11-14T20:00:00.000Z");
    expect(parseSavedAttempts("{")).toEqual([]);
    expect(
      parseSavedAttempts(
        JSON.stringify([null, {}, { ...a, result: { score: { total: 999 } } }]),
      ),
    ).toEqual([]);
  });
  it("chooses an older comparable attempt, not a newer or differently constrained attempt", () => {
    const older = attempt("older", "2026-11-14T19:00:00.000Z");
    const selected = attempt("selected", "2026-11-14T20:00:00.000Z");
    const newer = attempt("newer", "2026-11-14T21:00:00.000Z");
    const other = {
      ...older,
      id: "other",
      at: "2026-11-14T19:30:00.000Z",
      constraints: { budgetM: 200, massKg: 500 },
    };
    expect(
      previousComparableAttempt([newer, selected, other, older], selected)?.id,
    ).toBe("older");
    expect(
      comparableAttempts(selected, {
        ...older,
        result: { ...older.result, engineVersion: "2.0.0" },
      }),
    ).toBe(false);
    expect(
      comparableAttempts(selected, { ...older, classroomId: "another-class" }),
    ).toBe(false);
  });
});
