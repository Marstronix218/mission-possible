// Pure model behind the OBSERVE playback. Everything drawn on the mission map
// is read from the engine result at a given mission hour: hazard onset from the
// mission grid (eventDay), passes from cells[].lookHours / blockedHours,
// detections from detectedHour, deliveries from detectedHour + the engine's
// downlink latency. Where the picture is simplified (orbit drawing, storage
// gauge) the simplification is stated in the UI.
import type {
  Mission,
  MissionDecisions,
  MissionGridCell,
  ResourceSummary,
  SatelliteDesign,
  SimCellResult,
  SimResult,
} from "@/types/game";
import { partsCatalog } from "@/lib/sim";

export type Quadrant = NonNullable<MissionDecisions["retask"]>["quadrant"];

export const quadrantName: Record<Quadrant, string> = {
  nw: "north-west",
  ne: "north-east",
  sw: "south-west",
  se: "south-east",
};

export function gridSize(mission: Mission) {
  const rows = mission.grid.reduce((max, c) => Math.max(max, c.row + 1), 0);
  const columns = mission.grid.reduce(
    (max, c) => Math.max(max, c.column + 1),
    0,
  );
  return { rows, columns };
}

/** Same rule as the engine: row 0 is the southern edge, column 0 the western edge. */
export function quadrantOf(
  cell: Pick<MissionGridCell, "row" | "column">,
  rows: number,
  columns: number,
): Quadrant {
  const north = cell.row >= rows / 2;
  const east = cell.column >= columns / 2;
  return ((north ? "n" : "s") + (east ? "e" : "w")) as Quadrant;
}

const isHazard = (cell: { truth: number }) => cell.truth > 0.5;
/** A pre-event flag on an eventual hazard cell is a false alarm, not a find. */
export const isTrueDetection = (cell: SimCellResult) =>
  cell.detected && isHazard(cell) && cell.missReason === undefined;

// ── Mid-mission retask offer ───────────────────────────────────────────

export interface RetaskOffer {
  day: number;
  quadrant: Quadrant;
  /** "new-hazard": hazard cells really start in that quadrant on/after `day` (mission grid eventDay). */
  reason: "new-hazard" | "unfound";
  /** Hazard cells behind the request (new ones, or ones not yet found by that day). */
  cells: number;
}

/**
 * Offer a retask only when the data supports one:
 * 1. hazard cells that start later in the mission (eventDay > 0) — the request
 *    arrives on the first such day, aimed at the quadrant with most of them;
 * 2. otherwise, mid-mission, the quadrant with most hazard cells the current
 *    result has not found by then.
 * Returns null when neither applies.
 */
export function retaskOffer(
  mission: Mission,
  result: SimResult,
): RetaskOffer | null {
  const { rows, columns } = gridSize(mission);
  const late = mission.grid.filter(
    (c) => isHazard(c) && c.eventDay > 0 && c.eventDay < mission.durationDays,
  );
  if (late.length > 0) {
    const groups = new Map<Quadrant, { cells: number; day: number }>();
    for (const cell of late) {
      const q = quadrantOf(cell, rows, columns);
      const g = groups.get(q) ?? { cells: 0, day: Infinity };
      groups.set(q, {
        cells: g.cells + 1,
        day: Math.min(g.day, cell.eventDay),
      });
    }
    const [quadrant, best] = [...groups].sort(
      (a, b) =>
        b[1].cells - a[1].cells ||
        a[1].day - b[1].day ||
        a[0].localeCompare(b[0]),
    )[0];
    return { day: best.day, quadrant, reason: "new-hazard", cells: best.cells };
  }
  const day = Math.max(1, Math.floor(mission.durationDays / 2));
  if (day >= mission.durationDays) return null;
  const byId = new Map(result.cells.map((c) => [c.id, c]));
  const counts = new Map<Quadrant, number>();
  for (const cell of mission.grid) {
    if (!isHazard(cell)) continue;
    const r = byId.get(cell.id);
    const foundBy =
      r &&
      isTrueDetection(r) &&
      r.detectedHour != null &&
      r.detectedHour < day * 24;
    if (foundBy) continue;
    const q = quadrantOf(cell, rows, columns);
    counts.set(q, (counts.get(q) ?? 0) + 1);
  }
  const ranked = [...counts].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
  if (!ranked.length || ranked[0][1] === 0) return null;
  return {
    day,
    quadrant: ranked[0][0],
    reason: "unfound",
    cells: ranked[0][1],
  };
}

