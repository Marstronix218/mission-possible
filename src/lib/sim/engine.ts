import type {
  Constraints,
  InstrumentPart,
  Mission,
  SatelliteDesign,
  SimCellResult,
  SimResult,
  TimelinePoint,
} from "../../types/game";
import { categoryRules, findPart, partsCatalog } from "./catalog";
import { generateFeedback } from "./feedback";
import { createSeededRng, mixSeed } from "./rng";
import { calculateScore } from "./scoring";
import { summarizeResources } from "./resources";

export const ENGINE_VERSION = "1.1.0";

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

function selectedInstruments(design: SatelliteDesign): InstrumentPart[] {
  return design.instruments
    .map((id) => findPart(partsCatalog.instruments, id))
    .filter((part) => part !== undefined);
}

function createTimeline(mission: Mission, orbitId: string): TimelinePoint[] {
  const orbit = findPart(partsCatalog.orbits, orbitId);
  const [west, south, east, north] = mission.bbox;
  const points: TimelinePoint[] = [];
  const stepHours = orbitId === "geo" ? 12 : 3;

  for (let hour = 0; hour <= mission.durationDays * 24; hour += stepHours) {
    const phase = (hour / 24) * Math.PI * 2 / Math.max(0.35, orbit?.revisitFactor ?? 1);
    const across = (Math.sin(phase) + 1) / 2;
    const latWave = (Math.sin(phase * 0.63 + mission.seed) + 1) / 2;
    points.push({
      t: hour,
      lon: west + (east - west) * across,
      lat: south + (north - south) * latWave,
      event: hour === 0 ? "Mission started" : undefined,
    });
  }
  return points;
}

function invalidResult(mission: Mission, violations: string[]): SimResult {
  return {
    score: { accuracy: 0, responseTime: 0, coverage: 0, costEfficiency: 0, reliability: 0, total: 0 },
    cells: mission.grid.map((cell) => ({ id: cell.id, truth: cell.truth, observed: false, detected: false })),
    timeline: createTimeline(mission, "sso_700"),
    feedback: violations.map((message, index) => ({
      type: "warning" as const,
      key: `design.violation_${index + 1}`,
      message,
    })),
    success: false,
    firstDeliveryHours: null,
    engineVersion: ENGINE_VERSION,
  };
}

export function runSimulation(
  mission: Mission,
  design: SatelliteDesign,
  constraints: Constraints,
): SimResult {
  const resources = summarizeResources(design, constraints);
  if (resources.violations.length > 0) return invalidResult(mission, resources.violations);

  const instruments = selectedInstruments(design);
  const orbit = findPart(partsCatalog.orbits, design.orbit)!;
  const battery = findPart(partsCatalog.batteries, design.battery)!;
  const rules = categoryRules[mission.category];
  const dataMargin = resources.dataGBPerDay === 0
    ? 1
    : clamp01((resources.downlinkGBPerDay + resources.storageGB / mission.durationDays) / resources.dataGBPerDay);
  const powerMargin = clamp01(resources.powerGenW / Math.max(1, resources.powerUseW) - 0.05);
  const operationFactor = clamp01((0.62 + powerMargin * 0.38) * battery.eclipseContinuity * (0.7 + dataMargin * 0.3));
  const coverageChance = clamp01(
    0.17 * orbit.swathFactor / Math.max(0.35, orbit.revisitFactor) * operationFactor,
  );
  const downlinkLatencyHours = Math.max(
    0.25,
    resources.dataGBPerDay / Math.max(0.1, resources.downlinkGBPerDay) * 24,
  );
  const cellResults: SimCellResult[] = [];
  let firstDeliveryHours: number | null = null;
  let truePositives = 0;
  let falsePositives = 0;
  let observedCells = 0;
  let targetCells = 0;

  mission.grid.forEach((cell, cellIndex) => {
    if (cell.truth > 0.5) targetCells += 1;
    const rng = createSeededRng(mixSeed(mission.seed, cellIndex));
    let observed = false;
    let detected = false;
    // Missions task the spacecraft toward known risk areas; background cells remain
    // useful for measuring total regional coverage and false positives.
    const cellCoverageChance = clamp01(coverageChance * (cell.truth > 0.5 ? 1.55 : 1));

    for (let day = 0; day < mission.durationDays && !detected; day += 1) {
      if (rng() >= cellCoverageChance) continue;
      const cloudPenetrating = instruments.some(
        (instrument) => instrument.cloudPenetrating && (instrument.categoryFit[mission.category] ?? 0) >= 0.5,
      );
      const cloudFailureProbability = cloudPenetrating
        ? cell.cloudProbability * 0.08
        : cell.cloudProbability * rules.cloudImpact;
      if (rng() < cloudFailureProbability) continue;

      if (!observed) {
        observed = true;
        observedCells += 1;
      }
      const bestInstrument = instruments.reduce((best, current) => {
        const currentFit = current.categoryFit[mission.category] ?? 0.08;
        const bestFit = best.categoryFit[mission.category] ?? 0.08;
        return currentFit * current.resolutionScore > bestFit * best.resolutionScore ? current : best;
      });
      const fit = bestInstrument.categoryFit[mission.category] ?? 0.08;
      const detectionProbability = clamp01(
        0.1 + 0.9 * fit * bestInstrument.resolutionScore * orbit.resolutionFactor * cell.detectability,
      );
      const passSpacingHours = 12 * orbit.revisitFactor / Math.max(0.4, orbit.swathFactor);
      const observationHour = day * 24 + rng() * passSpacingHours;

      if (cell.truth > 0.5 && day >= cell.eventDay) {
        detected = rng() < detectionProbability;
        if (detected) {
          truePositives += 1;
          const delivery = observationHour + downlinkLatencyHours;
          firstDeliveryHours = firstDeliveryHours === null ? delivery : Math.min(firstDeliveryHours, delivery);
        }
      } else {
        detected = rng() < 0.005 + (1 - fit) * 0.05;
        if (detected) falsePositives += 1;
        // A background cell only needs one classification; repeated looks are
        // reserved for evolving hazard cells and must not compound false alarms.
        break;
      }
    }

    cellResults.push({ id: cell.id, truth: cell.truth, observed, detected });
  });

  const storageMargin = clamp01(resources.storageGB / Math.max(1, resources.dataGBPerDay));
  const reliability = clamp01(
    orbit.reliabilityFactor *
      (0.55 + powerMargin * 0.3 + battery.eclipseContinuity * 0.15) *
      (0.75 + dataMargin * 0.15 + storageMargin * 0.1),
  );
  const score = calculateScore({
    category: mission.category,
    truePositives,
    falsePositives,
    targetCells,
    observedCells,
    totalCells: mission.grid.length,
    firstDeliveryHours,
    targetResponseHours: mission.targetResponseHours || rules.targetResponseHours,
    reliability,
    resources,
    constraints,
  });
  const success = score.total >= 60 && score.coverage >= 50;

  return {
    score,
    cells: cellResults,
    timeline: createTimeline(mission, design.orbit),
    feedback: generateFeedback(score, resources, success),
    success,
    firstDeliveryHours: firstDeliveryHours === null ? null : Math.round(firstDeliveryHours * 10) / 10,
    engineVersion: ENGINE_VERSION,
  };
}
