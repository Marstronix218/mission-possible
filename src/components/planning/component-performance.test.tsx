import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { partsCatalog, summarizeResources } from "@/lib/sim";
import type { SatelliteDesign } from "@/types/game";
import {
  candidateDesign,
  consequenceHints,
  deliveryDelayHours,
  describeChange,
  explainViolations,
  optionsFor,
  performanceAxes,
  ratioHigher,
  ratioLower,
  tradeOffNotes,
  type PerfCategory,
  type PerfContext,
} from "./component-performance";
import { PerformancePanel } from "./PerformancePanel";
import { ResourceDashboard } from "./ResourceDashboard";

const base: SatelliteDesign = {
  instruments: ["tir"],
  orbit: "sso_700",
  solar: "solar_m",
  battery: "battery_m",
  comm: "x_band",
  groundStations: 3,
  storage: "storage_128",
};
const roomy = { budgetM: 1000, massKg: 2000 };
const ctx = (over: Partial<PerfContext> = {}): PerfContext => ({
  category: "wildfire",
  design: base,
  constraints: roomy,
  ...over,
});

const expectedAxes: Record<PerfCategory, number> = {
  instruments: 5,
  orbits: 4,
  solar: 3,
  batteries: 3,
  communications: 4,
  storage: 4,
  groundStations: 3,
};

describe("component performance axes", () => {
  for (const [category, count] of Object.entries(expectedAxes) as [
    PerfCategory,
    number,
  ][]) {
    it(`gives ${category} ${count} documented, finite 0–100 axes`, () => {
      const shapes = new Set<string>();
      for (const option of optionsFor(category)) {
        const axes = performanceAxes(category, option.id, ctx());
        expect(axes).toHaveLength(count);
        for (const axis of axes) {
          expect(Number.isFinite(axis.value)).toBe(true);
          expect(axis.value).toBeGreaterThanOrEqual(0);
          expect(axis.value).toBeLessThanOrEqual(100);
          expect(axis.actual).not.toMatch(/NaN|Infinity|undefined/);
          expect(axis.meaning.length).toBeGreaterThan(10);
          expect(axis.formula.length).toBeGreaterThan(5);
        }
        shapes.add(axes.map((a) => a.value).join(","));
      }
      // Options are genuinely distinguishable.
      expect(shapes.size).toBe(optionsFor(category).length);
    });
  }

  it("uses ratio-to-best normalisation", () => {
    expect(ratioHigher(50, [25, 50, 100])).toBe(50);
    expect(ratioLower(400, [50, 400])).toBe(12.5);
    expect(ratioLower(50, [50, 400])).toBe(100);
  });

  it("derives sensor axes from the catalog and the engine's fit rule", () => {
    const [detail, allWeather, detection, power, data] = performanceAxes(
      "instruments",
      "sar",
      ctx(),
    );
    const sar = partsCatalog.instruments.find((p) => p.id === "sar")!;
    expect(detail.value).toBe(95); // 0.95 / 1.0
    expect(allWeather.value).toBe(100);
    expect(detection.value).toBe(8); // no wildfire fit → engine default 0.08
    expect(power.value).toBe(12.5); // 50 W / 400 W
    expect(power.actual).toBe(`${sar.powerW} W`);
    expect(data.value).toBe(2); // 1 GB / 50 GB
    expect(performanceAxes("instruments", "tir", ctx())[2].value).toBe(100);
    expect(
      performanceAxes("instruments", "tir", ctx({ category: "flood" }))[2]
        .value,
    ).toBe(8);
  });

  it("uses the resource model's coverage estimate for orbits", () => {
    for (const orbit of partsCatalog.orbits) {
      const coverage = performanceAxes("orbits", orbit.id, ctx()).find(
        (a) => a.id === "coverage",
      )!;
      expect(coverage.value).toBe(
        summarizeResources({ ...base, orbit: orbit.id }, roomy)
          .coverageEstimate,
      );
    }
  });

  it("makes data capacity depend on the installed sensors and ground stations", () => {
    const design = {
      ...base,
      instruments: ["sar"],
      groundStations: 1 as const,
    };
    // UHF: 0.1 Gbps × 0.125 × 8 min × 60 s = 6 GB/day of SAR's 50 GB/day.
    expect(
      performanceAxes("communications", "uhf", ctx({ design }))[1].value,
    ).toBe(12);
    expect(
      performanceAxes(
        "communications",
        "uhf",
        ctx({ design: { ...design, instruments: [] } }),
      )[1].value,
    ).toBe(100);
    // Engine storage margin: min(1, 32 / 50).
    expect(
      performanceAxes("storage", "storage_32", ctx({ design }))[1].value,
    ).toBe(64);
  });

  it("is deterministic and returns nothing for unknown parts", () => {
    expect(performanceAxes("orbits", "geo", ctx())).toEqual(
      performanceAxes("orbits", "geo", ctx()),
    );
    expect(performanceAxes("instruments", "made-up", ctx())).toEqual([]);
    expect(performanceAxes("groundStations", "2", ctx())).toEqual([]);
  });
});

