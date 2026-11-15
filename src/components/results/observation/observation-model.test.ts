import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { allMissions } from "@/lib/missions/registry";
import { runSimulation, summarizeResources } from "@/lib/sim";
import type { SatelliteDesign } from "@/types/game";
import { defaultDesign } from "../missions";
import { downlinkLatency, isTrueDetection } from "../mission-playback";
import {
  alignImage,
  captionFor,
  cellAtPoint,
  cellDetail,
  cellViews,
  clampTransform,
  firstClearLook,
  footprintBand,
  observationSummary,
  parseContextReference,
  parseLstReference,
  phaseAt,
  scaleGradient,
  sensorProfile,
  sliderKey,
  viewAspect,
  zoomAt,
} from "./observation-model";

const sf = allMissions.find((m) => m.slug === "san-francisco")!;
const lstJson = JSON.parse(
  readFileSync(join(process.cwd(), "public/nasa/san-francisco-lst.json"), "utf8"),
);

function run(design: SatelliteDesign, mission = sf) {
  const result = runSimulation(mission, design, mission.defaultConstraints);
  const resources = summarizeResources(design, mission.defaultConstraints);
  return { result, latency: downlinkLatency(result, resources) };
}

const designs: SatelliteDesign[] = [
  defaultDesign,
  { ...defaultDesign, instruments: ["opt_hr"] },
  { ...defaultDesign, instruments: ["sar"], solar: "solar_l" },
  { ...defaultDesign, comm: "uhf", groundStations: 1 },
  { ...defaultDesign, orbit: "leo_400" },
];

describe("observation summary matches the engine score", () => {
  for (const mission of allMissions)
    for (const design of designs) {
      it(`${mission.slug} / ${design.instruments[0]} / ${design.comm} / ${design.orbit}`, () => {
        const { result, latency } = run(design, mission);
        const s = observationSummary(mission, result, latency);
        expect(s.totalCells).toBe(mission.grid.length);
        expect(s.coveragePct).toBe(result.score.coverage);
        expect(Math.round((1000 * s.observedCells) / s.totalCells) / 10).toBe(
          result.score.coverage,
        );
        const d = result.diagnostics;
        if (!d) return; // invalid design: engine returns no diagnostics
        expect(s.observedCells).toBe(d.observedCells);
        expect(s.hazardCells).toBe(d.hazardCells);
        expect(s.hazardFound).toBe(d.hazardDetected);
        expect(s.falseAlarms).toBe(d.falseAlarms);
        expect(s.missed["never-in-view"]).toBe(d.hazardNeverInView);
        expect(s.missed["cloud-blocked"]).toBe(d.hazardCloudBlocked);
        expect(s.missed["not-recognised"]).toBe(d.hazardNotRecognised);
        expect(s.missed["before-event"]).toBe(d.hazardBeforeEvent);
        // Every observed cell is either on the ground or still on board at the end.
        expect(s.downlinkedCells + s.notDownlinkedCells).toBe(d.observedCells);
        expect(
          s.downlinkedCells + s.notDownlinkedCells + s.blockedOnlyCells + s.neverLookedCells,
        ).toBe(s.totalCells);
        expect(s.deadlineMet).toBe(
          result.firstDeliveryHours === null
            ? null
            : result.firstDeliveryHours <= mission.targetResponseHours,
        );
      });
    }
});

