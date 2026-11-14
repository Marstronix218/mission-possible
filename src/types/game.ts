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

export interface SatelliteDesign {
  instruments: string[];
  orbit: string;
  solar: string;
  battery: string;
  comm: string;
  groundStations: 1 | 3 | 5;
  storage: string;
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
