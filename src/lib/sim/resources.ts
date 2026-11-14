import type { Constraints, ResourceSummary, SatelliteDesign } from "../../types/game";
import { findPart, partsCatalog } from "./catalog";

const round = (value: number, digits = 1): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const addViolation = (violations: string[], condition: boolean, message: string): void => {
  if (condition) violations.push(message);
};

export function summarizeResources(
  design: SatelliteDesign,
  constraints: Constraints,
): ResourceSummary {
  const violations: string[] = [];
  const warnings: string[] = [];
  const instruments = design.instruments
    .map((id) => findPart(partsCatalog.instruments, id))
    .filter((part) => part !== undefined);
  const orbit = findPart(partsCatalog.orbits, design.orbit);
  const solar = findPart(partsCatalog.solar, design.solar);
  const battery = findPart(partsCatalog.batteries, design.battery);
  const comm = findPart(partsCatalog.communications, design.comm);
  const storage = findPart(partsCatalog.storage, design.storage);
  const groundStation = partsCatalog.groundStations[String(design.groundStations) as "1" | "3" | "5"];

  addViolation(violations, design.instruments.length === 0, "Select at least one instrument.");
  addViolation(
    violations,
    instruments.length !== design.instruments.length,
    "The design contains an unknown instrument.",
  );
  addViolation(violations, design.instruments.length > 3, "The satellite bus supports at most three instruments.");
  addViolation(violations, !orbit, "Select a valid orbit.");
  addViolation(violations, !solar, "Select a valid solar array.");
  addViolation(violations, !battery, "Select a valid battery.");
  addViolation(violations, !comm, "Select a valid communication system.");
  addViolation(violations, !storage, "Select a valid storage system.");
  addViolation(violations, !groundStation, "Select 1, 3, or 5 ground stations.");
  addViolation(violations, constraints.budgetM <= 0, "Budget limit must be greater than zero.");
  addViolation(violations, constraints.massKg <= 0, "Mass limit must be greater than zero.");

  const costM =
    partsCatalog.bus.costM +
    instruments.reduce((sum, part) => sum + part.costM, 0) +
    (orbit?.costM ?? 0) +
    (solar?.costM ?? 0) +
    (battery?.costM ?? 0) +
    (comm?.costM ?? 0) +
    (storage?.costM ?? 0) +
    (groundStation?.costM ?? 0);
  const massKg =
    partsCatalog.bus.massKg +
    instruments.reduce((sum, part) => sum + part.massKg, 0) +
    (orbit?.massKg ?? 0) +
    (solar?.massKg ?? 0) +
    (battery?.massKg ?? 0) +
    (comm?.massKg ?? 0) +
    (storage?.massKg ?? 0);
  const powerUseW =
    partsCatalog.bus.powerW +
    instruments.reduce((sum, part) => sum + part.powerW, 0) +
    (comm?.powerW ?? 0);
  const powerGenW = solar?.generationW ?? 0;
  const dataGBPerDay = instruments.reduce((sum, part) => sum + part.dataGBPerDay, 0);
  const downlinkGBPerDay = comm && groundStation
    ? comm.rateGbps * 0.125 * groundStation.accessMinutesPerDay * 60
    : 0;
  const storageGB = storage?.capacityGB ?? 0;
  const coverageEstimate = orbit
    ? Math.min(100, 28 * orbit.swathFactor / Math.max(0.35, orbit.revisitFactor))
    : 0;

  addViolation(violations, costM > constraints.budgetM, "Budget limit exceeded.");
  addViolation(violations, massKg > constraints.massKg, "Mass limit exceeded.");
  addViolation(violations, powerUseW > powerGenW, "Power demand exceeds solar generation.");
  addViolation(violations, dataGBPerDay > downlinkGBPerDay + storageGB, "Daily data exceeds downlink and storage capacity.");

  if (powerGenW > 0 && powerUseW / powerGenW >= 0.85 && powerUseW <= powerGenW) {
    warnings.push("Power margin is below 15%; observations may pause during eclipse.");
  }
  if (downlinkGBPerDay > 0 && dataGBPerDay / downlinkGBPerDay >= 0.8) {
    warnings.push("Downlink utilization is above 80%; delivery delays are likely.");
  }
  if (storageGB > 0 && dataGBPerDay > storageGB) {
    warnings.push("One day of observations does not fit in onboard storage.");
  }

  return {
    costM: round(costM),
    massKg: round(massKg),
    powerGenW: round(powerGenW),
    powerUseW: round(powerUseW),
    dataGBPerDay: round(dataGBPerDay),
    downlinkGBPerDay: round(downlinkGBPerDay),
    storageGB: round(storageGB),
    coverageEstimate: round(coverageEstimate),
    violations,
    warnings,
  };
}
