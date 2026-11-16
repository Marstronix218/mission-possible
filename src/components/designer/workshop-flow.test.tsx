import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { WorkshopInstruction } from "./WorkshopInstruction";
import {
  workshopDecisions,
  decisionComplete,
  decisionForSlot,
  firstUnfinishedDecision,
} from "./workshop-flow";
import { defaultDesign, getMission } from "@/components/results/missions";
import { summarizeResources, runSimulation } from "@/lib/sim";
const mission = getMission("los-angeles")!;
describe("focused workshop flow", () => {
  it("has one instruction for every independently selected subsystem", () => {
    expect(workshopDecisions.map((d) => d.slot)).toEqual([
      "instruments",
      "orbit",
      "solar",
      "battery",
      "storage",
      "comm",
      "groundStations",
      "review",
    ]);
  });
  it("preserves previously selected parts and returns to the actual unfinished decision", () => {
    const draft = { ...defaultDesign, solar: "", battery: "" };
    const before = JSON.stringify(draft);
    expect(firstUnfinishedDecision(draft)).toBe(decisionForSlot("solar"));
    expect(decisionComplete(draft, decisionForSlot("solar"))).toBe(false);
    expect(decisionComplete(draft, decisionForSlot("instruments"))).toBe(true);
    expect(JSON.stringify(draft)).toBe(before);
  });
  it("distinguishes wildfire sensing from urban surface heat and labels both as concepts", () => {
    const render = (slug: string) =>
      renderToStaticMarkup(
        createElement(WorkshopInstruction, {
          mission: getMission(slug)!,
          index: 0,
          onContinue: () => {},
          onBack: () => {},
        }),
      );
    const fire = render("los-angeles"),
      heat = render("san-francisco");
    expect(fire).toContain("Heat ≠ visible light");
    expect(heat).toContain("Observe surface heat");
    expect(heat).not.toContain("wildfire heat and smoke");
    for (const html of [fire, heat]) {
      expect(html).toContain(
        "not a NASA observation or calculated flight path",
      );
      expect(html).toContain("CONTINUE");
      expect(html).toContain("← Back");
    }
  });
  it("navigation and instruction rendering never mutate engineering inputs or engine results", () => {
    const before = runSimulation(
      mission,
      defaultDesign,
      mission.defaultConstraints,
    );
    const resources = summarizeResources(
      defaultDesign,
      mission.defaultConstraints,
    );
    workshopDecisions.forEach((_, i) => decisionComplete(defaultDesign, i));
    expect(
      runSimulation(mission, defaultDesign, mission.defaultConstraints),
    ).toEqual(before);
    expect(
      summarizeResources(defaultDesign, mission.defaultConstraints),
    ).toEqual(resources);
  });
});
