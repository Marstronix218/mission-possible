import { describe, expect, it } from "vitest";
import { allMissions, missionSlugs } from "./registry";
import { getMissionStory } from "@/lib/story/missions";
import { runSimulation } from "@/lib/sim";
import { defaultDesign } from "@/components/results/missions";

describe("mission registry", () => {
  it("loads a playable mission for every slug on the map", () => {
    expect(allMissions.map((m) => m.slug)).toEqual([...missionSlugs]);
    expect(new Set(allMissions.map((m) => m.category)).size).toBe(8);
  });

  it.each(allMissions.map((m) => [m.slug, m] as const))("%s has valid data, a story, and honest sources", (slug, mission) => {
    expect(mission.grid).toHaveLength(400);
    expect(mission.grid.some((cell) => cell.truth > 0.5)).toBe(true);
    expect(mission.grid.every((cell) => cell.eventDay >= 0 && cell.eventDay < mission.durationDays)).toBe(true);
    expect(mission.defaultConstraints.budgetM).toBeGreaterThanOrEqual(80);
    expect(mission.defaultConstraints.massKg).toBeGreaterThanOrEqual(150);
    expect(mission.sources.length).toBeGreaterThan(0);
    const story = getMissionStory(slug);
    expect(story?.goal).toContain(String(mission.targetResponseHours));
    // Smoke test: the engine runs end-to-end on every mission without throwing.
    expect(runSimulation(mission, defaultDesign, mission.defaultConstraints).score.total).toBeGreaterThanOrEqual(0);
  });
});
