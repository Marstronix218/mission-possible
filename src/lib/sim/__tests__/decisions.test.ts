import { describe, expect, it } from "vitest";

import { allMissions, getMissionBySlug } from "../../missions/registry";
import type { Mission, SatelliteDesign, SimResult } from "../../../types/game";
import { runSimulation } from "..";
import { snapshotDesigns } from "./baseline-helpers";

const thermal = snapshotDesigns.thermal;
const radar = snapshotDesigns.radar;
const losAngeles = getMissionBySlug("los-angeles")!;
const houston = getMissionBySlug("houston")!;
const hilo = getMissionBySlug("hilo")!;
const run = (mission: Mission, design: SatelliteDesign, decisions?: SatelliteDesign["decisions"]): SimResult =>
  runSimulation(mission, { ...design, decisions }, mission.defaultConstraints);
const totalLooks = (result: SimResult, filter: (index: number) => boolean = () => true): number =>
  result.cells.reduce((sum, cell, index) => sum + (filter(index) ? cell.lookHours!.length : 0), 0);

describe("diagnostics and per-cell timing", () => {
  it.each(allMissions.map((mission) => [mission.slug, mission] as const))(
    "%s: diagnostics add up and agree with cells and score",
    (_slug, mission) => {
      const result = run(mission, thermal);
      if (!result.diagnostics) {
        expect(result.score.total).toBe(0);
        return;
      }
      const d = result.diagnostics;
      const hazard = result.cells.filter((cell) => cell.truth > 0.5);
      expect(d.hazardCells).toBe(hazard.length);
      expect(d.hazardDetected + d.hazardNeverInView + d.hazardCloudBlocked + d.hazardNotRecognised + d.hazardBeforeEvent)
        .toBe(d.hazardCells);
      expect(hazard.filter((cell) => cell.missReason === undefined)).toHaveLength(d.hazardDetected);
      expect(result.cells.filter((cell) => cell.observed)).toHaveLength(d.observedCells);
      expect(result.score.coverage).toBe(Math.round((1000 * d.observedCells) / d.totalCells) / 10);
      expect(Object.values(d.weights).reduce((sum, weight) => sum + weight, 0)).toBe(100);
      expect(d.decisions).toEqual({ focus: "wide", downlink: "standard" });
      for (const cell of result.cells) {
        const looks = cell.lookHours!;
        const blocked = cell.blockedHours!;
        expect(looks).toEqual([...looks].sort((a, b) => a - b));
        expect(blocked.every((hour) => looks.includes(hour))).toBe(true);
        // observed means at least one clear (unblocked) look.
        expect(cell.observed).toBe(looks.length > blocked.length);
        if (cell.detected) expect(looks).toContain(cell.detectedHour);
        else expect(cell.detectedHour).toBeNull();
        if (cell.missReason === "never-in-view") expect(looks).toHaveLength(0);
        if (cell.missReason === "cloud-blocked") expect(blocked.length).toBe(looks.length);
        if (cell.truth <= 0.5) expect(cell.missReason).toBeUndefined();
      }
      if (result.firstDeliveryHours !== null) {
        expect(result.firstDeliveryHours).toBeCloseTo(d.firstDetectionHours! + d.downlinkLatencyHours, 0);
        const detectedHazardHours = hazard.filter((cell) => !cell.missReason).map((cell) => cell.detectedHour!);
        expect(Math.min(...detectedHazardHours)).toBe(d.firstDetectionHours);
      } else {
        expect(d.firstDetectionHours).toBeNull();
      }
    },
  );

  it("reports no diagnostics for a design that cannot launch", () => {
    const result = run(houston, { ...radar, solar: "solar_s" });
    expect(result.diagnostics).toBeUndefined();
  });
});

