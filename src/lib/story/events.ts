// Turns a finished simulation into a short, narrated mission story.
// Pure and deterministic: every number below is either an engine output
// (SimResult), a resource summary value, a catalog value, or simple arithmetic
// on those. Nothing here changes the score.
import type {
  Mission,
  ResourceSummary,
  SatelliteDesign,
  ScoreBreakdown,
  SimResult,
} from "@/types/game";
import { partsCatalog } from "@/lib/sim";
import { getMissionStory } from "./missions";
import { partExplainers, slotExplainers, type PartSlot } from "./parts";

export type StoryEventKind =
  | "launch"
  | "orbit"
  | "pass"
  | "detect"
  | "downlink"
  | "problem"
  | "deadline"
  | "outcome";
export type StoryTone = "good" | "bad" | "neutral";
/**
 * engine   – the hour is an engine output (e.g. firstDeliveryHours).
 * derived  – the hour is arithmetic on real values (explained in `detail`).
 * mission  – a summary of the whole mission, not a moment in time.
 */
export type StoryTiming = "engine" | "derived" | "mission";
export type LaunchStage = "liftoff" | "orbit" | "panels" | "contact";

export interface StoryEvent {
  id: string;
  hour: number;
  kind: StoryEventKind;
  tone: StoryTone;
  title: string;
  detail: string;
  timing: StoryTiming;
  launchStage?: LaunchStage;
  causeSlot?: PartSlot;
  causePartId?: string;
}

export interface MissionDiagnosis {
  deadlineHours: number;
  /** Engine output: hour the first useful hazard data reached the ground. */
  deliveredHours: number | null;
  /** Same formula the engine uses: data generated / downlink capacity × 24 h (min 0.25 h). */
  radioDelayHours: number;
  /** Derived: delivery hour minus radio delay. */
  detectHour: number | null;
  met: boolean;
  /** Why the deadline was missed, if it was. */
  lateCause?: PartSlot;
  /** The slot that limits how soon the hazard is found (sensor fit or orbit). */
  detectionCause: PartSlot;
  hazardCells: number;
  detectedHazards: number;
  /** Hazard cells the satellite looked at but could not identify. */
  unclearHazards: number;
  /** Hazard cells never observed with a high cloud/smoke probability. */
  blockedHazards: number;
  /** Hazard cells never observed for other reasons (no pass). */
  unseenHazards: number;
  falseAlarms: number;
  observedCells: number;
  totalCells: number;
  bestFit: number;
  cloudPenetrating: boolean;
  powerMarginPct: number | null;
  hazardRegions: string[];
}

/** Cells at or above this cloud probability count as "likely hidden by smoke or cloud". */
export const BLOCKED_CLOUD_PROBABILITY = 0.3;

const round1 = (value: number) => Math.round(value * 10) / 10;
const hours = (value: number) => `${round1(value)} h`;

const slotParts: Record<
  Exclude<PartSlot, "instruments" | "groundStations">,
  { id: string; name: string; costM: number }[]
> = {
  orbit: partsCatalog.orbits,
  solar: partsCatalog.solar,
  battery: partsCatalog.batteries,
  comm: partsCatalog.communications,
  storage: partsCatalog.storage,
};

export const slotNoun: Record<PartSlot, string> = {
  instruments: "sensor",
  orbit: "orbit",
  solar: "solar array",
  battery: "battery",
  comm: "radio",
  groundStations: "ground stations",
  storage: "storage",
};

/** Human name of the part the player picked for a slot, e.g. "UHF radio". */
export function partLabel(slot: PartSlot, design: SatelliteDesign): string {
  if (slot === "groundStations")
    return `${design.groundStations} ground station${design.groundStations === 1 ? "" : "s"}`;
  if (slot === "instruments") {
    const names = design.instruments.map(
      (id) => partsCatalog.instruments.find((p) => p.id === id)?.name ?? id,
    );
    return names.join(" + ") || "no sensor";
  }
  const part = slotParts[slot].find((p) => p.id === design[slot]);
  const name = part?.name ?? design[slot];
  return slot === "comm" ? `${name} radio` : name;
}

function causePartId(
  slot: PartSlot,
  design: SatelliteDesign,
): string | undefined {
  if (slot === "groundStations") return String(design.groundStations);
  if (slot === "instruments") return design.instruments[0];
  return design[slot];
}

