import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { allMissions } from "@/lib/missions/registry";
import { runSimulation, summarizeResources } from "@/lib/sim";
import { defaultDesign } from "../missions";
import { ObservationView } from "./ObservationView";

const mission = allMissions.find((m) => m.slug === "san-francisco")!;
const design = { ...defaultDesign, instruments: ["tir"] };
const result = runSimulation(mission, design, mission.defaultConstraints);
const resources = summarizeResources(design, mission.defaultConstraints);

const render = (mode: "live" | "final") =>
  renderToStaticMarkup(
    createElement(ObservationView, { mission, design, resources, result, hour: 6, mode, animate: false }),
  );

describe("ObservationView", () => {
  it.each(["live", "final"] as const)("opens on the compare view in %s mode", (mode) => {
    const html = render(mode);
    expect(html).toMatch(/aria-pressed="true"><span aria-hidden="true">✓ <\/span>Compare/);
    expect(html).toMatch(/aria-pressed="false">Your satellite/);
    expect(html).toContain("REAL NASA OBSERVATION");
    expect(html).toContain("YOUR SATELLITE&#x27;S OBSERVATION · simulated");
    expect(html).toContain('aria-valuenow="50"');
  });
});
