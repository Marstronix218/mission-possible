import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { summarizeResources } from "@/lib/sim/resources";
import type { SatelliteDesign } from "@/types/game";
import {
  blockerMessages, buildGauges, level, parseFixSlots, ratioStatus, stageComplete, stageOfSlot, stageUnlocked,
} from "./builder-model";
import { partCopy } from "./builder-copy";
import { partsCatalog } from "@/lib/sim/catalog";
import { SatelliteVisual } from "./SatelliteVisual";
import BriefPage from "./mission-briefing";
import { missions } from "./missions";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: unknown }) => createElement("a", { href, ...rest }, children as never),
}));
import { MissionSteps } from "@/components/story/MissionSteps";

const empty: SatelliteDesign = { instruments: [], orbit: "", solar: "", battery: "", comm: "", groundStations: 1, storage: "" };
const full: SatelliteDesign = {
  instruments: ["tir"], orbit: "sso_700", solar: "solar_m", battery: "battery_m", comm: "x_band", groundStations: 3, storage: "storage_128",
};
const roomy = { budgetM: 1000, massKg: 2000 };

describe("build stages", () => {
  it("unlocks steps in order: sensor, orbit, radio, power", () => {
    expect(stageUnlocked(empty, "eyes")).toBe(true);
    expect(stageUnlocked(empty, "orbit")).toBe(false);
    const withSensor = { ...empty, instruments: ["msi"] };
    expect(stageUnlocked(withSensor, "orbit")).toBe(true);
    expect(stageUnlocked(withSensor, "radio")).toBe(false);
    expect(stageComplete({ ...withSensor, comm: "uhf" }, "radio")).toBe(true);
    expect(stageComplete({ ...full, storage: "" }, "power")).toBe(false);
    expect(stages(full)).toEqual([true, true, true, true]);
  });

  it("maps every slot to the step that shows it", () => {
    expect(stageOfSlot("instruments")).toBe("eyes");
    expect(stageOfSlot("groundStations")).toBe("radio");
    expect(stageOfSlot("storage")).toBe("power");
  });
});

function stages(design: SatelliteDesign) {
  return (["eyes", "orbit", "radio", "power"] as const).map((id) => stageComplete(design, id));
}

describe("retry links", () => {
  it("reads ?fix= and #slot- in build order and drops unknown names", () => {
    expect(parseFixSlots("storage,orbit,bogus")).toEqual(["orbit", "storage"]);
    expect(parseFixSlots(undefined, "#slot-comm")).toEqual(["comm"]);
    expect(parseFixSlots(["instruments", "comm"], "#slot-comm")).toEqual(["instruments", "comm"]);
    expect(parseFixSlots(null, "#top")).toEqual([]);
  });
});

describe("gauges", () => {
  it("starts with only budget and weight", () => {
    const gauges = buildGauges(empty, summarizeResources(empty, roomy), roomy);
    expect(gauges.map((gauge) => gauge.key)).toEqual(["budget", "weight"]);
  });

  it("adds power and data once a sensor draws power, waiting until the matching part exists", () => {
    const design = { ...empty, instruments: ["sar"] };
    const gauges = buildGauges(design, summarizeResources(design, roomy), roomy);
    expect(gauges.find((gauge) => gauge.key === "power")).toMatchObject({ status: "waiting", hint: "Add solar wings" });
    expect(gauges.find((gauge) => gauge.key === "data")).toMatchObject({ status: "waiting", hint: "Add a radio" });
  });

  it("flags radar on small wings as over and a balanced build as OK", () => {
    const radar = { ...full, instruments: ["sar"], solar: "solar_s" };
    expect(buildGauges(radar, summarizeResources(radar, roomy), roomy).find((gauge) => gauge.key === "power")?.status).toBe("over");
    const statuses = buildGauges(full, summarizeResources(full, roomy), roomy).map((gauge) => gauge.status);
    expect(statuses).toEqual(["ok", "ok", "ok", "ok"]);
  });

  it("uses the engine thresholds", () => {
    expect(ratioStatus(89, 100, 0.9)).toBe("ok");
    expect(ratioStatus(90, 100, 0.9)).toBe("risky");
    expect(ratioStatus(101, 100, 0.9)).toBe("over");
  });

  it("translates engine violations into short reasons", () => {
    expect(blockerMessages(["Mass limit exceeded.", "Select a valid orbit."])).toEqual(["Too heavy for the rocket", "Pick an orbit"]);
  });

  it("ranks catalog values into 1–3 levels", () => {
    expect(level(1, [1, 2, 3])).toBe(1);
    expect(level(3, [1, 2, 3])).toBe(3);
    expect(level(5, [5, 5])).toBe(2);
  });
});

describe("copy", () => {
  it("has a plain name and a scientific name for every catalog part", () => {
    const ids = [
      ...partsCatalog.instruments, ...partsCatalog.orbits, ...partsCatalog.solar, ...partsCatalog.batteries,
      ...partsCatalog.communications, ...partsCatalog.storage,
    ].map((part) => part.id);
    for (const id of ids) {
      expect(partCopy[id]?.name, id).toBeTruthy();
      expect(partCopy[id]?.science, id).toBeTruthy();
    }
  });

  it("never states a hazard verdict on the sensor cards", () => {
    const text = partsCatalog.instruments.flatMap((part) => [partCopy[part.id].tag, ...(partCopy[part.id].chips ?? []).map((chip) => chip.text)]).join(" ");
    expect(text).not.toMatch(/sees this hazard|can't see this hazard|wildfire|flood|drought|volcano/i);
  });
});

describe("rendering", () => {
  it("renders every registered mission with the actual win thresholds and a separate response target", async () => {
    expect(missions).toHaveLength(18);
    for (const mission of missions) {
      const html = renderToStaticMarkup(await BriefPage({ params: Promise.resolve({ slug: mission.slug }) }));
      expect(html, mission.slug).toContain("BUILD YOUR SATELLITE");
      expect(html, mission.slug).toContain("Response target");
      expect(html, mission.slug).toContain("score 60+");
      expect(html, mission.slug).toContain("50");
      expect(html, mission.slug).not.toContain("data home in");
    }
  });

  it("draws each installed part and labels the satellite for screen readers", () => {
    const html = renderToStaticMarkup(createElement(SatelliteVisual, { design: full, fixSlots: ["comm"] }));
    expect(html).toContain("HEAT VISION");
    expect(html).toContain("FAST LINK");
    expect(html).not.toContain("+ eyes");
  });

  it("shows the six-step journey and accepts older step ids", () => {
    const html = renderToStaticMarkup(createElement(MissionSteps, { slug: "los-angeles", current: "debrief" }));
    for (const label of ["Disaster", "Design", "Launch", "Observe", "Discover", "Improve"]) expect(html).toContain(label);
    expect(html).toMatch(/aria-current="step"[^>]*>.*Discover/);
    expect(html).toContain('href="/mission/los-angeles/design"');
  });
});
