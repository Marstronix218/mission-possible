import { allMissions, getMissionBySlug } from "@/lib/missions/registry";
import type { SatelliteDesign } from "@/types/game";
export const playableMissions = allMissions;
export const getMission = getMissionBySlug;
export const defaultDesign: SatelliteDesign = {
  instruments: ["tir"],
  orbit: "sso_700",
  solar: "solar_m",
  battery: "battery_m",
  comm: "x_band",
  groundStations: 3,
  storage: "storage_128",
};