// ── Checkpoints ────────────────────────────────────────────────────────

export type CheckpointId = "focus" | "downlink" | "retask";

export interface Checkpoint {
  id: CheckpointId;
  hour: number;
}

/**
 * Decision points in playback order. Focus and downlink change power and look
 * chances from the first pass, so they are asked at hour 0 (before any
 * observation is shown). The retask only changes days >= its day, so playback
 * up to that hour is identical with or without it.
 */
export function missionCheckpoints(offer: RetaskOffer | null): Checkpoint[] {
  const list: Checkpoint[] = [
    { id: "focus", hour: 0 },
    { id: "downlink", hour: 0 },
  ];
  if (offer) list.push({ id: "retask", hour: offer.day * 24 });
  return list;
}

/** The next unanswered checkpoint at or before `hour`, if any. */
export function dueCheckpoint(
  checkpoints: Checkpoint[],
  answered: Set<CheckpointId>,
  hour: number,
) {
  return checkpoints.find((c) => !answered.has(c.id) && c.hour <= hour + 1e-9);
}

/** Stop the clock exactly on the next unanswered checkpoint. */
export function clampToCheckpoint(
  checkpoints: Checkpoint[],
  answered: Set<CheckpointId>,
  from: number,
  to: number,
) {
  const next = checkpoints.find(
    (c) => !answered.has(c.id) && c.hour >= from - 1e-9 && c.hour <= to,
  );
  return next ? next.hour : to;
}

// ── Mission clock ──────────────────────────────────────────────────────

export interface PlaybackPlan {
  spanHours: number;
  /** Hours played slowly (around the deadline and first delivery). */
  focusHours: number;
  /** Seconds of playback for the focus part and for the rest. */
  focusSeconds: number;
  restSeconds: number;
}

export function playbackPlan(
  mission: Mission,
  result: SimResult,
): PlaybackPlan {
  const spanHours = mission.durationDays * 24;
  const delivered = result.firstDeliveryHours;
  const wanted = Math.max(
    mission.targetResponseHours * 2,
    delivered === null ? 0 : delivered + mission.targetResponseHours * 0.5,
    24,
  );
  const focusHours = Math.min(spanHours, Math.ceil(wanted));
  return {
    spanHours,
    focusHours,
    focusSeconds: 24,
    restSeconds: focusHours < spanHours ? 18 : 0,
  };
}

/** Mission hours per real second at a given hour (1× speed). */
export function hoursPerSecond(plan: PlaybackPlan, hour: number) {
  if (hour < plan.focusHours || plan.restSeconds === 0)
    return plan.focusHours / plan.focusSeconds;
  return (plan.spanHours - plan.focusHours) / plan.restSeconds;
}

/** Advance the clock by `seconds` of real time, crossing the slow/fast boundary correctly. */
export function advanceHour(plan: PlaybackPlan, hour: number, seconds: number) {
  let h = hour;
  let left = seconds;
  for (let guard = 0; guard < 3 && left > 0 && h < plan.spanHours; guard += 1) {
    const rate = hoursPerSecond(plan, h);
    const boundary = h < plan.focusHours ? plan.focusHours : plan.spanHours;
    const need = (boundary - h) / rate;
    if (need >= left) return Math.min(plan.spanHours, h + left * rate);
    h = boundary;
    left -= need;
  }
  return Math.min(plan.spanHours, h);
}

// ── Orbit / observation windows ────────────────────────────────────────

/**
 * Length of the daily observation window: the engine places each day's passes
 * in [day×24, day×24 + 12 × revisit ÷ max(0.4, swath)] hours.
 */