describe("mission-specific trade-offs", () => {
  it("warns that a high-detail, power-hungry sensor may not suit the current design", () => {
    const design = { ...base, instruments: [], solar: "solar_s" };
    const notes = tradeOffNotes(
      "instruments",
      "sar",
      ctx({ design, category: "flood" }),
    );
    expect(notes[0]).toMatch(
      /excellent observation detail, but its power requirements may make it unsuitable/,
    );
    expect(notes[0]).toContain("150 W");
  });

  it("notes a cheaper sensor that may be sufficient when it fits the hazard", () => {
    const notes = tradeOffNotes(
      "instruments",
      "msi",
      ctx({ design: { ...base, instruments: [] }, category: "snow" }),
    );
    expect(notes.join(" ")).toContain(
      "less expensive sensor may be sufficient",
    );
  });

  it("never names a best or optimal option", () => {
    for (const category of Object.keys(expectedAxes) as PerfCategory[])
      for (const option of optionsFor(category))
        for (const hazard of ["wildfire", "flood", "drought", "storm"] as const)
          expect(
            tradeOffNotes(category, option.id, ctx({ category: hazard })).join(
              " ",
            ),
          ).not.toMatch(/\b(best|optimal|correct answer|recommended)\b/i);
  });

  it("previews sensor toggles and refuses a fourth sensor", () => {
    expect(candidateDesign("instruments", "tir", base)?.instruments).toEqual(
      [],
    );
    expect(candidateDesign("instruments", "msi", base)?.instruments).toEqual([
      "tir",
      "msi",
    ]);
    expect(
      candidateDesign("instruments", "sar", {
        ...base,
        instruments: ["tir", "msi", "opt_hr"],
      }),
    ).toBeNull();
    expect(candidateDesign("groundStations", "5", base)?.groundStations).toBe(
      5,
    );
  });
});

describe("constraint explanations", () => {
  it("explains a power violation and lists single changes that fix it", () => {
    const design = { ...base, instruments: ["sar"], solar: "solar_s" };
    const [power] = explainViolations(design, roomy);
    expect(power.resource).toBe("Power");
    expect(power.why).toContain("W");
    expect(power.meaning.length).toBeGreaterThan(10);
    expect(power.fixes.length).toBeGreaterThan(0);
    expect(power.fixes.join(" ")).toMatch(/Large Solar Array/);
  });

  it("only suggests fixes that remove the violation without adding another", () => {
    const tight = { budgetM: 180, massKg: 2000 };
    const design = {
      ...base,
      instruments: ["sar"],
      solar: "solar_l",
      comm: "ka_band",
    };
    const budget = explainViolations(design, tight).find(
      (v) => v.key === "budget",
    )!;
    expect(budget.why).toMatch(/over the \$180M budget/);
    expect(budget.fixes.length).toBeGreaterThan(0);
    for (const fix of budget.fixes) expect(fix).toMatch(/−\$/);
  });

  it("asks for missing parts without guessing fixes", () => {
    const [incomplete] = explainViolations({ ...base, orbit: "" }, roomy);
    expect(incomplete).toMatchObject({
      key: "incomplete",
      fixes: ["Choose an orbit in step 2."],
    });
  });
});

describe("change summary and consequences", () => {
  it("reports actual deltas, radar benefits and costs", () => {
    const change = describeChange(
      base,
      { ...base, solar: "solar_l" },
      { category: "wildfire", constraints: roomy },
    );
    expect(change.deltas).toContainEqual({
      label: "Power generated",
      delta: 400,
      unit: "W",
      better: true,
    });
    expect(change.benefits).toContain("Power output +50");
    expect(change.benefits).toContain("Power generated +400 W");
    expect(change.costs).toContain("Mass +30 kg");
  });

  it("warns when the radio cannot send each day's data", () => {
    const design = {
      ...base,
      instruments: ["sar", "opt_hr"],
      comm: "uhf",
      groundStations: 1 as const,
    };
    expect(consequenceHints(design, roomy, 6)).toContain(
      "Your current communication system may not be able to downlink all data each day.",
    );
  });

  it("mirrors the engine's standard downlink delay", () => {
    const r = summarizeResources(
      { ...base, instruments: ["sar"], comm: "uhf", groundStations: 1 },
      roomy,
    );
    expect(deliveryDelayHours(r)).toBe(
      Math.round(Math.max(0.25, (50 / 6) * 24) * 10) / 10,
    );
  });
});

describe("rendering", () => {
  it("shows the dashboard in real units with fixes and change highlights", () => {
    const design = { ...base, instruments: ["sar"], solar: "solar_s" };
    const html = renderToStaticMarkup(
      createElement(ResourceDashboard, {
        mission: {
          category: "flood",
          targetResponseHours: 12,
          durationDays: 10,
        },
        design,
        resources: summarizeResources(design, roomy),
        constraints: roomy,
        previousDesign: { ...design, instruments: ["tir"] },
      }),
    );
    for (const text of [
      "Mass",
      "Power",
      "Budget",
      "Data",
      "Communications",
      "Time",
      "W used",
      "GB/day",
      "kg",
      "$",
    ])
      expect(html).toContain(text);
    expect(html).toContain("Changes that would fix it");
    expect(html).toContain("Not feasible yet");
    expect(html).toContain("+330 W");
    expect(html).toContain("BENEFITS");
  });

  it("labels installed vs alternative, explains the axes and says it is not the mission score", () => {
    const html = renderToStaticMarkup(
      createElement(PerformancePanel, {
        category: "communications",
        preview: "ka_band",
        ctx: ctx(),
      }),
    );
    expect(html).toContain("Installed");
    expect(html).toContain("Alternative");
    expect(html).toContain('stroke-dasharray="6 4"');
    expect(html).toContain("not your mission score");
    expect(html).toContain("bigger polygon does not mean a better mission");
    expect(html).toContain("Transmission speed");
    expect(html).toContain("Formula:");
  });
});

describe("incomplete designs", () => {
  it("does not report power or data shortfalls caused only by a missing part", () => {
    const empty = { ...base, instruments: ["sar"], solar: "", comm: "" };
    const keys = explainViolations(empty, roomy).map((v) => v.key);
    expect(keys).toEqual(["incomplete"]);
  });
});
