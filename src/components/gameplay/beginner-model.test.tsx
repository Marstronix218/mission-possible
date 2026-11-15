import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { allMissions } from "@/lib/missions/registry";
import { partsCatalog, runSimulation, summarizeResources } from "@/lib/sim";
import {
  beginnerSensors,
  constraintChecks,
  sensorNames,
  starterDesign,
} from "./beginner-model";
import { BeginnerDebrief } from "./BeginnerDebrief";
import { MissionLetter } from "./MissionLetter";
import { LaunchSequence } from "@/components/results/LaunchSequence";
import { causeLines } from "@/components/results/mission-debrief";

const la = allMissions.find((m) => m.slug === "los-angeles")!;
describe("beginner mission engineering", () => {
  it("keeps the first choice neutral and offers every catalog sensor on the first attempt", () => {
    for (const mission of allMissions) {
      const choices = beginnerSensors(mission);
      expect(choices).toEqual(partsCatalog.instruments.map((p) => p.id));
      for (const id of choices) {
        expect(partsCatalog.instruments.some((p) => p.id === id)).toBe(true);
        expect(sensorNames[id].join(" ")).not.toMatch(
          /best|correct|fire|flood|recommended/i,
        );
      }
    }
  });
  it("does not choose a payload before the player does", () => {
    expect(starterDesign("").instruments).toEqual([]);
    expect(
      summarizeResources(starterDesign(""), la.defaultConstraints).violations,
    ).toContain("Select at least one instrument.");
  });
  it("can launch every beginner payload for each of the original missions and San Francisco without bypassing budgets", () => {
    for (const slug of ["los-angeles", "houston", "phoenix", "san-francisco"]) {
      const m = allMissions.find((m) => m.slug === slug)!;
      for (const sensor of beginnerSensors(m))
        expect(
          summarizeResources(starterDesign(sensor, m), m.defaultConstraints)
            .violations,
          `${slug}/${sensor}`,
        ).toEqual([]);
    }
  });
  it("offers a launchable supplied platform for every registered mission", () => {
    for (const mission of allMissions)
      expect(
        beginnerSensors(mission).some(
          (id) =>
            summarizeResources(
              starterDesign(id, mission),
              mission.defaultConstraints,
            ).violations.length === 0,
        ),
        mission.slug,
      ).toBe(true);
  });
  it("keeps genuine weight and power warnings after engineering changes", () => {
    const d = { ...starterDesign("sar"), solar: "solar_s" };
    expect(constraintChecks(d, la).find((c) => c.label === "Power")?.good).toBe(
      false,
    );
    expect(
      constraintChecks(d, {
        ...la,
        defaultConstraints: { budgetM: 50, massKg: 100 },
      })
        .filter((c) => !c.good)
        .map((c) => c.label),
    ).toEqual(expect.arrayContaining(["Power", "Weight", "Budget"]));
  });
  it("still evaluates choices differently through the real deterministic engine", () => {
    const camera = runSimulation(
      la,
      starterDesign("opt_hr"),
      la.defaultConstraints,
    );
    const heat = runSimulation(la, starterDesign("tir"), la.defaultConstraints);
    expect(camera).toEqual(
      runSimulation(la, starterDesign("opt_hr"), la.defaultConstraints),
    );
    expect(camera.score).not.toEqual(heat.score);
    expect(camera.diagnostics?.bestInstrumentId).toBe("opt_hr");
  });
});
describe("first mission screens", () => {
  it("puts the objective, deadline, constraints and accept action in the briefing without a letter accordion", () => {
    const html = renderToStaticMarkup(
      createElement(MissionLetter, { mission: la }),
    );
    expect(html).toContain("Mission parameters");
    expect(html).toContain("First delivery target");
    expect(html).toContain(`${la.targetResponseHours} hours`);
    expect(html).toContain("ACCEPT MISSION");
    expect(html).toContain("Why space?");
    expect(html).not.toContain("Open your mission letter");
    expect(html.indexOf("ACCEPT MISSION")).toBeLessThan(
      html.indexOf("Mission science, assumptions"),
    );
  });

  it("shows one launch action and hides engineering prose in optional details", () => {
    const html = renderToStaticMarkup(
      createElement(LaunchSequence, {
        events: [],
        design: starterDesign("tir"),
        reducedMotion: false,
        onComplete: () => {},
        city: la.city,
        responseHours: la.targetResponseHours,
      }),
    );
    expect(html).toContain("READY FOR LAUNCH?");
    expect(html).toContain("LAUNCH SATELLITE");
    expect(html).toContain("8 h response target");
    expect(html).toMatch(
      /<details[^>]*><summary[^>]*>Optional engineering details/,
    );
  });
  it("places retry ahead of optional details and reports only a simulation-backed cause", () => {
    const design = starterDesign("opt_hr");
    const result = runSimulation(la, design, la.defaultConstraints);
    const attempt = {
      id: "test",
      slug: la.slug,
      design,
      result,
      constraints: la.defaultConstraints,
      at: "2026-11-14T00:00:00Z",
      verified: false,
    };
    const html = renderToStaticMarkup(
      createElement(BeginnerDebrief, {
        mission: la,
        attempt,
        history: [attempt],
        onFix: () => {},
        resultHref: (id) => `/result?attempt=${id}`,
      }),
    );
    expect(html).toContain("Your simulated observation");
    expect(html).toContain("Archived NASA reference");
    expect(html).toContain(
      causeLines(la, design, result)[0]
        .text.replaceAll("&", "&amp;")
        .replaceAll("'", "&#x27;"),
    );
    expect(html.indexOf("FIX &amp; RETRY")).toBeLessThan(
      html.indexOf("Why it happened &amp; engineering details"),
    );
    expect(html).not.toMatch(/lives saved|live feed from/i);
  });
});
