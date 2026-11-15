import type {
  Constraints,
  InstrumentPart,
  Mission,
  MissionDecisions,
  MissionGridCell,
  SatelliteDesign,
  SimCellResult,
  SimDiagnostics,
  SimResult,
  TimelinePoint,
} from "../../types/game";
import { categoryRules, findPart, partsCatalog } from "./catalog";
import { generateFeedback } from "./feedback";
import { createSeededRng, mixSeed } from "./rng";
import { calculateScore, evaluationWeights } from "./scoring";
import { summarizeResources } from "./resources";

export const ENGINE_VERSION = "1.3.0";

/**
 * Magnitudes of the in-mission decisions. Every multiplier is 1 (or the term is
 * absent) for the default decisions, so designs without decisions reproduce the
 * 1.1.0 engine exactly.
 */
export const DECISION_EFFECTS = {
  /** focus "hazard": extra look chance on known-risk cells, less on background cells. */
  hazardFocusTargetBoost: 1.3,
  hazardFocusBackgroundFactor: 0.75,
  /** retask: look-chance multiplier inside / outside the chosen quadrant from `day` on. */
  retaskInsideBoost: 1.5,
  retaskOutsideFactor: 0.8,
  /** downlink "fast": transmit on every contact. */
  fastLatencyFactor: 0.5,
  /** Extra transmitter draw as a share of the radio's rated power. */
  fastCommPowerShare: 0.5,
  /** downlink "save-power": batch data for fewer contacts. */
  savePowerCommPowerShare: -0.5,
  /** Hours added per batch wait, divided by the number of ground stations. */
  savePowerBatchHours: 6,
} as const;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const round1 = (value: number): number => Math.round(value * 10) / 10;
const round3 = (value: number): number => Math.round(value * 1000) / 1000;

type AppliedDecisions = SimDiagnostics["decisions"];
type Quadrant = NonNullable<MissionDecisions["retask"]>["quadrant"];

function applyDecisionDefaults(
  decisions: MissionDecisions | undefined,
): AppliedDecisions {
  return {
    focus: decisions?.focus ?? "wide",
    downlink: decisions?.downlink ?? "standard",
    ...(decisions?.retask ? { retask: { ...decisions.retask } } : {}),
  };
}