function partWeakness(slot: PartSlot, design: SatelliteDesign): string {
  const id = causePartId(slot, design);
  return (id && partExplainers[id]?.bad) || slotExplainers[slot].ifWeak;
}

function regionOf(mission: Mission, lat: number, lon: number): string {
  const [west, south, east, north] = mission.bbox;
  const x = (lon - west) / (east - west);
  const y = (lat - south) / (north - south);
  const ns = y > 2 / 3 ? "north" : y < 1 / 3 ? "south" : "";
  const ew = x > 2 / 3 ? "east" : x < 1 / 3 ? "west" : "";
  return ns + ew || "center";
}

function listRegions(regions: string[]): string {
  const named = regions.map((r) =>
    r === "center" ? "the center" : `the ${r}`,
  );
  if (named.length <= 1) return named[0] ?? "";
  return named.slice(0, -1).join(", ") + " and " + named[named.length - 1];
}

/** The radio/ground-station slot to blame for slow downlink. */
function downlinkSlot(design: SatelliteDesign): PartSlot {
  const rate =
    partsCatalog.communications.find((c) => c.id === design.comm)?.rateGbps ??
    0;
  return design.groundStations === 1 && rate >= 2 ? "groundStations" : "comm";
}

export function diagnoseMission(
  mission: Mission,
  design: SatelliteDesign,
  resources: ResourceSummary,
  result: SimResult,
): MissionDiagnosis {
  const deadlineHours = mission.targetResponseHours;
  const gridById = new Map(mission.grid.map((cell) => [cell.id, cell]));
  const instruments = design.instruments
    .map((id) => partsCatalog.instruments.find((p) => p.id === id))
    .filter((p) => p !== undefined);
  const bestFit = instruments.reduce(
    (best, p) => Math.max(best, p.categoryFit[mission.category] ?? 0),
    0,
  );
  const cloudPenetrating = instruments.some(
    (p) => p.cloudPenetrating && (p.categoryFit[mission.category] ?? 0) >= 0.5,
  );
  const radioDelayHours =
    resources.dataGBPerDay === 0
      ? 0.25
      : Math.max(
          0.25,
          (resources.dataGBPerDay / Math.max(0.1, resources.downlinkGBPerDay)) *
            24,
        );
  const deliveredHours = result.firstDeliveryHours;
  const detectHour =
    deliveredHours === null
      ? null
      : Math.max(0, round1(deliveredHours - radioDelayHours));
  const met = deliveredHours !== null && deliveredHours <= deadlineHours;

  let hazardCells = 0;
  let detectedHazards = 0;
  let unclearHazards = 0;
  let blockedHazards = 0;
  let unseenHazards = 0;
  let falseAlarms = 0;
  let observedCells = 0;
  const regions = new Map<string, number>();
  for (const cell of result.cells) {
    if (cell.observed) observedCells += 1;
    const source = gridById.get(cell.id);
    if (cell.truth > 0.5) {
      hazardCells += 1;
      if (cell.detected) {
        detectedHazards += 1;
        if (source) {
          const region = regionOf(mission, source.lat, source.lon);
          regions.set(region, (regions.get(region) ?? 0) + 1);
        }
      } else if (cell.observed) unclearHazards += 1;
      else if ((source?.cloudProbability ?? 0) >= BLOCKED_CLOUD_PROBABILITY)
        blockedHazards += 1;
      else unseenHazards += 1;
    } else if (cell.detected) falseAlarms += 1;
  }

  const detectionCause: PartSlot = bestFit < 0.85 ? "instruments" : "orbit";
  let lateCause: PartSlot | undefined;
  if (!met) {
    if (deliveredHours === null || detectHour === null) {
      lateCause =
        bestFit < 0.5 || (blockedHazards > unseenHazards && !cloudPenetrating)
          ? "instruments"
          : "orbit";
    } else if (
      radioDelayHours >= detectHour ||
      radioDelayHours > deadlineHours
    ) {
      lateCause = downlinkSlot(design);
    } else {
      lateCause = detectionCause;
    }
  }

  return {
    deadlineHours,
    deliveredHours,
    radioDelayHours,
    detectHour,
    met,
    lateCause,
    detectionCause,
    hazardCells,
    detectedHazards,
    unclearHazards,
    blockedHazards,
    unseenHazards,
    falseAlarms,
    observedCells,
    totalCells: result.cells.length,
    bestFit,
    cloudPenetrating,
    powerMarginPct:
      resources.powerGenW > 0
        ? Math.round(
            ((resources.powerGenW - resources.powerUseW) /
              resources.powerGenW) *
              100,
          )
        : null,
    hazardRegions: [...regions]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([region]) => region),
  };
}

