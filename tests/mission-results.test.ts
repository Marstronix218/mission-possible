import { describe, expect, it } from "vitest";
import type { SimCellResult, SimResult } from "../src/types/game";
import { runSimulation } from "../src/lib/sim";
import { getMission, defaultDesign } from "../src/components/results/missions";
import { finalCounts } from "../src/components/results/MissionMap";
import {
  advanceHour,
  cellFrame,
  clampToCheckpoint,
  deliveries,
  dueCheckpoint,
  missionCheckpoints,
  missionMoments,
  playbackPlan,
  storageSeries,
} from "../src/components/results/mission-playback";
import { applyDecision } from "../src/components/results/mission-decisions";
import {
  causeLines,
  compareAttempts,
  fixHref,
  stripDecisions,
  winLines,
} from "../src/components/results/mission-debrief";
import {
  missionStars,
  recordAttempt,
  starCount,
} from "../src/components/results/mission-progress";

const mission = getMission("los-angeles")!;
const simulate = () =>
  runSimulation(mission, defaultDesign, mission.defaultConstraints);

describe("engine-backed observation and debrief", () => {
  it("treats a pre-event flag as a false alarm and a missed danger zone", () => {
    const grid = { ...mission.grid[0], truth: 1, eventDay: 2 };
    const cell: SimCellResult = {
      id: grid.id,
      truth: 1,
      observed: true,
      detected: true,
      lookHours: [4],
      blockedHours: [],
      detectedHour: 4,
      missReason: "before-event",
    };
    const result = { ...simulate(), cells: [cell], firstDeliveryHours: null };
    expect(cellFrame(grid, cell, 4, 120)).toMatchObject({
      hazardActive: false,
      flagged: true,
      falseAlarm: true,
    });
    expect(cellFrame(grid, cell, 100, 120)).toMatchObject({
      hazardActive: true,
      falseAlarm: true,
    });
    expect(finalCounts(result)).toMatchObject({
      found: 0,
      falseAlarm: 1,
      "before-event": 1,
    });
    expect(deliveries(result, 2)).toEqual([]);
    const moments = missionMoments(
      { ...mission, grid: [grid] },
      result,
      [],
      10,
      { values: [0], capacityGB: 10, stepHours: 1, fullAtHour: null },
    );
    expect(
      moments.some((m) => m.kind === "detect" || m.kind === "delivery"),
    ).toBe(false);
    expect(
      compareAttempts({ result, costM: 1 }, { result, costM: 1 }).find(
        (r) => r.id === "found",
      )?.after,
    ).toBe("0");
  });

  it("shows clouds and detections only at the recorded pass hour", () => {
    const grid = { ...mission.grid[0], truth: 1, eventDay: 0 };
    const cell: SimCellResult = {
      id: grid.id,
      truth: 1,
      observed: true,
      detected: true,
      lookHours: [2, 5],
      blockedHours: [2],
      detectedHour: 5,
    };
    expect(cellFrame(grid, cell, 1, 120)).toMatchObject({
      seen: false,
      flagged: false,
      lastLookAge: null,
    });
    expect(cellFrame(grid, cell, 2, 120)).toMatchObject({
      seen: false,
      flagged: false,
      lastLookBlocked: true,
    });
    expect(cellFrame(grid, cell, 5, 120)).toMatchObject({
      seen: true,
      flagged: true,
      falseAlarm: false,
    });
    expect(deliveries({ ...simulate(), cells: [cell] }, 3)).toEqual([
      { cellId: grid.id, detectedHour: 5, deliveredHour: 8 },
    ]);
  });

  it("pauses at unanswered decisions even when stepping over them", () => {
    const checkpoints = missionCheckpoints({
      day: 2,
      quadrant: "ne",
      reason: "new-hazard",
      cells: 3,
    });
    const answered = new Set<"focus" | "downlink" | "retask">();
    expect(dueCheckpoint(checkpoints, answered, 0)?.id).toBe("focus");
    expect(clampToCheckpoint(checkpoints, answered, 0, 120)).toBe(0);
    answered.add("focus");
    answered.add("downlink");
    expect(clampToCheckpoint(checkpoints, answered, 0, 120)).toBe(48);
    answered.add("retask");
    const plan = playbackPlan(mission, simulate());
    expect(advanceHour(plan, 0, 1000)).toBe(plan.spanHours);
    expect(clampToCheckpoint(checkpoints, answered, 48, 120)).toBe(120);
  });

  it("applies the player's choices to the same deterministic design passed to the engine", () => {
    let decisions = applyDecision({}, "focus", "hazard", null);
    decisions = applyDecision(decisions, "downlink", "fast", null);
    decisions = applyDecision(decisions, "retask", "retask", {
      day: 1,
      quadrant: "nw",
      reason: "unfound",
      cells: 3,
    });
    const design = { ...defaultDesign, decisions };
    const result = runSimulation(mission, design, mission.defaultConstraints);
    expect(result.diagnostics?.decisions).toEqual(decisions);
    expect(result).toEqual(
      runSimulation(mission, design, mission.defaultConstraints),
    );
    expect(result.diagnostics?.downlinkLatencyHours).toBeLessThan(
      simulate().diagnostics!.downlinkLatencyHours,
    );
    expect(result.cells).not.toEqual(simulate().cells);
    expect(stripDecisions(design)).toEqual(defaultDesign);
    expect(fixHref(mission.slug, ["comm", "orbit"], "class-1")).toBe(
      "/mission/los-angeles/design?fix=comm,orbit&classroom=class-1",
    );
  });

  it("describes measured lateness without assigning an unproven part failure", () => {
    const result = simulate();
    const d = result.diagnostics!;
    const late: SimResult = {
      ...result,
      firstDeliveryHours: mission.targetResponseHours + 2,
      diagnostics: {
        ...d,
        firstDetectionHours: mission.targetResponseHours,
        downlinkLatencyHours: 2,
      },
    };
    const line = causeLines(mission, defaultDesign, late).find(
      (l) => l.id === "late",
    )!;
    expect(line.text).toBe("Data arrived 2 h after the deadline.");
    expect(line.detail).toContain("Downlink added 2 h");
    expect(line.text).not.toMatch(/slow radio|too few ground stations/);
    const all = [
      ...causeLines(mission, defaultDesign, result),
      ...winLines(mission, defaultDesign, result),
    ]
      .map((l) => l.text)
      .join(" ");
    expect(all).not.toMatch(
      /sensors had to pause|some was lost|Saw right through|Battery gave out/,
    );
  });

  it("keeps legacy results readable without inventing missing diagnostics", () => {
    const result = simulate();
    delete result.diagnostics;
    expect(() => causeLines(mission, defaultDesign, result)).not.toThrow();
    expect(() => winLines(mission, defaultDesign, result)).not.toThrow();
    const cell = { id: "legacy", truth: 1, observed: true, detected: true };
    expect(
      cellFrame({ ...mission.grid[0], truth: 1 }, cell, 1, 120).flagged,
    ).toBe(false);
    expect(
      cellFrame({ ...mission.grid[0], truth: 1 }, cell, 120, 120).flagged,
    ).toBe(true);
  });

  it("bounds the illustrative storage estimate by capacity", () => {
    const series = storageSeries(
      { dataGBPerDay: 100, storageGB: 2 } as Parameters<
        typeof storageSeries
      >[0],
      100,
      12,
      48,
    );
    expect(series.values.every((v) => v >= 0 && v <= 2)).toBe(true);
    expect(series.fullAtHour).not.toBeNull();
  });
});

describe("mission stars and personal progress", () => {
  it.each([
    [false, 99, 0],
    [true, 60, 1],
    [true, 69.9, 1],
    [true, 70, 2],
    [true, 89.9, 2],
    [true, 90, 3],
  ] as const)(
    "success=%s, score=%s earns %s stars",
    (success, total, stars) => {
      const result = simulate();
      result.success = success;
      result.score.total = total;
      expect(starCount(missionStars(mission, result))).toBe(stars);
    },
  );
  it("records a personal best and celebration only once per attempt", () => {
    const attempt = {
      id: "one",
      score: 80,
      stars: 2,
      deliveryHours: 4,
      challenges: ["speed" as const],
    };
    const first = recordAttempt(undefined, attempt);
    expect(first.newStars).toBe(true);
    const repeat = recordAttempt(first.entry, attempt);
    expect(repeat).toMatchObject({
      firstView: false,
      newBest: false,
      newStars: false,
      newChallenges: [],
    });
    const better = recordAttempt(first.entry, {
      ...attempt,
      id: "two",
      score: 90,
      stars: 3,
    });
    expect(better.newBest).toBe(true);
    expect(better.entry.bestAttemptId).toBe("two");
  });
});