export function observationWindowHours(design: SatelliteDesign) {
  const orbit = partsCatalog.orbits.find((o) => o.id === design.orbit);
  if (!orbit) return 0;
  return Math.min(
    24,
    (12 * orbit.revisitFactor) / Math.max(0.4, orbit.swathFactor),
  );
}

export interface WindowState {
  open: boolean;
  /** Hours until the next window opens (0 while open). */
  untilOpen: number;
  /** 0..1 progress through the open window. */
  progress: number;
}

export function windowState(
  windowHours: number,
  hour: number,
  spanHours: number,
): WindowState {
  const dayStart = Math.floor(hour / 24) * 24;
  const into = hour - dayStart;
  if (windowHours > 0 && into < windowHours)
    return { open: true, untilOpen: 0, progress: into / windowHours };
  const next = dayStart + 24;
  return {
    open: false,
    untilOpen: next >= spanHours ? Infinity : next - hour,
    progress: 0,
  };
}

// ── Per-cell state at an hour ──────────────────────────────────────────

export interface CellFrame {
  hazardActive: boolean;
  /** At least one clear look happened at or before this hour. */
  seen: boolean;
  /** Age in hours of the most recent look (clear or blocked), null if none yet. */
  lastLookAge: number | null;
  lastLookBlocked: boolean;
  /** Flagged as hazard by this hour (true detection or false alarm). */
  flagged: boolean;
  falseAlarm: boolean;
}

/** True when the result carries per-pass timing (engine 1.2.0+). */
export function hasPassTiming(result: SimResult) {
  return result.cells.some((c) => c.lookHours !== undefined);
}

export function cellFrame(
  grid: MissionGridCell,
  cell: SimCellResult,
  hour: number,
  spanHours: number,
): CellFrame {
  const hazardActive = isHazard(grid) && hour >= grid.eventDay * 24;
  if (cell.lookHours === undefined) {
    // Saved attempts from older engines have no per-pass timing: show the final state at the end only.
    const end = hour >= spanHours;
    return {
      hazardActive,
      seen: end && cell.observed,
      lastLookAge: null,
      lastLookBlocked: false,
      flagged: end && cell.detected,
      falseAlarm: end && cell.detected && !isTrueDetection(cell),
    };
  }
  const blocked = new Set(cell.blockedHours ?? []);
  let seen = false;
  let last: number | null = null;
  for (const h of cell.lookHours) {
    if (h > hour) break;
    last = h;
    if (!blocked.has(h)) seen = true;
  }
  const flagged =
    cell.detected && cell.detectedHour != null && cell.detectedHour <= hour;
  return {
    hazardActive,
    seen,
    lastLookAge: last === null ? null : hour - last,
    lastLookBlocked: last !== null && blocked.has(last),
    flagged,
    falseAlarm: flagged && !isTrueDetection(cell),
  };
}

// ── Deliveries ────────────────────────────────────────────────────────

/** Engine downlink latency; falls back to the engine's base formula for older results. */
export function downlinkLatency(result: SimResult, resources: ResourceSummary) {
  if (result.diagnostics) return result.diagnostics.downlinkLatencyHours;
  return Math.max(
    0.25,
    (resources.dataGBPerDay / Math.max(0.1, resources.downlinkGBPerDay)) * 24,
  );
}

export interface Delivery {
  cellId: string;
  detectedHour: number;
  deliveredHour: number;
}

/** One data package per true detection: delivered at detectedHour + latency (engine rule). */
export function deliveries(result: SimResult, latency: number): Delivery[] {
  return result.cells
    .filter((c) => isTrueDetection(c) && c.detectedHour != null)
    .map((c) => ({
      cellId: c.id,
      detectedHour: c.detectedHour!,
      deliveredHour: Math.round((c.detectedHour! + latency) * 10) / 10,
    }))
    .sort(
      (a, b) =>
        a.deliveredHour - b.deliveredHour || a.cellId.localeCompare(b.cellId),
    );
}

export function deliveryStatus(list: Delivery[], hour: number) {
  let onboard = 0;
  let delivered = 0;
  for (const d of list) {
    if (d.deliveredHour <= hour) delivered += 1;
    else if (d.detectedHour <= hour) onboard += 1;
  }
  return { onboard, delivered };
}