const kindOrder: Record<StoryEventKind, number> = {
  launch: 0,
  orbit: 1,
  problem: 2,
  pass: 3,
  detect: 4,
  downlink: 5,
  deadline: 6,
  outcome: 7,
};

/**
 * Build the ordered, narrated event list for one attempt.
 * Hours tagged `derived` are explanations of real values, not engine outputs.
 */
export function buildMissionStory(
  mission: Mission,
  design: SatelliteDesign,
  resources: ResourceSummary,
  result: SimResult,
): StoryEvent[] {
  const story = getMissionStory(mission.slug);
  const hazard = story?.hazardNoun ?? "hazard";
  const dependents = story?.dependents ?? "Emergency teams";
  const d = diagnoseMission(mission, design, resources, result);
  const endHour = mission.durationDays * 24;
  const deadline = d.deadlineHours;
  const events: StoryEvent[] = [];
  const blame = (slot: PartSlot) => ({
    causeSlot: slot,
    causePartId: causePartId(slot, design),
  });
  const orbit = partsCatalog.orbits.find((o) => o.id === design.orbit);
  const battery = partsCatalog.batteries.find((b) => b.id === design.battery);

  // ── Launch ────────────────────────────────────────────────────────────
  events.push({
    id: "launch",
    hour: 0,
    kind: "launch",
    tone: "neutral",
    timing: "derived",
    launchStage: "liftoff",
    title: "Liftoff",
    detail: `Your ${resources.massKg} kg satellite leaves the pad carrying ${partLabel("instruments", design)}.`,
  });
  if (orbit) {
    events.push({
      id: "orbit",
      hour: 0,
      kind: "orbit",
      tone: "neutral",
      timing: "derived",
      launchStage: "orbit",
      title: `Orbit reached: ${orbit.name}`,
      detail: [
        partExplainers[orbit.id]?.does,
        partExplainers[orbit.id] && `Upside: ${partExplainers[orbit.id].good}`,
        partExplainers[orbit.id] && `Downside: ${partExplainers[orbit.id].bad}`,
      ]
        .filter(Boolean)
        .join(" "),
    });
  }
  if (d.bestFit < 0.5) {
    events.push({
      id: "sensor-blind",
      hour: 0,
      kind: "problem",
      tone: "bad",
      timing: "derived",
      launchStage: "orbit",
      title: `Sensors on — but none of them can see ${hazard}`,
      detail: `${partLabel("instruments", design)} is a poor match for this hazard. ${slotExplainers.instruments.ifWeak}`,
      ...blame("instruments"),
    });
  } else if (d.bestFit < 0.85) {
    events.push({
      id: "sensor-partial",
      hour: 0,
      kind: "problem",
      tone: "bad",
      timing: "derived",
      launchStage: "orbit",
      title: `Sensors on — they only partly see ${hazard}`,
      detail: `${partLabel("instruments", design)} can miss some of the ${hazard} even when it flies right over it.`,
      ...blame("instruments"),
    });
  }

  const tightPower =
    resources.powerGenW > 0 &&
    resources.powerUseW / resources.powerGenW >= 0.85;
  if (tightPower) {
    events.push({
      id: "power-margin",
      hour: 0,
      kind: "problem",
      tone: "bad",
      timing: "derived",
      launchStage: "panels",
      title: `Solar panels deployed: power margin only ${d.powerMarginPct}%`,
      detail: `The satellite needs ${resources.powerUseW} W and the panels make ${resources.powerGenW} W. ${slotExplainers.solar.ifWeak}`,
      ...blame("solar"),
    });
  } else {
    events.push({
      id: "panels",
      hour: 0,
      kind: "launch",
      tone: "good",
      timing: "derived",
      launchStage: "panels",
      title: `Solar panels deployed: ${d.powerMarginPct ?? 0}% power to spare`,
      detail: `The panels make ${resources.powerGenW} W; the satellite needs ${resources.powerUseW} W.`,
    });
  }
  if (battery && battery.eclipseContinuity < 0.8) {
    events.push({
      id: "battery",
      hour: 0,
      kind: "problem",
      tone: "bad",
      timing: "derived",
      launchStage: "panels",
      title: `${battery.name}: work pauses in Earth's shadow`,
      detail: `This battery keeps about ${Math.round(battery.eclipseContinuity * 100)}% of operations running through the shadow part of each orbit. ${slotExplainers.battery.ifWeak}`,
      ...blame("battery"),
    });
  }

  const downlinkTight =
    resources.downlinkGBPerDay > 0 &&
    resources.dataGBPerDay / resources.downlinkGBPerDay >= 0.8;
  const linkSlot = downlinkSlot(design);
  if (downlinkTight) {
    events.push({
      id: "downlink-tight",
      hour: 0,
      kind: "problem",
      tone: "bad",
      timing: "derived",
      launchStage: "contact",
      title: `First contact: the ${partLabel(linkSlot, design)} can't keep up`,
      detail: `Sensors collect ${resources.dataGBPerDay} GB a day, but only ${resources.downlinkGBPerDay} GB a day can be sent down. Each batch of data waits about ${hours(d.radioDelayHours)} to get home.`,
      ...blame(linkSlot),
    });
  } else {
    events.push({
      id: "contact",
      hour: 0,
      kind: "launch",
      tone: "good",
      timing: "derived",
      launchStage: "contact",
      title: "First contact with the ground",
      detail: `${partLabel("comm", design)} with ${partLabel("groundStations", design)} can send ${resources.downlinkGBPerDay} GB a day; your sensors collect ${resources.dataGBPerDay} GB. A batch of data takes about ${hours(d.radioDelayHours)} to get home.`,
    });
  }
  if (resources.storageGB > 0 && resources.dataGBPerDay > resources.storageGB) {
    events.push({
      id: "storage",
      hour: 0,
      kind: "problem",
      tone: "bad",
      timing: "derived",
      launchStage: "contact",
      title: `${partLabel("storage", design)} is too small`,
      detail: `One day of observations (${resources.dataGBPerDay} GB) does not fit in ${resources.storageGB} GB. ${slotExplainers.storage.ifWeak}`,
      ...blame("storage"),
    });
  }

  // ── Observe ───────────────────────────────────────────────────────────
  const where =
    d.hazardRegions.length === 0
      ? ""
      : d.hazardRegions.length <= 2
        ? ` in ${listRegions(d.hazardRegions)} of the map`
        : ` across the map, most of it in ${listRegions(d.hazardRegions.slice(0, 2))}`;
  const lateDetail = (cause: PartSlot) =>
    cause === "comm" || cause === "groundStations"
      ? `The ${deadline}-hour deadline has passed. Cause: the ${partLabel(cause, design)} — ${partWeakness(cause, design).toLowerCase()} Each batch waited about ${hours(d.radioDelayHours)} to get home.`
      : `The ${deadline}-hour deadline has passed. The radio only needed about ${hours(d.radioDelayHours)}; the problem was finding the ${hazard} late (around hour ${d.detectHour}). Cause: ${partLabel(cause, design)} — ${slotExplainers[cause].ifWeak.toLowerCase()}`;
  if (d.detectHour !== null && d.deliveredHours !== null) {
    events.push({
      id: "detect",
      hour: d.detectHour,
      kind: "detect",
      tone: "good",
      timing: "derived",
      title: `Your satellite spots the ${hazard}`,
      detail: `${partLabel("instruments", design)} picks up ${hazard}${where}. Now the data has to get home: about ${hours(d.radioDelayHours)} over the ${partLabel("comm", design)}. (Hour estimated as delivery time minus radio delay.)`,
    });
    const deliveredLate = d.deliveredHours > deadline;
    const lateBy = round1(d.deliveredHours - deadline);
    const spare = round1(deadline - d.deliveredHours);
    events.push({
      id: "downlink",
      hour: d.deliveredHours,
      kind: "downlink",
      tone: deliveredLate ? "bad" : "good",
      timing: "engine",
      title: deliveredLate
        ? `Data finally reaches the ground — ${lateBy} h too late`
        : `Data reaches ${dependents.toLowerCase()} — ${spare} h before the deadline`,
      detail: deliveredLate
        ? lateDetail(d.lateCause ?? "comm")
        : `The ${hazard} map is on the ground at hour ${d.deliveredHours}, in time for decisions.`,
      ...(deliveredLate && d.lateCause ? blame(d.lateCause) : {}),
    });
  }
  if (!d.met) {
    const stillOnBoard = d.detectHour !== null && d.detectHour <= deadline;
    events.push({
      id: "deadline",
      hour: deadline,
      kind: "deadline",
      tone: "bad",
      timing: "engine",
      title: `Deadline passes: hour ${deadline} — no data on the ground`,
      detail: stillOnBoard
        ? d.lateCause === "comm" || d.lateCause === "groundStations"
          ? `Your satellite already saw the ${hazard}, but the data is still waiting on board. ${slotExplainers[d.lateCause].ifWeak}`
          : `Your satellite only saw the ${hazard} around hour ${d.detectHour} — too close to the deadline for the data to get home in time.`
        : d.deliveredHours === null
          ? `${dependents} must decide without your map. ${slotExplainers[d.lateCause ?? "orbit"].ifWeak}`
          : `Your satellite has not found the ${hazard} yet. ${slotExplainers[d.detectionCause].ifWeak}`,
      ...blame(
        stillOnBoard || d.deliveredHours === null
          ? (d.lateCause ?? "orbit")
          : d.detectionCause,
      ),
    });
  } else {
    events.push({
      id: "deadline",
      hour: deadline,
      kind: "deadline",
      tone: "good",
      timing: "engine",
      title: `Deadline at hour ${deadline}: met`,
      detail: `${dependents} already have your map.`,
    });
  }

  // ── Whole-mission summaries ───────────────────────────────────────────
  if (d.blockedHazards > 0) {
    events.push({
      id: "blocked",
      hour: endHour,
      kind: "pass",
      tone: "bad",
      timing: "mission",
      title: `${d.blockedHazards} danger zone${d.blockedHazards === 1 ? "" : "s"} likely hidden by smoke or cloud`,
      detail: d.cloudPenetrating
        ? `These areas were never seen. They are often covered, so even your cloud-piercing sensor did not get a clear look in time.`
        : `${story?.obstacle ?? "Clouds block the view."} None of your sensors can see through it.`,
      ...(d.cloudPenetrating ? blame("orbit") : blame("instruments")),
    });
  }
  if (d.unseenHazards > 0) {
    events.push({
      id: "unseen",
      hour: endHour,
      kind: "pass",
      tone: "bad",
      timing: "mission",
      title: `${d.unseenHazards} danger zone${d.unseenHazards === 1 ? " was" : "s were"} never passed over`,
      detail: `${partLabel("orbit", design)}: ${slotExplainers.orbit.ifWeak}`,
      ...blame("orbit"),
    });
  }
  if (d.unclearHazards > 0) {
    events.push({
      id: "unclear",
      hour: endHour,
      kind: "pass",
      tone: "bad",
      timing: "mission",
      title: `${d.unclearHazards} danger zone${d.unclearHazards === 1 ? "" : "s"} seen but not recognised`,
      detail: `The satellite looked, but ${partLabel("instruments", design)} could not tell the ${hazard} was there.`,
      ...blame("instruments"),
    });
  }
  if (d.falseAlarms > 0) {
    events.push({
      id: "false-alarms",
      hour: endHour,
      kind: "problem",
      tone: "bad",
      timing: "mission",
      title: `${d.falseAlarms} false alarm${d.falseAlarms === 1 ? "" : "s"}`,
      detail: `Safe areas were reported as ${hazard}. Sensors that match the hazard better make fewer false alarms.`,
      ...blame("instruments"),
    });
  }
  events.push({
    id: "coverage",
    hour: endHour,
    kind: "pass",
    tone: result.score.coverage >= 50 ? "good" : "bad",
    timing: "mission",
    title: `Found ${d.detectedHazards} of ${d.hazardCells} danger zones`,
    detail: `Over ${mission.durationDays} days the satellite observed ${d.observedCells} of ${d.totalCells} map cells (coverage score ${round1(result.score.coverage)}).`,
    ...(result.score.coverage < 50 ? blame("orbit") : {}),
  });
  events.push({
    id: "outcome",
    hour: endHour,
    kind: "outcome",
    tone: result.success ? "good" : "bad",
    timing: "mission",
    title: result.success ? "Mission successful" : "Mission goal not reached",
    detail: `Score ${round1(result.score.total)} / 100. Success needs at least 60 points and 50% coverage.`,
  });

  return events
    .map((event, index) => ({ event, index }))
    .sort((a, b) => {
      const aMission = a.event.timing === "mission" ? 1 : 0;
      const bMission = b.event.timing === "mission" ? 1 : 0;
      return (
        aMission - bMission ||
        a.event.hour - b.event.hour ||
        kindOrder[a.event.kind] - kindOrder[b.event.kind] ||
        a.index - b.index
      );
    })
    .map(({ event }) => event);
}

