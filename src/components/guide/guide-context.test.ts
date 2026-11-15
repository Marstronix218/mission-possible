import { describe, expect, it } from "vitest";
import { summarizeResources } from "@/lib/sim";
import type {
  Category,
  Constraints,
  SatelliteDesign,
  SimDiagnostics,
  SimResult,
} from "@/types/game";
import { allHints, designHint, resultLine } from "./guide-context";

// Catalog numbers (data/parts.json): bus 90 kg / $35M / 45 W.
// tir 45 kg $30M 70 W 10 GB; sso_700 20 kg $15M; solar_m 35 kg $16M 400 W;
// battery_m 30 kg $10M; x_band 18 kg $16M 60 W; storage_128 8 kg $8M 128 GB;
// 3 ground stations $8M. Totals: 246 kg, $138M, 175 W used, 10 GB/day.
const base: SatelliteDesign = {
  instruments: ["tir"],
  orbit: "sso_700",
  solar: "solar_m",
  battery: "battery_m",
  comm: "x_band",
  groundStations: 3,
  storage: "storage_128",
};
const roomy: Constraints = { budgetM: 300, massKg: 1000 };

function input(
  design: SatelliteDesign,
  constraints: Constraints = roomy,
  category: Category = "heat",
  previousDesign?: SatelliteDesign,
) {
  return {
    design,
    constraints,
    category,
    resources: summarizeResources(design, constraints),
    previousDesign: previousDesign ?? null,
    previousResources: previousDesign
      ? summarizeResources(previousDesign, constraints)
      : null,
  };
}

describe("designHint", () => {
  it("stays quiet for a balanced, well-matched design", () => {
    expect(designHint(input(base))).toBeNull();
  });

  it("flags mass with real kg and the heaviest chosen part", () => {
    const hint = designHint(input(base, { budgetM: 300, massKg: 200 }));
    expect(hint?.id).toBe("mass");
    expect(hint?.text).toContain("246 kg");
    expect(hint?.text).toContain("200 kg");
    expect(hint?.text).toContain("Thermal Infrared Sensor (45 kg)");
    expect(designHint(input(base, { budgetM: 300, massKg: 246 }))).toBeNull();
  });

  it("flags power and names the hungriest sensor and the solar array", () => {
    const hint = designHint(
      input({ ...base, instruments: ["sar"] }, roomy, "flood"),
    );
    expect(hint?.id).toBe("power");
    expect(hint?.text).toContain(
      "Synthetic Aperture Radar needs more energy (400 W)",
    );
    expect(hint?.text).toContain("505 W");
    expect(hint?.text).toContain("Medium Solar Array makes 400 W");
    expect(hint?.text).toContain("upgrading your solar panels");
    expect(
      designHint(
        input(
          { ...base, instruments: ["sar"], solar: "solar_l" },
          roomy,
          "flood",
        ),
      ),
    ).toBeNull();
  });

  it("suggests a lighter sensor when no solar array could keep up", () => {
    const hint = designHint(
      input({ ...base, instruments: ["sar", "pr", "lidar"], solar: "solar_l" }),
    );
    expect(hint?.id).toBe("power");
    expect(hint?.text).toContain("905 W");
    expect(hint?.text).toContain("sensor that uses less power");
  });

  it("skips power when no solar array is chosen yet", () => {
    expect(
      allHints(input({ ...base, solar: "" })).map((h) => h.id),
    ).not.toContain("power");
  });

  it("flags budget with the real cost and the priciest part", () => {
    const hint = designHint(input(base, { budgetM: 100, massKg: 1000 }));
    expect(hint?.id).toBe("budget");
    expect(hint?.text).toContain("$138M");
    expect(hint?.text).toContain("$100M");
    expect(hint?.text).toContain(
      "Thermal Infrared Sensor costs the most ($30M)",
    );
    expect(designHint(input(base, { budgetM: 138, massKg: 1000 }))).toBeNull();
  });

  it("asks for a radio only once everything else is on board", () => {
    expect(designHint(input({ ...base, comm: "" }))?.id).toBe("comm");
    expect(
      designHint(input({ ...base, comm: "", instruments: [] })),
    ).toBeNull();
    expect(designHint(input({ ...base, comm: "", storage: "" }))?.id).not.toBe(
      "comm",
    );
  });

  it("flags storage smaller than one day of data", () => {
    const hint = designHint(
      input(
        { ...base, instruments: ["opt_hr"], storage: "storage_32" },
        roomy,
        "glacier",
      ),
    );
    expect(hint?.id).toBe("storage");
    expect(hint?.text).toContain("40 GB");
    expect(hint?.text).toContain("32 GB Storage only holds 32 GB");
    expect(
      designHint(input({ ...base, instruments: ["opt_hr"] }, roomy, "glacier")),
    ).toBeNull();
  });

  it("flags a sensor that is a weak match for the hazard", () => {
    const hint = designHint(input(base, roomy, "drought"));
    expect(hint?.id).toBe("sensor-fit");
    expect(hint?.text).toContain("Thermal Infrared Sensor");
    expect(hint?.text).toContain("drought");
    expect(hint?.text).toContain("8%");
    expect(designHint(input(base, roomy, "wildfire"))).toBeNull();
  });

  it("celebrates lower power using only the compared engineering factors", () => {
    const before = { ...base, instruments: ["tir", "msi"] };
    const hint = designHint(input(base, roomy, "heat", before));
    expect(hint?.id).toBe("improved");
    expect(hint?.text).toContain("175 W instead of 225 W");
    expect(hint?.text).toContain(
      "without lowering its hazard match or orbit coverage",
    );
    expect(hint?.text).not.toContain("same observation quality");
  });

  it("does not celebrate when hazard match or orbit coverage drops", () => {
    const before = { ...base, instruments: ["tir", "msi"] };
    // msi fits heat at 0.65, worse than tir at 1.0.
    expect(
      designHint(
        input({ ...base, instruments: ["msi"] }, roomy, "heat", before),
      )?.id,
    ).not.toBe("improved");
    // Low LEO watches less of the area than sun-synchronous.
    expect(
      designHint(input({ ...base, orbit: "leo_400" }, roomy, "heat", before)),
    ).toBeNull();
    // Same power: nothing to celebrate.
    expect(designHint(input(base, roomy, "heat", base))).toBeNull();
  });

  it("returns one hint at a time in priority order", () => {
    const tight = { budgetM: 100, massKg: 200 };
    const design = { ...base, instruments: ["sar"] };
    expect(allHints(input(design, tight, "flood")).map((h) => h.id)).toEqual([
      "mass",
      "power",
      "budget",
    ]);
    expect(designHint(input(design, tight, "flood"))?.id).toBe("mass");
  });
});