/** Row 0 is the southern edge of every mission grid and column 0 the western edge. */
function inQuadrant(
  cell: MissionGridCell,
  quadrant: Quadrant,
  rows: number,
  columns: number,
): boolean {
  const north = cell.row >= rows / 2;
  const east = cell.column >= columns / 2;
  return (quadrant[0] === "n") === north && (quadrant[1] === "e") === east;
}

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
    const phase =
      ((hour / 24) * Math.PI * 2) / Math.max(0.35, orbit?.revisitFactor ?? 1);
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
    score: {
      accuracy: 0,
      responseTime: 0,
      coverage: 0,
      costEfficiency: 0,
      reliability: 0,
      total: 0,
    },
    cells: mission.grid.map((cell) => ({
      id: cell.id,
      truth: cell.truth,
      observed: false,
      detected: false,
    })),
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
  if (resources.violations.length > 0)
    return invalidResult(mission, resources.violations);

  const decisions = applyDecisionDefaults(design.decisions);
  const effects = DECISION_EFFECTS;
  const instruments = selectedInstruments(design);
  const orbit = findPart(partsCatalog.orbits, design.orbit)!;
  const battery = findPart(partsCatalog.batteries, design.battery)!;
  const comm = findPart(partsCatalog.communications, design.comm)!;
  const rules = categoryRules[mission.category];
  const dataMargin =
    resources.dataGBPerDay === 0
      ? 1
      : clamp01(
          (resources.downlinkGBPerDay +
            resources.storageGB / mission.durationDays) /
            resources.dataGBPerDay,
        );
  // Downlink strategy changes how long the transmitter runs: on every contact
  // ("fast") or only for batched contacts ("save-power"). "standard" adds nothing.
  const commPowerShare =
    decisions.downlink === "fast"
      ? effects.fastCommPowerShare
      : decisions.downlink === "save-power"
        ? effects.savePowerCommPowerShare
        : 0;
  const powerUseW =
    commPowerShare === 0
      ? resources.powerUseW
      : resources.powerUseW + comm.powerW * commPowerShare;
  const powerMargin = clamp01(
    resources.powerGenW / Math.max(1, powerUseW) - 0.05,
  );
  // The battery carries the transmitter through eclipse contacts, so the same
  // draw shrinks (or frees) the share of the orbit the payload can keep working.
  const batteryContinuity =
    commPowerShare === 0
      ? battery.eclipseContinuity
      : clamp01(
          battery.eclipseContinuity *
            (1 -
              (commPowerShare * comm.powerW) /
                Math.max(1, resources.powerGenW)),
        );
  const operationFactor = clamp01(
    (0.62 + powerMargin * 0.38) * batteryContinuity * (0.7 + dataMargin * 0.3),
  );
  const coverageChance = clamp01(
    ((0.17 * orbit.swathFactor) / Math.max(0.35, orbit.revisitFactor)) *
      operationFactor,
  );
  const baseLatencyHours = Math.max(
    0.25,
    (resources.dataGBPerDay / Math.max(0.1, resources.downlinkGBPerDay)) * 24,
  );
  const downlinkLatencyHours =
    decisions.downlink === "fast"
      ? Math.max(0.25, baseLatencyHours * effects.fastLatencyFactor)
      : decisions.downlink === "save-power"
        ? baseLatencyHours + effects.savePowerBatchHours / design.groundStations
        : baseLatencyHours;
  const cloudPenetrating = instruments.some(
    (instrument) =>
      instrument.cloudPenetrating &&
      (instrument.categoryFit[mission.category] ?? 0) >= 0.5,
  );
  const bestInstrument = instruments.reduce((best, current) => {
    const currentFit = current.categoryFit[mission.category] ?? 0.08;
    const bestFit = best.categoryFit[mission.category] ?? 0.08;
    return currentFit * current.resolutionScore > bestFit * best.resolutionScore
      ? current
      : best;
  });
  const fit = bestInstrument.categoryFit[mission.category] ?? 0.08;
  const passSpacingHours =
    (12 * orbit.revisitFactor) / Math.max(0.4, orbit.swathFactor);
  const gridRows = mission.grid.reduce(
    (max, cell) => Math.max(max, cell.row + 1),
    0,
  );
  const gridColumns = mission.grid.reduce(
    (max, cell) => Math.max(max, cell.column + 1),
    0,
  );
  const focusTargetFactor =
    decisions.focus === "hazard" ? effects.hazardFocusTargetBoost : 1;
  const focusBackgroundFactor =
    decisions.focus === "hazard" ? effects.hazardFocusBackgroundFactor : 1;

  const cellResults: SimCellResult[] = [];
  let firstDeliveryHours: number | null = null;
  let firstDetectionHours: number | null = null;
  let truePositives = 0;
  let falsePositives = 0;
  let observedCells = 0;
  let targetCells = 0;
  let hazardNeverInView = 0;
  let hazardCloudBlocked = 0;
  let hazardNotRecognised = 0;
  let hazardBeforeEvent = 0;

  mission.grid.forEach((cell, cellIndex) => {
    const isTarget = cell.truth > 0.5;
    if (isTarget) targetCells += 1;
    const rng = createSeededRng(mixSeed(mission.seed, cellIndex));
    let observed = false;
    let detected = false;
    let detectedHour: number | null = null;
    let truePositive = false;
    let classifiedBeforeEvent = false;
    let clearLookAfterEvent = false;
    const lookHours: number[] = [];
    const blockedHours: number[] = [];
    // Missions task the spacecraft toward known risk areas; background cells remain
    // useful for measuring total regional coverage and false positives.
    const cellCoverageChance = clamp01(
      coverageChance *
        (isTarget ? 1.55 : 1) *
        (isTarget ? focusTargetFactor : focusBackgroundFactor),
    );
    const retaskInside = decisions.retask
      ? inQuadrant(cell, decisions.retask.quadrant, gridRows, gridColumns)
      : false;
    const cloudFailureProbability = cloudPenetrating
      ? cell.cloudProbability * 0.08
      : cell.cloudProbability * rules.cloudImpact;

    for (let day = 0; day < mission.durationDays && !detected; day += 1) {
      const lookChance =
        decisions.retask && day >= decisions.retask.day
          ? clamp01(
              cellCoverageChance *
                (retaskInside
                  ? effects.retaskInsideBoost
                  : effects.retaskOutsideFactor),
            )
          : cellCoverageChance;
      if (rng() >= lookChance) continue;
      const cloudRoll = rng();
      if (cloudRoll < cloudFailureProbability) {
        // A blocked pass still happened. cloudRoll / probability is uniform on
        // [0, 1) given the block, so it places the pass without an extra draw.
        const blockedHour = round1(
          day * 24 + (cloudRoll / cloudFailureProbability) * passSpacingHours,
        );
        lookHours.push(blockedHour);
        blockedHours.push(blockedHour);
        continue;
      }

      if (!observed) {
        observed = true;
        observedCells += 1;
      }
      const detectionProbability = clamp01(
        0.1 +
          0.9 *
            fit *
            bestInstrument.resolutionScore *
            orbit.resolutionFactor *
            cell.detectability,
      );
      const observationHour = day * 24 + rng() * passSpacingHours;
      lookHours.push(round1(observationHour));

      if (isTarget && day >= cell.eventDay) {
        clearLookAfterEvent = true;
        detected = rng() < detectionProbability;
        if (detected) {
          truePositive = true;
          truePositives += 1;
          detectedHour = round1(observationHour);
          firstDetectionHours =
            firstDetectionHours === null
              ? observationHour
              : Math.min(firstDetectionHours, observationHour);
          const delivery = observationHour + downlinkLatencyHours;
          firstDeliveryHours =
            firstDeliveryHours === null
              ? delivery
              : Math.min(firstDeliveryHours, delivery);
        }
      } else {
        detected = rng() < 0.005 + (1 - fit) * 0.05;
        if (detected) {
          falsePositives += 1;
          detectedHour = round1(observationHour);
        }
        // A target cell seen before its event day is classified as background.
        if (isTarget) classifiedBeforeEvent = true;
        // A retask is a new observation request: cells in the chosen quadrant that
        // were classified earlier are reopened and looked at again from that day.
        if (
          !detected &&
          retaskInside &&
          decisions.retask &&
          day < decisions.retask.day
        ) {
          day = decisions.retask.day - 1;
          continue;
        }
        // A background cell only needs one classification; repeated looks are
        // reserved for evolving hazard cells and must not compound false alarms.
        break;
      }
    }

    const cellResult: SimCellResult = {
      id: cell.id,
      truth: cell.truth,
      observed,
      detected,
      lookHours,
      blockedHours,
      detectedHour,
    };
    if (isTarget && !truePositive) {
      // The branch that ended this cell's loop is the reason it was missed.
      if (clearLookAfterEvent) {
        cellResult.missReason = "not-recognised";
        hazardNotRecognised += 1;
      } else if (classifiedBeforeEvent) {
        cellResult.missReason = "before-event";
        hazardBeforeEvent += 1;
      } else if (lookHours.length > 0) {
        cellResult.missReason = "cloud-blocked";
        hazardCloudBlocked += 1;
      } else {
        cellResult.missReason = "never-in-view";
        hazardNeverInView += 1;
      }
    }
    cellResults.push(cellResult);
  });

  const storageMargin = clamp01(
    resources.storageGB / Math.max(1, resources.dataGBPerDay),
  );
  const reliability = clamp01(
    orbit.reliabilityFactor *
      (0.55 + powerMargin * 0.3 + batteryContinuity * 0.15) *
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
    targetResponseHours:
      mission.targetResponseHours || rules.targetResponseHours,
    reliability,
    resources,
    constraints,
  });
  const success = score.total >= 60 && score.coverage >= 50;
  const diagnostics: SimDiagnostics = {
    hazardCells: targetCells,
    hazardDetected: truePositives,
    hazardNeverInView,
    hazardCloudBlocked,
    hazardNotRecognised,
    hazardBeforeEvent,
    falseAlarms: falsePositives,
    observedCells,
    totalCells: mission.grid.length,
    firstDetectionHours:
      firstDetectionHours === null ? null : round1(firstDetectionHours),
    downlinkLatencyHours: round1(downlinkLatencyHours),
    targetResponseHours:
      mission.targetResponseHours || rules.targetResponseHours,
    powerMargin: round3(powerMargin),
    dataMargin: round3(dataMargin),
    storageMargin: round3(storageMargin),
    batteryContinuity: round3(batteryContinuity),
    operationFactor: round3(operationFactor),
    coverageChance: round3(coverageChance),
    reliabilityFactor: round3(reliability),
    bestInstrumentId: bestInstrument.id,
    bestInstrumentFit: fit,
    cloudPenetrating,
    weights: evaluationWeights(mission.category),
    decisions,
  };

  return {
    score,
    cells: cellResults,
    timeline: createTimeline(mission, design.orbit),
    feedback: generateFeedback(score, resources, success, diagnostics),
    success,
    firstDeliveryHours:
      firstDeliveryHours === null ? null : round1(firstDeliveryHours),
    engineVersion: ENGINE_VERSION,
    diagnostics,
  };
}