/** One big sentence for the debrief. */
export function outcomeHeadline(
  mission: Mission,
  diagnosis: MissionDiagnosis,
): { tone: StoryTone; sentence: string } {
  const story = getMissionStory(mission.slug);
  const hazard = story?.hazardNoun ?? "hazard";
  const dependents = story?.dependents ?? "Emergency teams";
  const { deliveredHours, deadlineHours } = diagnosis;
  if (deliveredHours === null)
    return {
      tone: "bad",
      sentence: `Your satellite never delivered a ${hazard} map. ${dependents} had to decide without it.`,
    };
  if (diagnosis.met)
    return {
      tone: "good",
      sentence: `${dependents} got your ${hazard} map at hour ${deliveredHours} — ${round1(deadlineHours - deliveredHours)} hours before the ${deadlineHours}-hour deadline.`,
    };
  return {
    tone: "bad",
    sentence: `Your data arrived at hour ${deliveredHours}, ${round1(deliveredHours - deadlineHours)} hours late. ${dependents} had to decide without it.`,
  };
}

const metricLabels: Record<keyof Omit<ScoreBreakdown, "total">, string> = {
  accuracy: "Observation accuracy",
  responseTime: "Response time",
  coverage: "Coverage",
  costEfficiency: "Cost efficiency",
  reliability: "Reliability",
};

