export type Category =
  | "wildfire"
  | "heat"
  | "flood"
  | "snow"
  | "drought"
  | "storm"
  | "glacier"
  | "volcano";

export type InstrumentKind =
  | "optical"
  | "multispectral"
  | "thermal"
  | "microwave"
  | "radar"
  | "lidar"
  | "gravimetry";

export interface Constraints {
  budgetM: number;
  massKg: number;
}

export interface DataSource {
  name: string;
  url: string;
  accessedOn: string;
  usage: string;
  provenance: "nasa-observed" | "educational-model";
}

export interface MissionGridCell {
  id: string;
  row: number;
  column: number;
  lat: number;
  lon: number;
  truth: number;
  cloudProbability: number;
  detectability: number;
  eventDay: number;
}

export interface Mission {
  slug: string;
  city: string;
  category: Category;
  objective: { en: string };
  bbox: [number, number, number, number];
  defaultConstraints: Constraints;
  durationDays: number;
  seed: number;
  targetResponseHours: number;
  grid: MissionGridCell[];
  sources: DataSource[];
}

/**
 * Mission-operations decisions the player makes after launch. Every field is
 * optional; an omitted field means the default behaviour, so designs without
 * decisions simulate exactly as before. Semantics are implemented in
 * src/lib/sim/engine.ts and must stay deterministic.
 */
export interface MissionDecisions {
  /** Sensor pointing: spread looks evenly ("wide") or concentrate on the suspected hazard area ("hazard"). */
  focus?: "wide" | "hazard";
  /**
   * Downlink strategy. Omitted = standard scheduled contacts. "fast" transmits on
   * every contact (lower latency, more transmitter power); "save-power" batches
   * data for fewer contacts (higher latency, more power and battery reserve).
   */
  downlink?: "fast" | "save-power";
  /**
   * Mid-mission retask: from mission `day` (0-based) onward, prioritise one quadrant
   * of the grid at the expense of the rest. Row 0 is the grid's southern edge.
   */
  retask?: { day: number; quadrant: "nw" | "ne" | "sw" | "se" };
}

export interface SatelliteDesign {
  instruments: string[];
  orbit: string;
  solar: string;
  battery: string;
  comm: string;
  groundStations: 1 | 3 | 5;
  storage: string;
  decisions?: MissionDecisions;
}

export interface ResourceSummary {
  costM: number;
  massKg: number;
  powerGenW: number;
  powerUseW: number;
  dataGBPerDay: number;
  downlinkGBPerDay: number;
  storageGB: number;
  coverageEstimate: number;
  violations: string[];
  warnings: string[];
}

export interface ScoreBreakdown {
  accuracy: number;
  responseTime: number;
  coverage: number;
  costEfficiency: number;
  reliability: number;
  total: number;
}

export interface SimCellResult {
  id: string;
  truth: number;
  observed: boolean;
  detected: boolean;
  /** Mission hours (0.1 h) at which a pass looked at this cell, clear or blocked, in order. */
  lookHours?: number[];
  /** Subset of lookHours where cloud/smoke blocked the view. */
  blockedHours?: number[];
  /**
   * Mission hour (0.1 h) at which the engine flagged this cell (`detected` true),
   * whether a true hazard detection or a false alarm; null otherwise.
   */
  detectedHour?: number | null;
  /**
   * Hazard cells (truth > 0.5) only: why the cell is not a true detection, taken
   * from the branch that ended the engine's loop. "never-in-view": no pass looked;
   * "cloud-blocked": every pass was blocked; "not-recognised": a clear look after
   * the event did not recognise it; "before-event": the clear looks came before
   * the hazard started, so the cell was classified as background.
   */
  missReason?: "never-in-view" | "cloud-blocked" | "not-recognised" | "before-event";
}

/** Engine-computed explanation of a result. Every number comes from the run itself. */
export interface SimDiagnostics {
  /** Hazard cells = hazardDetected + hazardNeverInView + hazardCloudBlocked + hazardNotRecognised + hazardBeforeEvent. */
  hazardCells: number;
  hazardDetected: number;
  hazardNeverInView: number;
  hazardCloudBlocked: number;
  hazardNotRecognised: number;
  hazardBeforeEvent: number;
  /** Cells flagged as hazard that were not (yet) hazard cells. */
  falseAlarms: number;
  /** Cells with at least clear looks, and all cells (coverage = observed / total). */
  observedCells: number;
  totalCells: number;
  /** Mission hour of the first true detection; delivery = this + downlinkLatencyHours. */
  firstDetectionHours: number | null;
  downlinkLatencyHours: number;
  /** Response target; response score hits 0 at twice this. */
  targetResponseHours: number;
  /** 0–1 factors the engine used (rounded to 3 decimals). */
  powerMargin: number;
  dataMargin: number;
  storageMargin: number;
  batteryContinuity: number;
  operationFactor: number;
  coverageChance: number;
  /** 0–1 reliability before ×100 in the score. */
  reliabilityFactor: number;
  bestInstrumentId: string | null;
  bestInstrumentFit: number;
  cloudPenetrating: boolean;
  /** Category weights used for the total score, as in data/categories.json (they sum to 100). */
  weights: Omit<ScoreBreakdown, "total">;
  /** Decisions actually applied (defaults filled in; "standard" downlink = no modifier). */
  decisions: {
    focus: NonNullable<MissionDecisions["focus"]>;
    downlink: NonNullable<MissionDecisions["downlink"]> | "standard";
    retask?: MissionDecisions["retask"];
  };
}

export interface TimelinePoint {
  t: number;
  lat: number;
  lon: number;
  event?: string;
}

export interface FeedbackItem {
  type: "success" | "warning" | "tip";
  key: string;
  message: string;
  params?: Record<string, number>;
}

export interface SimResult {
  score: ScoreBreakdown;
  cells: SimCellResult[];
  timeline: TimelinePoint[];
  feedback: FeedbackItem[];
  success: boolean;
  firstDeliveryHours: number | null;
  engineVersion: string;
  diagnostics?: SimDiagnostics;
}

export interface InstrumentPart {
  id: string;
  name: string;
  kind: InstrumentKind;
  costM: number;
  massKg: number;
  powerW: number;
  dataGBPerDay: number;
  resolutionScore: number;
  cloudPenetrating: boolean;
  categoryFit: Partial<Record<Category, number>>;
}

export interface OrbitPart {
  id: string;
  name: string;
  costM: number;
  massKg: number;
  revisitFactor: number;
  swathFactor: number;
  resolutionFactor: number;
  reliabilityFactor: number;
}

export interface SolarPart {
  id: string;
  name: string;
  costM: number;
  massKg: number;
  generationW: number;
}

export interface BatteryPart {
  id: string;
  name: string;
  costM: number;
  massKg: number;
  eclipseContinuity: number;
}

export interface CommunicationPart {
  id: string;
  name: string;
  costM: number;
  massKg: number;
  powerW: number;
  rateGbps: number;
}

export interface StoragePart {
  id: string;
  name: string;
  costM: number;
  massKg: number;
  capacityGB: number;
}

export interface PartsCatalog {
  bus: { costM: number; massKg: number; powerW: number };
  instruments: InstrumentPart[];
  orbits: OrbitPart[];
  solar: SolarPart[];
  batteries: BatteryPart[];
  communications: CommunicationPart[];
  storage: StoragePart[];
  groundStations: Record<"1" | "3" | "5", { costM: number; accessMinutesPerDay: number }>;
}

export interface CategoryRules {
  weights: Omit<ScoreBreakdown, "total">;
  targetResponseHours: number;
  cloudImpact: number;
}
