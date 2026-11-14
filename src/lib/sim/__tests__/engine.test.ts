import { describe, expect, it, vi } from "vitest";

import houstonJson from "../../../../data/missions/houston.json";
import losAngelesJson from "../../../../data/missions/los-angeles.json";
import phoenixJson from "../../../../data/missions/phoenix.json";
import type { Mission, SatelliteDesign } from "../../../types/game";
import { ENGINE_VERSION, runSimulation, summarizeResources } from "..";

const constraints = { budgetM: 250, massKg: 500 };
const losAngeles = losAngelesJson as unknown as Mission;
const houston = houstonJson as unknown as Mission;
const phoenix = phoenixJson as unknown as Mission;

const thermalDesign: SatelliteDesign = {
  instruments: ["tir"],
  orbit: "sso_700",
  solar: "solar_m",
  battery: "battery_m",
  comm: "x_band",
  groundStations: 3,
  storage: "storage_128",
};

const floodDesign: SatelliteDesign = {
  instruments: ["sar"],
  orbit: "sso_700",
  solar: "solar_l",
  battery: "battery_l",
  comm: "x_band",
  groundStations: 5,
  storage: "storage_512",
};

describe("summarizeResources", () => {
  it("returns a launchable summary for a balanced thermal mission", () => {
    const summary = summarizeResources(thermalDesign, constraints);
    expect(summary.violations).toEqual([]);
    expect(summary.costM).toBeLessThan(constraints.budgetM);
    expect(summary.massKg).toBeLessThan(constraints.massKg);
    expect(summary.powerGenW).toBeGreaterThan(summary.powerUseW);
  });

  it("explains every blocking resource violation", () => {
    const summary = summarizeResources(
      { ...floodDesign, solar: "solar_s", instruments: ["sar", "pr", "grav"] },
      { budgetM: 150, massKg: 300 },
    );
    expect(summary.violations).toContain("Budget limit exceeded.");
    expect(summary.violations).toContain("Mass limit exceeded.");
    expect(summary.violations).toContain("Power demand exceeds solar generation.");
  });

  it("rejects missing and unknown catalog selections", () => {
    const summary = summarizeResources(
      { ...thermalDesign, instruments: [], orbit: "unknown" },
      constraints,
    );
    expect(summary.violations).toContain("Select at least one instrument.");
    expect(summary.violations).toContain("Select a valid orbit.");
  });
});

describe("runSimulation", () => {
  it("is deterministic and does not use Math.random", () => {
    const random = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("Math.random must not be used by the simulation engine");
    });
    const first = runSimulation(losAngeles, thermalDesign, constraints);
    const second = runSimulation(losAngeles, thermalDesign, constraints);
    expect(second).toEqual(first);
    expect(first.engineVersion).toBe(ENGINE_VERSION);
    random.mockRestore();
  });

  it("scores a category-matched sensor above a mismatched sensor", () => {
    const matched = runSimulation(losAngeles, thermalDesign, constraints);
    const mismatched = runSimulation(
      losAngeles,
      { ...thermalDesign, instruments: ["opt_hr"] },
      constraints,
    );
    expect(matched.score.accuracy).toBeGreaterThan(mismatched.score.accuracy);
    expect(matched.score.total).toBeGreaterThan(mismatched.score.total);
  });

  it("keeps every score in the documented 0-100 range", () => {
    const results = [
      runSimulation(losAngeles, thermalDesign, constraints),
      runSimulation(houston, floodDesign, constraints),
      runSimulation(phoenix, thermalDesign, constraints),
    ];
    for (const result of results) {
      for (const value of Object.values(result.score)) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
      expect(result.cells).toHaveLength(400);
      expect(result.feedback.length).toBeGreaterThan(0);
    }
    expect(results.map((result) => result.success)).toEqual([true, true, true]);
  });

  it("returns a zero score and actionable feedback for an invalid design", () => {
    const result = runSimulation(
      houston,
      { ...floodDesign, solar: "solar_s" },
      constraints,
    );
    expect(result.score.total).toBe(0);
    expect(result.success).toBe(false);
    expect(result.feedback.some((item) => item.message.includes("Power"))).toBe(true);
  });
});