export interface NextStep {
  metric: keyof Omit<ScoreBreakdown, "total">;
  metricLabel: string;
  value: number;
  slot: PartSlot;
  suggestedPartId?: string;
  text: string;
}

function nextPart(
  slot: PartSlot,
  design: SatelliteDesign,
  direction: 1 | -1,
): { id: string; name: string } | undefined {
  if (slot === "groundStations") {
    const ladder = [1, 3, 5] as const;
    const next = ladder[ladder.indexOf(design.groundStations) + direction];
    return next
      ? { id: String(next), name: `${next} ground stations` }
      : undefined;
  }
  if (slot === "instruments" || slot === "orbit") return undefined;
  const list = slotParts[slot];
  const next = list[list.findIndex((p) => p.id === design[slot]) + direction];
  return next
    ? { id: next.id, name: slot === "comm" ? `${next.name} radio` : next.name }
    : undefined;
}

/** A concrete "try this next" from the weakest score component and its responsible slot. */
export function suggestNextStep(
  mission: Mission,
  design: SatelliteDesign,
  result: SimResult,
  diagnosis: MissionDiagnosis,
): NextStep {
  // A cheaper part is not useful advice while the mission is still failing.
  const metrics = (
    Object.keys(metricLabels) as (keyof typeof metricLabels)[]
  ).filter((m) => m !== "costEfficiency");
  const metric = metrics.reduce(
    (low, m) => (result.score[m] < result.score[low] ? m : low),
    metrics[0],
  );
  const value = round1(result.score[metric]);
  const base = { metric, metricLabel: metricLabels[metric], value };
  const hazard = getMissionStory(mission.slug)?.hazardNoun ?? "hazard";

  if (
    metric === "accuracy" ||
    (metric === "coverage" &&
      diagnosis.blockedHazards > diagnosis.unseenHazards &&
      !diagnosis.cloudPenetrating)
  ) {
    if (diagnosis.bestFit < 0.85 || metric === "coverage") {
      const best = [...partsCatalog.instruments]
        .filter((p) => metric !== "coverage" || p.cloudPenetrating)
        .sort(
          (a, b) =>
            (b.categoryFit[mission.category] ?? 0) -
            (a.categoryFit[mission.category] ?? 0),
        )[0];
      return {
        ...base,
        slot: "instruments",
        suggestedPartId: best?.id,
        text: best
          ? `Try the ${best.name}: it is the best match in the catalog for ${hazard}${metric === "coverage" ? " that also sees through cloud" : ""}.`
          : `Try a sensor that is a better match for ${hazard}.`,
      };
    }
    return {
      ...base,
      slot: "orbit",
      suggestedPartId: design.orbit === "leo_400" ? undefined : "leo_400",
      text: `Your sensor fits the hazard, so sharpen the view: a lower orbit (Low LEO) sees more detail.`,
    };
  }
  if (metric === "responseTime") {
    const slot = diagnosis.lateCause ?? downlinkSlot(design);
    if (slot === "comm" || slot === "groundStations") {
      const up =
        nextPart(slot, design, 1) ??
        nextPart(slot === "comm" ? "groundStations" : "comm", design, 1);
      const upSlot = nextPart(slot, design, 1)
        ? slot
        : slot === "comm"
          ? "groundStations"
          : "comm";
      return {
        ...base,
        slot: upSlot,
        suggestedPartId: up?.id,
        text: up
          ? `Swap the ${partLabel(upSlot, design)} for ${up.name}. Right now each batch of data waits about ${hours(diagnosis.radioDelayHours)} to get home.`
          : `Your downlink is already the fastest available; look at the orbit so the satellite finds the ${hazard} sooner.`,
      };
    }
    return {
      ...base,
      slot,
      text:
        slot === "orbit"
          ? `The radio was fast enough — the satellite found the ${hazard} too late. Try an orbit that passes over the city more often, or a bigger battery so fewer passes are lost.`
          : `Try a sensor that is a better match for ${hazard}, so it recognises it on the first pass.`,
    };
  }
  if (metric === "coverage") {
    return {
      ...base,
      slot: "orbit",
      text: `Try an orbit with a wider strip or more frequent passes. Each orbit's trade-off is shown in the designer.`,
    };
  }
  if (metric === "reliability") {
    const slot: PartSlot = nextPart("battery", design, 1) ? "battery" : "solar";
    const up = nextPart(slot, design, 1);
    return {
      ...base,
      slot,
      suggestedPartId: up?.id,
      text: up
        ? `Swap the ${partLabel(slot, design)} for the ${up.name} so the satellite keeps working through shadow and busy passes.`
        : `Add margin to power, storage or downlink so fewer observations are lost.`,
    };
  }
  // costEfficiency: the most expensive non-sensor part that has a cheaper option.
  const candidates = (["orbit", "comm", "solar", "battery", "storage"] as const)
    .map((slot) => ({
      slot,
      part: slotParts[slot].find((p) => p.id === design[slot]),
    }))
    .filter(
      (c) => c.part && slotParts[c.slot].some((p) => p.costM < c.part!.costM),
    )
    .sort((a, b) => b.part!.costM - a.part!.costM);
  const pick = candidates[0];
  if (pick) {
    const cheaper = nextPart(pick.slot, design, -1);
    return {
      ...base,
      slot: pick.slot,
      suggestedPartId: cheaper?.id,
      text: `Your ${partLabel(pick.slot, design)} costs $${pick.part!.costM}M. ${cheaper ? `Would the ${cheaper.name} still do the job?` : "Is a cheaper option enough?"} Check the other scores do not drop.`,
    };
  }
  return {
    ...base,
    slot: "instruments",
    text: "Try fewer or cheaper sensors, if the hazard is still covered.",
  };
}

/** "Radio: UHF → X-band" lines for an attempt comparison. */
export function describeDesignChanges(
  before: SatelliteDesign,
  after: SatelliteDesign,
): string[] {
  const slots: PartSlot[] = [
    "instruments",
    "orbit",
    "solar",
    "battery",
    "comm",
    "groundStations",
    "storage",
  ];
  return slots
    .filter(
      (slot) => JSON.stringify(before[slot]) !== JSON.stringify(after[slot]),
    )
    .map((slot) => {
      const title = slotExplainers[slot].title.replace(/\s*\(.*\)$/, "");
      return `${title}: ${partLabel(slot, before)} → ${partLabel(slot, after)}`;
    });
}