// ── Storage gauge (simplified) ─────────────────────────────────────────

export interface StorageSeries {
  stepHours: number;
  capacityGB: number;
  /** GB on board at each step. */
  values: number[];
  /** First hour the illustrative storage estimate reaches capacity, if ever. */
  fullAtHour: number | null;
}

/**
 * Simplified onboard-data model using only real rates: sensors add the day's
 * data (dataGBPerDay) during the observation window; the radio drains it at the
 * effective downlink rate implied by the engine latency (data ÷ latency × 24 h).
 * Storage caps at capacity. This illustration does not establish engine data loss.
 */
export function storageSeries(
  resources: ResourceSummary,
  latencyHours: number,
  windowHours: number,
  spanHours: number,
  stepHours = 0.25,
): StorageSeries {
  const capacity = Math.max(0, resources.storageGB);
  const inRate = windowHours > 0 ? resources.dataGBPerDay / windowHours : 0; // GB per hour while observing
  const outRate = latencyHours > 0 ? resources.dataGBPerDay / latencyHours : 0; // GB per hour
  const values: number[] = [0];
  let stored = 0;
  let fullAtHour: number | null = null;
  const steps = Math.ceil(spanHours / stepHours);
  for (let i = 1; i <= steps; i += 1) {
    const h = (i - 0.5) * stepHours;
    const observing = h % 24 < windowHours;
    stored += ((observing ? inRate : 0) - outRate) * stepHours;
    if (stored >= capacity) {
      stored = capacity;
      if (fullAtHour === null && capacity > 0)
        fullAtHour = Math.round(i * stepHours * 10) / 10;
    }
    if (stored < 0) stored = 0;
    values.push(stored);
  }
  return { stepHours, capacityGB: capacity, values, fullAtHour };
}

export function storageAt(series: StorageSeries, hour: number) {
  const i = Math.min(
    series.values.length - 1,
    Math.max(0, Math.round(hour / series.stepHours)),
  );
  return series.values[i];
}

// ── Notable moments (for "next event" stepping and the live log) ───────

export type MomentKind =
  | "onset"
  | "window"
  | "detect"
  | "delivery"
  | "deadline"
  | "blocked"
  | "storage-full";

export interface Moment {
  hour: number;
  kind: MomentKind;
  count: number;
}

/** Collapses the mission into a short list of notable hours, in order. */
export function missionMoments(
  mission: Mission,
  result: SimResult,
  list: Delivery[],
  windowHours: number,
  storage: StorageSeries,
): Moment[] {
  const spanHours = mission.durationDays * 24;
  const bucket = new Map<string, Moment>();
  const add = (hour: number, kind: MomentKind) => {
    const h = Math.round(hour * 10) / 10;
    const key =
      kind +
      ":" +
      (kind === "blocked" || kind === "detect" ? Math.floor(h) : h);
    const m = bucket.get(key);
    if (m) m.count += 1;
    else bucket.set(key, { hour: h, kind, count: 1 });
  };
  for (const c of mission.grid)
    if (isHazard(c) && c.eventDay > 0 && c.eventDay < mission.durationDays)
      add(c.eventDay * 24, "onset");
  if (windowHours > 0)
    for (let d = 0; d < mission.durationDays; d += 1) add(d * 24, "window");
  for (const c of result.cells) {
    if (isTrueDetection(c) && c.detectedHour != null)
      add(c.detectedHour, "detect");
    if (isHazard(c)) for (const b of c.blockedHours ?? []) add(b, "blocked");
  }
  if (list.length) add(list[0].deliveredHour, "delivery");
  if (mission.targetResponseHours < spanHours)
    add(mission.targetResponseHours, "deadline");
  if (storage.fullAtHour !== null) add(storage.fullAtHour, "storage-full");
  return [...bucket.values()]
    .filter((m) => m.hour <= spanHours)
    .sort((a, b) => a.hour - b.hour);
}

export function nextMomentHour(moments: Moment[], hour: number) {
  return moments.find((m) => m.hour > hour + 0.05)?.hour ?? null;
}
