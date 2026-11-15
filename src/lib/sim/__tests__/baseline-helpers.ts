import type { SatelliteDesign, SimResult } from "../../../types/game";

/** Designs used to pin engine 1.1.0 behaviour across every mission. */
export const snapshotDesigns: Record<string, SatelliteDesign> = {
  thermal: { instruments: ["tir"], orbit: "sso_700", solar: "solar_m", battery: "battery_m", comm: "x_band", groundStations: 3, storage: "storage_128" },
  radar: { instruments: ["sar"], orbit: "sso_700", solar: "solar_l", battery: "battery_l", comm: "x_band", groundStations: 5, storage: "storage_512" },
  microwave: { instruments: ["pmw"], orbit: "leo_400", solar: "solar_m", battery: "battery_m", comm: "s_band", groundStations: 3, storage: "storage_32" },
  multispectral: { instruments: ["msi"], orbit: "sso_700", solar: "solar_m", battery: "battery_m", comm: "s_band", groundStations: 3, storage: "storage_128" },
  gravity: { instruments: ["grav"], orbit: "sso_700", solar: "solar_m", battery: "battery_s", comm: "uhf", groundStations: 1, storage: "storage_32" },
  weak: { instruments: ["msi"], orbit: "leo_400", solar: "solar_s", battery: "battery_s", comm: "uhf", groundStations: 1, storage: "storage_32" },
  dual: { instruments: ["tir", "msi"], orbit: "sso_700", solar: "solar_m", battery: "battery_l", comm: "ka_band", groundStations: 5, storage: "storage_512" },
  geo: { instruments: ["msi"], orbit: "geo", solar: "solar_s", battery: "battery_s", comm: "s_band", groundStations: 1, storage: "storage_32" },
};

/** 32-bit FNV-1a hash, enough to pin a long array without storing it. */
export function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/** Compact, comparable view of the fields engine 1.1.0 produced. */
export function summarize(result: SimResult) {
  return {
    score: result.score,
    success: result.success,
    firstDeliveryHours: result.firstDeliveryHours,
    // 0 = not observed, 1 = observed, 2 = observed and detected, 3 = detected only.
    cells: result.cells.map((cell) => (cell.detected ? (cell.observed ? 2 : 3) : cell.observed ? 1 : 0)).join(""),
    cellIds: fnv1a(result.cells.map((cell) => `${cell.id}:${cell.truth}`).join("|")),
    timeline: fnv1a(JSON.stringify(result.timeline)),
    feedback: result.feedback,
  };
}
