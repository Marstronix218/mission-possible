import losAngeles from "../../../data/missions/los-angeles.json";
import houston from "../../../data/missions/houston.json";
import phoenix from "../../../data/missions/phoenix.json";
import type { Mission } from "@/types/game";

export const missions = [losAngeles, houston, phoenix] as Mission[];

export function findMission(slug: string) {
  return missions.find((mission) => mission.slug === slug);
}
