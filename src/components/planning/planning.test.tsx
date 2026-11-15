import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { allMissions } from "@/lib/missions/registry";
import { partsCatalog, runSimulation, summarizeResources } from "@/lib/sim";
import { defaultDesign } from "@/components/results/missions";
import {
  componentAxes,
  comparisonParts,
  radarPolygon,
  scoreAxes,
  type PartCategory,
} from "./radar-model";
import { ResourceDelta, resourceChanges } from "./ResourceDelta";
import { RadarChart } from "./RadarChart";
import { MissionScoreRadar } from "./MissionScoreRadar";
import { EnvelopeLetter } from "./EnvelopeLetter";
import { SatelliteWorkbench } from "@/components/gameplay/SatelliteWorkbench";

describe("honest five-axis comparisons", () => {
  for (const category of [
    "instruments",
    "solar",
    "batteries",
    "communications",
    "storage",
    "orbits",
  ] as PartCategory[]) {
    it(`uses five finite category-normalized traits and units for ${category}`, () => {
      const polygons = new Set<string>();
      for (const part of comparisonParts(category)) {
        const axes = componentAxes(category, part.id);
        expect(axes).toHaveLength(5);
        for (const axis of axes) {
          expect(axis.value).toBeGreaterThanOrEqual(0);
          expect(axis.value).toBeLessThanOrEqual(100);
          expect(axis.actual).not.toMatch(/NaN|Infinity/);
          expect(axis.meaning.length).toBeGreaterThan(15);
        }
        polygons.add(radarPolygon(axes.map((a) => a.value)));
      }
      expect(polygons.size).toBeGreaterThan(1);
    });
  }
  it("inverts low power/mass/cost demand and uses catalog values rather than mission-fit hints", () => {
    const optical = componentAxes("instruments", "opt_hr"),
      radar = componentAxes("instruments", "sar");
    expect(optical[2].actual).toBe(`${partsCatalog.instruments[0].powerW} W`);
    expect(optical[2].value).toBeGreaterThan(radar[2].value);
    expect(optical[1].label).toBe("Low data load");
    expect(optical.map((a) => a.label)).not.toContain("Coverage");
  });
  it("returns no invented data for an unknown component", () =>
    expect(componentAxes("instruments", "made-up")).toEqual([]));
});
describe("mission performance explanation", () => {
  const m = allMissions.find((m) => m.slug === "los-angeles")!;
  const result = runSimulation(m, defaultDesign, m.defaultConstraints);
  it("reads all four evaluation axes directly from the saved engine result", () => {
    const axes = scoreAxes(result);
    expect(axes.map((a) => a.value)).toEqual([
      result.score.accuracy,
      result.score.coverage,
      result.score.responseTime,
      result.score.reliability,
    ]);
    expect(axes.map((a) => a.id)).not.toContain("transmission");
  });
  it("keeps all points keyboard-operable and comparison polygons visually distinct", () => {
    const axes = scoreAxes(result);
    const html = renderToStaticMarkup(
      createElement(RadarChart, {
        axes,
        comparison: axes,
        label: "Mission",
        onSelect: () => {},
      }),
    );
    expect(html.match(/role="button"/g) || []).toHaveLength(4);
    expect(html.match(/tabindex="0"/g) || []).toHaveLength(4);
    expect(html).toContain('stroke-dasharray="6 4"');
  });
  it("explains the engine's real weighting, metric and overall score", () => {
    const html = renderToStaticMarkup(
      createElement(MissionScoreRadar, {
        mission: m,
        design: defaultDesign,
        result,
        constraints: m.defaultConstraints,
      }),
    );
    expect(html).toContain(result.score.total.toFixed(1));
    expect(html).toContain("overall");
    expect(html).toContain("toward your overall score");
    expect(html).toContain("Radio delivery affects Timing and Reliability");
    expect(html).toContain("Your next experiment");
  });
  it("shows the battery benefit as well as the extra resource demand", () => {
    const beforeDesign = { ...defaultDesign, battery: "battery_s" };
    const design = { ...defaultDesign, battery: "battery_l" };
    const html = renderToStaticMarkup(
      createElement(ResourceDelta, {
        before: summarizeResources(beforeDesign, m.defaultConstraints),
        after: summarizeResources(design, m.defaultConstraints),
        beforeDesign,
        design,
      }),
    );
    expect(html).toContain("Shadow continuity");
    expect(html).toContain("65");
    expect(html).toContain("96");
    expect(html).toContain("Cost");
    expect(html).toContain("Mass");
  });
  it("shows resource differences with their actual direction", () => {
    const before = summarizeResources(defaultDesign, m.defaultConstraints),
      after = summarizeResources(
        { ...defaultDesign, solar: "solar_l" },
        m.defaultConstraints,
      );
    const changes = resourceChanges(before, after);
    expect(changes.find((c) => c.key === "powerGenW")).toMatchObject({
      delta: 400,
      improves: true,
    });
    expect(changes.find((c) => c.key === "massKg")?.improves).toBe(false);
  });
});
describe("physical mission entry and assembly", () => {
  it("renders actual city objectives and deadlines inside envelopes for every mission", () => {
    for (const mission of allMissions) {
      const html = renderToStaticMarkup(
        createElement(EnvelopeLetter, { mission }),
      );
      expect(html).toContain(`Open mission envelope from ${mission.city}`);
      expect(html).toContain(`${mission.targetResponseHours} hours`);
      expect(html).toContain("ACCEPT MISSION");
      expect(html).toContain('hidden=""');
    }
  });
  it("has a welcome envelope and an explicit explore action", () => {
    const html = renderToStaticMarkup(
      createElement(EnvelopeLetter, { onExplore: () => {} }),
    );
    expect(html).toContain("Open welcome envelope");
    expect(html).toContain("EXPLORE THE U.S.");
  });
  it("does not draw missing array or antenna modules and exposes installed removals accessibly", () => {
    const full = renderToStaticMarkup(
      createElement(SatelliteWorkbench, {
        design: defaultDesign,
        onRemove: () => {},
      }),
    );
    expect(full).toContain('aria-label="Remove solar_m solar array"');
    expect(full).toContain('aria-label="Remove x_band radio and antenna"');
    const empty = renderToStaticMarkup(
      createElement(SatelliteWorkbench, {
        design: { ...defaultDesign, solar: "", comm: "", instruments: [] },
      }),
    );
    expect(empty).not.toContain("radio and antenna");
    expect(empty).not.toContain("solar array");
  });
});