describe("mission decisions", () => {
  it("are deterministic", () => {
    const decisions = { focus: "hazard", downlink: "fast", retask: { day: 2, quadrant: "nw" } } as const;
    expect(run(losAngeles, thermal, decisions)).toEqual(run(losAngeles, thermal, decisions));
  });

  it("focus hazard trades regional coverage for more looks at danger zones", () => {
    const wide = run(losAngeles, thermal);
    const focused = run(losAngeles, thermal, { focus: "hazard" });
    const isHazard = (index: number) => losAngeles.grid[index].truth > 0.5;
    expect(focused.diagnostics!.decisions.focus).toBe("hazard");
    expect(totalLooks(focused, isHazard)).toBeGreaterThan(totalLooks(wide, isHazard));
    expect(totalLooks(focused, (index) => !isHazard(index))).toBeLessThan(totalLooks(wide, (index) => !isHazard(index)));
    expect(focused.score.coverage).toBeLessThan(wide.score.coverage);
    expect(focused.diagnostics!.hazardDetected).toBeGreaterThanOrEqual(wide.diagnostics!.hazardDetected);
  });

  it("fast downlink lowers latency but costs battery; save-power does the reverse", () => {
    const standard = run(houston, radar).diagnostics!;
    const fast = run(houston, radar, { downlink: "fast" }).diagnostics!;
    const save = run(houston, radar, { downlink: "save-power" }).diagnostics!;
    expect(fast.downlinkLatencyHours).toBeLessThan(standard.downlinkLatencyHours);
    expect(save.downlinkLatencyHours).toBeGreaterThan(standard.downlinkLatencyHours);
    expect(fast.batteryContinuity).toBeLessThan(standard.batteryContinuity);
    expect(save.batteryContinuity).toBeGreaterThan(standard.batteryContinuity);
    expect(fast.operationFactor).toBeLessThan(standard.operationFactor);
    expect(save.operationFactor).toBeGreaterThan(standard.operationFactor);
    expect(fast.reliabilityFactor).toBeLessThan(standard.reliabilityFactor);
    expect(save.reliabilityFactor).toBeGreaterThan(standard.reliabilityFactor);
  });

  it("retask boosts looks in the chosen quadrant from its day on (row 0 is south)", () => {
    const base = run(losAngeles, thermal);
    const retasked = run(losAngeles, thermal, { retask: { day: 1, quadrant: "nw" } });
    const nw = (index: number) => losAngeles.grid[index].row >= 10 && losAngeles.grid[index].column < 10;
    expect(totalLooks(retasked, nw)).toBeGreaterThan(totalLooks(base, nw));
    expect(totalLooks(retasked, (index) => !nw(index))).toBeLessThan(totalLooks(base, (index) => !nw(index)));
    // Nothing changes before the retask day.
    const day0 = (result: SimResult) => result.cells.map((cell) => cell.lookHours!.filter((hour) => hour < 24));
    expect(day0(retasked)).toEqual(day0(base));
  });

  it("retask reopens cells checked before a late hazard (Hilo lava flow)", () => {
    const base = run(hilo, thermal).diagnostics!;
    const retasked = run(hilo, thermal, { retask: { day: 6, quadrant: "se" } }).diagnostics!;
    expect(retasked.hazardBeforeEvent).toBeLessThan(base.hazardBeforeEvent);
    expect(retasked.hazardDetected).toBeGreaterThan(base.hazardDetected);
  });

  it("has no option that wins on every mission", () => {
    const options: SatelliteDesign["decisions"][] = [
      undefined,
      { focus: "hazard" },
      { downlink: "fast" },
      { downlink: "save-power" },
    ];
    const wins = options.map(() => 0);
    for (const slug of ["los-angeles", "phoenix", "houston", "hilo", "salt-lake-city", "miami"]) {
      const mission = getMissionBySlug(slug)!;
      const design = slug === "houston" ? radar : slug === "salt-lake-city" || slug === "miami" ? snapshotDesigns.microwave : thermal;
      const totals = options.map((decisions) => run(mission, design, decisions).score.total);
      wins[totals.indexOf(Math.max(...totals))] += 1;
    }
    expect(wins.filter((count) => count > 0).length).toBeGreaterThan(1);
  });
});