const diagnostics = (over: Partial<SimDiagnostics>) =>
  ({
    hazardCells: 10,
    hazardDetected: 0,
    hazardNeverInView: 0,
    hazardCloudBlocked: 0,
    hazardNotRecognised: 0,
    hazardBeforeEvent: 0,
    observedCells: 30,
    totalCells: 60,
    ...over,
  }) as SimDiagnostics;

const result = (
  success: boolean,
  total: number,
  d?: SimDiagnostics,
): SimResult =>
  ({
    success,
    score: { total },
    diagnostics: d,
  }) as unknown as SimResult;

describe("resultLine", () => {
  it("celebrates success with the real score and coverage", () => {
    const line = resultLine(
      result(true, 81.6, diagnostics({ hazardDetected: 10 })),
    );
    expect(line).toContain("scored 82");
    expect(line).toContain("watched 50% of the area");
  });

  it("explains a miss with the biggest diagnostics reason", () => {
    const line = resultLine(
      result(
        false,
        34.2,
        diagnostics({
          hazardDetected: 2,
          hazardCloudBlocked: 6,
          hazardNeverInView: 2,
        }),
      ),
    );
    expect(line).toContain("scored 34");
    expect(line).toContain("Clouds blocked the view of 6 of 10 hazard areas.");
    expect(line).not.toContain("never in view");
  });

  it("gives no reason when the engine gave none", () => {
    const line = resultLine(result(false, 20));
    expect(line).toBe(
      "Mission complete! This run scored 20. That's how engineers learn. Let's see what to improve next time.",
    );
  });
});
