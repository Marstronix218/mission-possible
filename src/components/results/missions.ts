import la from "../../../data/missions/los-angeles.json";
import houston from "../../../data/missions/houston.json";
import phoenix from "../../../data/missions/phoenix.json";
import type { Mission, SatelliteDesign } from "@/types/game";
export const playableMissions = [la, houston, phoenix] as Mission[];
export const getMission = (slug: string) =>
  playableMissions.find((m) => m.slug === slug);
export const defaultDesign: SatelliteDesign = {
  instruments: ["tir"],
  orbit: "sso_700",
  solar: "solar_m",
  battery: "battery_m",
  comm: "x_band",
  groundStations: 3,
  storage: "storage_128",
};
