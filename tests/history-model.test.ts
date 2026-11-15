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
  it("accepts the UTC offset timestamp returned by Supabase history", () => {
    const a = attempt("remote", "2026-11-14T20:00:00+00:00");
    expect(parseSavedAttempts(JSON.stringify([a]))).toHaveLength(1);
  });
  it("retains diagnostics, decisions and all per-pass fields exactly", () => {
    const a = attempt("new", "2026-11-14T20:00:00.000Z");
    a.design = {
      ...a.design,
      decisions: {
        focus: "hazard",
        downlink: "fast",
        retask: { day: 1, quadrant: "ne" },
      },
    };
    const mission = getMission(a.slug)!;
    a.result = runSimulation(mission, a.design, a.constraints);
    expect(a.result.diagnostics).toBeDefined();
    expect(a.result.cells.some((c) => c.lookHours?.length)).toBe(true);
    expect(parseSavedAttempts(JSON.stringify([a]))[0]).toEqual(a);
  });
  it("accepts older snapshots with neither diagnostics nor per-pass timing", () => {
    const a = attempt("old", "2026-11-14T20:00:00.000Z");
    delete a.result.diagnostics;
    a.result.cells = a.result.cells.map(
      ({ id, truth, observed, detected }) => ({
        id,
        truth,
        observed,
        detected,
      }),
    );
    expect(parseSavedAttempts(JSON.stringify([a]))[0]).toEqual(a);
  });
  it("rejects malformed diagnostic objects before they can reach the debrief", () => {
    const a = attempt("bad", "2026-11-14T20:00:00.000Z");
    for (const diagnostics of [
      { hazardCells: 1, weights: null },
      { ...a.result.diagnostics, decisions: null },
      { ...a.result.diagnostics, downlinkLatencyHours: -1 },
      { ...a.result.diagnostics, bestInstrumentFit: 2 },
      { ...a.result.diagnostics, hazardDetected: 9999 },
      { ...a.result.diagnostics, weights: { accuracy: 100 } },
    ]) {
      expect(
        parseSavedAttempts(
          JSON.stringify([{ ...a, result: { ...a.result, diagnostics } }]),
        ),
      ).toEqual([]);
    }
    const cells = [{ ...a.result.cells[0], lookHours: [-1] }];
    expect(
      parseSavedAttempts(
        JSON.stringify([{ ...a, result: { ...a.result, cells } }]),
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
