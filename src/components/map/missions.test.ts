import { describe, expect, it } from "vitest";
import { allMissions } from "@/lib/missions/registry";
import { selectMissions, toMapMission, starsFor } from "./missions";
const missions = allMissions.map(toMapMission);
const { featuredMissions, moreMissions } = selectMissions(missions);

describe("mission selection metadata", () => {
  it("keeps all 18 missions and their response targets aligned with the engine", () => {
    expect(missions).toHaveLength(18);
    expect(new Set(missions.map((m) => m.slug)).size).toBe(18);
    for (const mission of allMissions) {
      const tile = missions.find((m) => m.slug === mission.slug)!;
      expect(tile.city).toBe(mission.city);
      expect(tile.category).toBe(mission.category);
      expect(tile.deadlineHours).toBe(mission.targetResponseHours);
      const [west, south, east, north] = mission.bbox;
      expect(tile.coordinates).toEqual([(west + east) / 2, (south + north) / 2]);
    }
    expect(featuredMissions.map((m) => m.slug)).toEqual(["los-angeles", "houston", "phoenix"]);
    expect(moreMissions).toHaveLength(15);
  });

  it("awards stars only for completed missions, with explicit 70/90 thresholds", () => {
    expect(starsFor(undefined)).toBe(0);
    expect(starsFor({ score: 99, success: false })).toBe(0);
    expect(starsFor({ score: 69.9, success: true })).toBe(1);
    expect(starsFor({ score: 70, success: true })).toBe(2);
    expect(starsFor({ score: 89.9, success: true })).toBe(2);
    expect(starsFor({ score: 90, success: true })).toBe(3);
  });
});
