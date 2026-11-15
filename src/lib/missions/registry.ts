// Single source of truth for every playable mission. Mission data lives in
// data/missions/*.json; group files collect the JSON imports per hazard group.
import losAngeles from "../../../data/missions/los-angeles.json";
import houston from "../../../data/missions/houston.json";
import phoenix from "../../../data/missions/phoenix.json";
import type { Mission } from "@/types/game";
import { groupAMissions } from "./group-a";
import { groupBMissions } from "./group-b";

/** Every mission slug the game, API and database accept. */
export const missionSlugs = [
  "los-angeles",
  "san-francisco",
  "phoenix",
  "chicago",
  "seattle",
  "houston",
  "st-louis",
  "atlanta",
  "new-york-city",
  "denver",
  "minneapolis",
  "boston",
  "salt-lake-city",
  "oklahoma-city",
  "miami",
  "new-orleans",
  "anchorage",
  "hilo",
] as const;
export type MissionSlug = (typeof missionSlugs)[number];

const loaded = [losAngeles, houston, phoenix, ...groupAMissions, ...groupBMissions] as Mission[];

/** Playable missions in the canonical slug order. */
export const allMissions: Mission[] = missionSlugs
  .map((slug) => loaded.find((mission) => mission.slug === slug))
  .filter((mission): mission is Mission => mission !== undefined);

export function getMissionBySlug(slug: string): Mission | undefined {
  return allMissions.find((mission) => mission.slug === slug);
}