describe("cell views over time", () => {
  const { result, latency } = run(defaultDesign);
  const span = sf.durationDays * 24;

  it("reveals cells monotonically and never before their first clear look", () => {
    let previous = -1;
    for (let hour = 0; hour <= span; hour += 3) {
      const views = cellViews(sf, result, hour, latency);
      const revealed = views.filter(
        (v) => v.state === "onboard" || v.state === "downlinked",
      );
      expect(revealed.length).toBeGreaterThanOrEqual(previous);
      previous = revealed.length;
      for (const v of revealed) expect(v.firstClearHour!).toBeLessThanOrEqual(hour);
      for (const v of views.filter((x) => x.state === "downlinked"))
        expect(v.downlinkHour!).toBeLessThanOrEqual(hour);
    }
  });

  it("uses the engine rule for delivery: first clear look + downlink latency", () => {
    const views = cellViews(sf, result, span, latency);
    for (const v of views) {
      const cell = result.cells.find((c) => c.id === v.id)!;
      const first = firstClearLook(cell);
      expect(v.firstClearHour).toBe(first);
      if (first !== null)
        expect(v.downlinkHour).toBe(Math.round((first + latency) * 10) / 10);
    }
  });

  it("marks found / false alarm / missed exactly as the engine classified them", () => {
    const views = cellViews(sf, result, span, latency);
    for (const v of views) {
      const cell = result.cells.find((c) => c.id === v.id)!;
      if (isTrueDetection(cell)) expect(v.mark).toBe("found");
      else if (cell.truth > 0.5) {
        expect(v.mark).toBe("missed");
        expect(v.missReason).toBe(cell.missReason);
      } else if (cell.detected) expect(v.mark).toBe("false-alarm");
      else expect(v.mark).toBe("none");
    }
  });

  it("does not show detections before their engine hour", () => {
    const found = result.cells.find((c) => isTrueDetection(c) && c.detectedHour != null);
    if (!found) return;
    const before = cellViews(sf, result, found.detectedHour! - 0.1, latency).find(
      (v) => v.id === found.id,
    )!;
    expect(before.mark).not.toBe("found");
  });

  it("explains a cell with real Landsat reference values when available", () => {
    const lst = parseLstReference(lstJson)!;
    const views = cellViews(sf, result, span, latency);
    const land = views.find((v) => lst.cells[v.id]?.meanC != null)!;
    const lines = cellDetail(land, result.cells.find((c) => c.id === land.id), sf, span, lst);
    const ref = lines.find((l) => l.label === "Real reference")!;
    expect(ref.value).toContain(lst.cells[land.id].meanC!.toFixed(1));
    expect(ref.value).toContain("land surface temperature");
    expect(lines.find((l) => l.label === "Location")!.value).toMatch(/° N, .*° W/);
  });
});

describe("sensor profile", () => {
  it("thermal sees LST when a Landsat layer exists, else falls back with a note", () => {
    const { result } = run(defaultDesign);
    expect(sensorProfile(defaultDesign, result, true).layer).toBe("lst");
    const fallback = sensorProfile(defaultDesign, result, false);
    expect(fallback.layer).toBe("true-colour");
    expect(fallback.note).toMatch(/No processed thermal reference/);
  });

  it("optical uses true colour; radar is greyscale, sees through cloud and is not thermal", () => {
    const optical = { ...defaultDesign, instruments: ["opt_hr"] };
    expect(sensorProfile(optical, run(optical).result, true).layer).toBe("true-colour");
    const radar = { ...defaultDesign, instruments: ["sar"], solar: "solar_l" };
    const p = sensorProfile(radar, run(radar).result, true);
    expect(p.layer).toBe("greyscale");
    expect(p.measures).toMatch(/does not measure temperature/);
    expect(p.instrument?.cloudPenetrating).toBe(true);
  });

  it("derives pixel detail from catalog resolution × orbit factor (GEO is coarsest)", () => {
    const leo = { ...defaultDesign, orbit: "leo_400" };
    const geo = { ...defaultDesign, orbit: "geo" };
    const a = sensorProfile(leo, run(leo).result, true);
    const b = sensorProfile(geo, run(geo).result, true);
    expect(a.pixelsPerCell).toBeGreaterThan(b.pixelsPerCell);
    expect(b.pixelsPerCell).toBeGreaterThanOrEqual(1);
    expect(a.pixelsPerCell).toBeLessThanOrEqual(8);
    expect(a.detailFactor).toBeCloseTo(0.8 * 1.3, 3);
  });
});

describe("captions and phases", () => {
  it("builds captions from the result, never hardcoded numbers", () => {
    expect(captionFor("complete", "San Francisco", "thermal", 37.5)).toBe(
      "Observation complete! You captured 38% of the target area.",
    );
    expect(captionFor("approach", "San Francisco", "thermal", 0)).toBe(
      "Your satellite is approaching San Francisco.",
    );
    expect(captionFor("scanning", "X", "thermal", 0)).toBe(
      "Your thermal sensor is measuring surface temperature.",
    );
    expect(captionFor("downlink", "X", "radar", 0)).toBe(
      "Your satellite is sending data back to Earth.",
    );
  });

  it("orders phases: complete > scanning > downlink > approach", () => {
    expect(phaseAt({ hour: 168, span: 168, windowOpen: true, onboardCells: 3 })).toBe("complete");
    expect(phaseAt({ hour: 2, span: 168, windowOpen: true, onboardCells: 3 })).toBe("scanning");
    expect(phaseAt({ hour: 20, span: 168, windowOpen: false, onboardCells: 3 })).toBe("downlink");
    expect(phaseAt({ hour: 20, span: 168, windowOpen: false, onboardCells: 0 })).toBe("approach");
  });

  it("sweeps the footprint across the target only while the window is open", () => {
    const a = footprintBand(defaultDesign, 0.5, 6)!;
    const b = footprintBand(defaultDesign, 5.5, 6)!;
    expect(b.top).toBeGreaterThan(a.top);
    expect(footprintBand(defaultDesign, 7, 6)).toBeNull();
  });
});

