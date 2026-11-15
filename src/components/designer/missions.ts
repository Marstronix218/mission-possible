import { allMissions, getMissionBySlug } from "@/lib/missions/registry";

export const missions = allMissions;

export function findMission(slug: string) {
  return getMissionBySlug(slug);
}
