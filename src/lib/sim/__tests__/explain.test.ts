import { describe, expect, it } from "vitest";

import { allMissions, getMissionBySlug } from "../../missions/registry";
import type { SimResult } from "../../../types/game";
import { categoryRules, explainScore, runSimulation, scoreFormulaText, summarizeResources } from "..";
import { snapshotDesigns } from "./baseline-helpers";

const losAngeles = getMissionBySlug("los-angeles")!;
const houston = getMissionBySlug("houston")!;

describe("explainScore", () => {
  it.each(allMissions.map((mission) => [mission.slug, mission] as const))(
    "%s: weighted points add up to the total and mirror the score",
    (_slug, mission) => {
      const result = runSimulation(mission, snapshotDesigns.thermal, mission.defaultConstraints);
      const explained = explainScore(result, mission);
      expect(explained.map((item) => item.metric)).toEqual([
        "accuracy", "responseTime", "coverage", "costEfficiency", "reliability",
      ]);
      expect(explained.reduce((sum, item) => sum + item.weight, 0)).toBe(100);
      for (const item of explained) {
        expect(item.value).toBe(result.score[item.metric]);
        expect(item.weight).toBe(categoryRules[mission.category].weights[item.metric]);
      }
      const sum = explained.reduce((total, item) => total + item.weightedPoints, 0);
      expect(Math.abs(sum - result.score.total)).toBeLessThanOrEqual(0.3);
    },
  );

  it("builds every reason from diagnostics numbers", () => {
    const result = runSimulation(losAngeles, snapshotDesigns.thermal, losAngeles.defaultConstraints);
    const d = result.diagnostics!;
    const resources = summarizeResources(snapshotDesigns.thermal, losAngeles.defaultConstraints);
    const why = Object.fromEntries(
      explainScore(result, losAngeles, { resources, constraints: losAngeles.defaultConstraints })
        .map((item) => [item.metric, item.why]),
    );
    expect(why.accuracy).toContain(`Found ${d.hazardDetected} of ${d.hazardCells} danger zones.`);
    if (d.hazardNeverInView > 0) expect(why.accuracy).toContain(`${d.hazardNeverInView} never in view`);
    if (d.hazardCloudBlocked === 0) expect(why.accuracy).not.toContain("clouds");
    expect(why.responseTime).toContain(`delivered at hour ${result.firstDeliveryHours}`);
    expect(why.responseTime).toContain(`${d.downlinkLatencyHours} h of downlink`);
    expect(why.coverage).toContain(`${d.observedCells} of ${d.totalCells} cells`);
    expect(why.costEfficiency).toBe(
      `Spent $${resources.costM}M of a $${losAngeles.defaultConstraints.budgetM}M budget.`,
    );
    expect(why.reliability).toContain(`battery through eclipse ${Math.round(d.batteryContinuity * 100)}%`);
  });

  it("explains the cost gate and a run with no alert", () => {
    const result = runSimulation(houston, snapshotDesigns.radar, houston.defaultConstraints);
    const gated: SimResult = {
      ...result,
      score: { ...result.score, accuracy: 10, costEfficiency: 0 },
      firstDeliveryHours: null,
      diagnostics: { ...result.diagnostics!, firstDetectionHours: null },
    };
    const why = Object.fromEntries(explainScore(gated, houston).map((item) => [item.metric, item.why]));
    expect(why.costEfficiency).toContain("must both reach 25");
    expect(why.responseTime).toBe("No danger zone was confirmed, so no alert was delivered.");
  });

  it("never invents a reason when the engine reported none", () => {
    const invalid = runSimulation(houston, { ...snapshotDesigns.radar, solar: "solar_s" }, houston.defaultConstraints);
    const explained = explainScore(invalid, houston);
    expect(explained.every((item) => item.why === null)).toBe(true);
    expect(explained.every((item) => item.weightedPoints === 0)).toBe(true);
  });
});

describe("scoreFormulaText", () => {
  it("lists the category weights", () => {
    expect(scoreFormulaText("wildfire")).toBe(
      "Total = 30% Accuracy + 30% Response time + 20% Coverage + 10% Cost efficiency + 10% Reliability",
    );
  });
});

describe("feedback", () => {
  it("does not claim a repeatedly scanned cell was never rechecked", () => {
    const mission = getMissionBySlug("chicago")!;
    const result = runSimulation(mission, {
      ...snapshotDesigns.thermal,
      decisions: { retask: { day: 4, quadrant: "nw" } },
    }, mission.defaultConstraints);
    const cell = result.cells.find((item) => item.id === "r12c07")!;
    expect(cell.missReason).toBe("before-event");
    expect(cell.lookHours!.filter((hour) => !cell.blockedHours!.includes(hour)).length).toBeGreaterThan(1);
    const feedback = result.feedback.find((item) => item.key === "hazard.before_event");
    expect(feedback?.message).toContain("no clear observation after the hazard started");
    expect(feedback?.message).not.toContain("not rechecked");
  });

  it.each(allMissions.map((mission) => [mission.slug, mission] as const))(
    "%s: only names causes the engine counted",
    (_slug, mission) => {
      const result = runSimulation(mission, snapshotDesigns.thermal, mission.defaultConstraints);
      if (!result.diagnostics) return;
      const d = result.diagnostics;
      const keys = result.feedback.map((item) => item.key);
      expect(new Set(keys).size).toBe(keys.length);
      const byKey = Object.fromEntries(result.feedback.map((item) => [item.key, item]));
      if (byKey["hazard.cloud_blocked"]) {
        expect(d.cloudPenetrating).toBe(false);
        expect(byKey["hazard.cloud_blocked"].params?.count).toBe(d.hazardCloudBlocked);
      }
      if (d.hazardCloudBlocked === 0) expect(keys.some((key) => key.startsWith("hazard.cloud_blocked"))).toBe(false);
      if (byKey["hazard.never_in_view"]) expect(byKey["hazard.never_in_view"].params?.count).toBe(d.hazardNeverInView);
      if (byKey["hazard.not_recognised"]) expect(byKey["hazard.not_recognised"].params?.count).toBe(d.hazardNotRecognised);
      if (byKey["hazard.before_event"]) expect(byKey["hazard.before_event"].params?.count).toBe(d.hazardBeforeEvent);
      if (byKey["accuracy.false_alarms"]) expect(byKey["accuracy.false_alarms"].params?.count).toBe(d.falseAlarms);
      if (byKey["response.delivery"]) {
        expect(byKey["response.delivery"].params?.latencyHours).toBe(d.downlinkLatencyHours);
      }
      for (const item of result.feedback) {
        for (const value of Object.values(item.params ?? {})) expect(Number.isFinite(value)).toBe(true);
      }
    },
  );
});