describe("reference data", () => {
  it("parses the real Landsat LST provenance for San Francisco", () => {
    const lst = parseLstReference(lstJson)!;
    expect(lst).not.toBeNull();
    expect(lst.bbox).toEqual(sf.bbox);
    expect(lst.productId).toMatch(/^LC0[89]_L2SP_/);
    expect(lst.source).toMatch(/Landsat/);
    expect(Object.keys(lst.cells)).toHaveLength(sf.grid.length);
    for (const g of sf.grid) expect(lst.cells[g.id]).toBeDefined();
    expect(scaleGradient(lst.scale)).toMatch(/^linear-gradient\(90deg, #/);
  });

  it("rejects incomplete LST metadata instead of guessing", () => {
    expect(parseLstReference(null)).toBeNull();
    expect(parseLstReference({ ...lstJson, productId: undefined })).toBeNull();
    expect(parseLstReference({ ...lstJson, colourScale: { minC: 1, maxC: 2, stops: [] } })).toBeNull();
  });

  it("reads every mission's context image provenance", () => {
    for (const m of allMissions) {
      const json = JSON.parse(
        readFileSync(join(process.cwd(), `public/nasa/${m.slug}.json`), "utf8"),
      );
      const ref = parseContextReference(m.slug, json, m.bbox);
      expect(ref.source).toMatch(/NASA/);
      expect(ref.observedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(alignImage(m.bbox, ref.bbox, 512, 512)).not.toBeNull();
    }
  });

  it("aligns a larger image bbox to the mission bbox", () => {
    const same = alignImage([0, 0, 2, 1], [0, 0, 2, 1], 200, 100)!;
    expect(same).toMatchObject({ sx: 0, sy: 0, sw: 200, sh: 100, dx: 0, dy: 0, dw: 1, dh: 1 });
    const bigger = alignImage([0, 0, 2, 1], [-1, -1, 3, 2], 400, 300)!;
    expect(bigger.sx).toBeCloseTo(100);
    expect(bigger.sy).toBeCloseTo(100);
    expect(bigger.sw).toBeCloseTo(200);
    expect(bigger.sh).toBeCloseTo(100);
    expect(alignImage([0, 0, 1, 1], [5, 5, 6, 6], 10, 10)).toBeNull();
  });
});

describe("interaction helpers", () => {
  it("moves the comparison slider with the keyboard", () => {
    expect(sliderKey(50, "ArrowLeft")).toBe(45);
    expect(sliderKey(98, "ArrowRight")).toBe(100);
    expect(sliderKey(50, "Home")).toBe(0);
    expect(sliderKey(50, "End")).toBe(100);
    expect(sliderKey(50, "a")).toBeNull();
  });

  it("zooms about a point and keeps the image covering the view", () => {
    const z = zoomAt({ scale: 1, x: 0, y: 0 }, 2, 1, 1);
    expect(z).toEqual({ scale: 2, x: -1, y: -1 });
    expect(clampTransform({ scale: 10, x: 5, y: -50 }).scale).toBe(6);
    expect(clampTransform({ scale: 2, x: 5, y: -50 })).toEqual({ scale: 2, x: 0, y: -1 });
    expect(zoomAt(z, 0.1).scale).toBe(1);
  });

  it("corrects the map aspect for latitude", () => {
    expect(viewAspect([0, -1, 4, 1])).toBeCloseTo(2, 5);
    expect(viewAspect(sf.bbox)).toBeCloseTo((1.3 * Math.cos((37.7 * Math.PI) / 180)) / 0.8, 3);
  });

  it("maps a point to the grid cell, north up", () => {
    const t = { scale: 1, x: 0, y: 0 };
    expect(cellAtPoint(sf, t, 0.001, 0.001)?.id).toBe("r19c00");
    expect(cellAtPoint(sf, t, 0.999, 0.999)?.id).toBe("r00c19");
    expect(cellAtPoint(sf, t, 1.2, 0.5)).toBeNull();
    expect(cellAtPoint(sf, { scale: 2, x: -1, y: -1 }, 0.001, 0.001)?.id).toBe("r09c10");
  });
});
