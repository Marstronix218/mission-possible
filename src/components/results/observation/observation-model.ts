// Pure view model for the Simulated Observation screen. Everything the map
// shows about YOUR satellite is read from the engine result (cells[].lookHours,
// blockedHours, detectedHour, missReason, score, diagnostics) and the design's
// catalog parts. Everything shown as REAL comes from files in public/nasa/ with
// their provenance JSON. Illustrative parts (swath band position, pixelation
// level) are deterministic functions of catalog factors and are labelled as such.
import type {
  InstrumentKind,
  InstrumentPart,
  Mission,
  SatelliteDesign,
  SimCellResult,
  SimResult,
} from "@/types/game";
import { partsCatalog } from "@/lib/sim";
import { cellFrame, gridSize, isTrueDetection } from "../mission-playback";

export type Bbox = [number, number, number, number];

// ── Real reference layers (public/nasa) ────────────────────────────────

/** Missions with a processed Landsat land surface temperature layer. */
export const LST_REFERENCE_SLUGS: readonly string[] = ["san-francisco"];

export interface ContextReference {
  src: string;
  bbox: Bbox;
  source: string;
  observedOn: string | null;
  url: string | null;
  usage: string | null;
}

export interface LstCellReference {
  meanC: number | null;
  landShare: number;
  cloudShare: number;
}

export interface LstReference {
  src: string;
  trueColourSrc: string;
  bbox: Bbox;
  source: string;
  productId: string;
  sceneId: string | null;
  platform: string | null;
  acquired: string;
  observedOn: string;
  url: string;
  landingPage: string | null;
  usage: string | null;
  scale: { minC: number; maxC: number; stops: [number, string][] };
  valueRangeC: { min: number; median: number; max: number } | null;
  cells: Record<string, LstCellReference>;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" && v ? v : null);
const num = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

function parseBbox(v: unknown): Bbox | null {
  if (!Array.isArray(v) || v.length !== 4) return null;
  const b = v.map(num);
  if (b.some((x) => x === null)) return null;
  const [w, s, e, n] = b as number[];
  return e > w && n > s ? [w, s, e, n] : null;
}

/** public/nasa/<slug>.json — the true-colour context image every mission has. */
export function parseContextReference(
  slug: string,
  json: unknown,
  fallbackBbox: Bbox,
): ContextReference {
  const d = isRecord(json) ? json : {};
  return {
    src: `/nasa/${slug}.jpg`,
    bbox: parseBbox(d.bbox) ?? fallbackBbox,
    source: str(d.source) ?? "NASA imagery",
    observedOn: str(d.observedOn),
    url: str(d.url),
    usage: str(d.usage),
  };
}

/** public/nasa/<slug>-lst.json — returns null unless every field we display is present. */
export function parseLstReference(json: unknown): LstReference | null {
  if (!isRecord(json)) return null;
  const files = isRecord(json.files) ? json.files : {};
  const scale = isRecord(json.colourScale) ? json.colourScale : null;
  const grid = isRecord(json.grid) ? json.grid : null;
  const bbox = parseBbox(json.bbox);
  const src = str(files.lst);
  const trueColourSrc = str(files.trueColour);
  const acquired = str(json.acquired);
  const productId = str(json.productId);
  const url = str(json.url);
  const source = str(json.source);
  if (
    !bbox ||
    !src ||
    !trueColourSrc ||
    !acquired ||
    !productId ||
    !url ||
    !source ||
    !scale ||
    !grid
  )
    return null;
  const minC = num(scale.minC);
  const maxC = num(scale.maxC);
  const stops = Array.isArray(scale.stops)
    ? scale.stops.flatMap((s): [number, string][] =>
        Array.isArray(s) && num(s[0]) !== null && str(s[1])
          ? [[s[0] as number, s[1] as string]]
          : [],
      )
    : [];
  if (minC === null || maxC === null || stops.length < 2) return null;
  const cells: Record<string, LstCellReference> = {};
  if (isRecord(grid.cells))
    for (const [id, c] of Object.entries(grid.cells)) {
      if (!isRecord(c)) continue;
      cells[id] = {
        meanC: num(c.meanC),
        landShare: num(c.landShare) ?? 0,
        cloudShare: num(c.cloudShare) ?? 0,
      };
    }
  const range = isRecord(json.valueRangeC) ? json.valueRangeC : null;
  const min = num(range?.min);
  const median = num(range?.median);
  const max = num(range?.max);
  return {
    src,
    trueColourSrc,
    bbox,
    source,
    productId,
    sceneId: str(json.sceneId),
    platform: str(json.platform),
    acquired,
    observedOn: str(json.observedOn) ?? acquired.slice(0, 10),
    url,
    landingPage: str(json.landingPage),
    usage: str(json.usage),
    scale: { minC, maxC, stops },
    valueRangeC:
      min !== null && median !== null && max !== null
        ? { min, median, max }
        : null,
    cells,
  };
}

/**
 * Where an image covering `image` bbox must be sampled so it lines up with the
 * mission bbox (both EPSG:4326, linear in degrees). Returns the source rect in
 * image pixels and the destination rect as 0..1 fractions of the mission view.
 */
export function alignImage(
  mission: Bbox,
  image: Bbox,
  imageWidth: number,
  imageHeight: number,
) {
  const [mw, ms, me, mn] = mission;
  const [iw, is, ie, inn] = image;
  const w = Math.max(mw, iw);
  const e = Math.min(me, ie);
  const s = Math.max(ms, is);
  const n = Math.min(mn, inn);
  if (e <= w || n <= s) return null;
  const xImg = (lon: number) => ((lon - iw) / (ie - iw)) * imageWidth;
  const yImg = (lat: number) => ((inn - lat) / (inn - is)) * imageHeight;
  const xView = (lon: number) => (lon - mw) / (me - mw);
  const yView = (lat: number) => (mn - lat) / (mn - ms);
  return {
    sx: xImg(w),
    sy: yImg(n),
    sw: xImg(e) - xImg(w),
    sh: yImg(s) - yImg(n),
    dx: xView(w),
    dy: yView(n),
    dw: xView(e) - xView(w),
    dh: yView(s) - yView(n),
  };
}

/** CSS linear-gradient for an LST colour scale (left = coolest). */
export function scaleGradient(scale: LstReference["scale"]) {
  const span = scale.maxC - scale.minC || 1;
  return `linear-gradient(90deg, ${scale.stops
    .map(
      ([c, colour]) =>
        `${colour} ${Math.round(((c - scale.minC) / span) * 100)}%`,
    )
    .join(", ")})`;
}

// ── Sensor model: what the player's design can "see" ───────────────────

export type SensorLayer = "lst" | "true-colour" | "greyscale";

export interface SensorProfile {
  instrument: InstrumentPart | null;
  kind: InstrumentKind | null;
  layer: SensorLayer;
  /** Simulated pixels across one mission grid cell (1 = one blurry block per cell). */
  pixelsPerCell: number;
  /** Product of catalog resolutionScore × orbit resolutionFactor that set pixelsPerCell. */
  detailFactor: number;
  seesThroughCloud: boolean;
  /** One plain sentence on what this sensor measures. */
  measures: string;
  /** Present when the simulated picture has to fall back to a different reference layer. */
  note: string | null;
}

const MEASURES: Record<InstrumentKind, string> = {
  thermal:
    "measures heat given off by the ground (land surface temperature, not air temperature)",
  optical: "takes pictures in visible light; clouds and smoke block it",
  multispectral:
    "takes pictures in several colours of light; clouds and smoke block it",
  radar:
    "bounces radio waves off the ground and sees through clouds, but does not measure temperature",
  microwave:
    "measures broad microwave signals through clouds at a very coarse scale",
  lidar: "measures ground height with a laser along a narrow track",
  gravimetry: "senses changes in mass over very large areas",
};

/**
 * The instrument that drives the picture is the engine's best instrument
 * (diagnostics.bestInstrumentId) — the same one used for detection odds.
 * Pixels per cell: 1 + 6 × resolutionScore × orbit resolutionFactor, rounded
 * and clamped to 1–8. Illustrative, not metres.
 */
export function sensorProfile(
  design: SatelliteDesign,
  result: SimResult,
  hasLst: boolean,
): SensorProfile {
  const id = result.diagnostics?.bestInstrumentId ?? design.instruments[0];
  const instrument =
    partsCatalog.instruments.find((p) => p.id === id) ??
    partsCatalog.instruments.find((p) => p.id === design.instruments[0]) ??
    null;
  const orbit = partsCatalog.orbits.find((o) => o.id === design.orbit);
  const detailFactor =
    Math.round(
      (instrument?.resolutionScore ?? 0) * (orbit?.resolutionFactor ?? 1) * 1000,
    ) / 1000;
  const pixelsPerCell = Math.min(
    8,
    Math.max(1, Math.round(1 + 6 * detailFactor)),
  );
  const kind = instrument?.kind ?? null;
  let layer: SensorLayer = "true-colour";
  let note: string | null = null;
  if (kind === "thermal") {
    if (hasLst) layer = "lst";
    else
      note =
        "No processed thermal reference is available for this mission, so the simulated picture uses the true-colour reference image.";
  } else if (kind && kind !== "optical" && kind !== "multispectral") {
    layer = "greyscale";
    note =
      "We have no real radar or microwave image of this place, so your sensor's picture is shown as a greyscale version of the reference image.";
  }
  return {
    instrument,
    kind,
    layer,
    pixelsPerCell,
    detailFactor,
    seesThroughCloud:
      result.diagnostics?.cloudPenetrating ??
      instrument?.cloudPenetrating ??
      false,
    measures: kind ? MEASURES[kind] : "has no instrument",
    note,
  };
}

// ── Per-cell observation state at a mission hour ───────────────────────

export type ObsState =
  /** No pass has looked at this cell yet (or ever, at the end). */
  | "unseen"
  /** Every look so far was blocked by cloud or smoke. */
  | "blocked"
  /** A clear look happened; the data is still on board (look + radio delay > hour). */
  | "onboard"
  /** A clear look happened and the radio delay has passed: data is on the ground. */
  | "downlinked"
  /** Older saved result without pass timing: observed, timing unknown. */
  | "observed";

export type HazardMark =
  | "none"
  /** Mission hazard zone that has started but is not (yet) found. */
  | "zone"
  | "found"
  | "false-alarm"
  /** End of mission only: hazard zone never confirmed (see missReason). */
  | "missed";

export interface CellView {
  id: string;
  row: number;
  column: number;
  lat: number;
  lon: number;
  state: ObsState;
  mark: HazardMark;
  missReason: SimCellResult["missReason"] | null;
  firstClearHour: number | null;
  downlinkHour: number | null;
  /** Look within the last `recentHours` (for the scanning flash). */
  recentLook: "clear" | "blocked" | null;
  isHazard: boolean;
  /** Flagged as a hazard when there was none (shown even on a missed zone). */
  falseAlarm: boolean;
}

export function firstClearLook(cell: SimCellResult): number | null {
  if (!cell.lookHours) return null;
  const blocked = new Set(cell.blockedHours ?? []);
  for (const h of cell.lookHours) if (!blocked.has(h)) return h;
  return null;
}

/**
 * Data for an observed cell reaches the ground `latency` hours after its first
 * clear look — the same rule the engine uses for detections
 * (delivery = detection hour + downlinkLatencyHours).
 */
export function cellViews(
  mission: Mission,
  result: SimResult,
  hour: number,
  latency: number,
  recentHours = 2.5,
): CellView[] {
  const span = mission.durationDays * 24;
  const byId = new Map(result.cells.map((c) => [c.id, c]));
  const out: CellView[] = [];
  for (const g of mission.grid) {
    const cell = byId.get(g.id);
    if (!cell) continue;
    const frame = cellFrame(g, cell, hour, span);
    const timed = cell.lookHours !== undefined;
    const first = firstClearLook(cell);
    const downlinkHour =
      first === null ? null : Math.round((first + latency) * 10) / 10;
    let state: ObsState;
    if (!timed) state = hour >= span && cell.observed ? "observed" : "unseen";
    else if (first !== null && first <= hour)
      state = downlinkHour! <= hour ? "downlinked" : "onboard";
    else if ((cell.lookHours ?? []).some((h) => h <= hour)) state = "blocked";
    else state = "unseen";
    const hazard = g.truth > 0.5;
    const final = hour >= span;
    // A pre-event false alarm on an eventual hazard cell still leaves it missed
    // at the end; `falseAlarm` keeps that flag visible as a second marker.
    let mark: HazardMark = "none";
    if (final && hazard && !isTrueDetection(cell)) mark = "missed";
    else if (frame.flagged) mark = frame.falseAlarm ? "false-alarm" : "found";
    else if (frame.hazardActive) mark = "zone";
    out.push({
      id: g.id,
      row: g.row,
      column: g.column,
      lat: g.lat,
      lon: g.lon,
      state,
      mark,
      missReason: hazard && !isTrueDetection(cell) ? (cell.missReason ?? null) : null,
      firstClearHour: first,
      downlinkHour,
      recentLook:
        frame.lastLookAge !== null && frame.lastLookAge < recentHours
          ? frame.lastLookBlocked
            ? "blocked"
            : "clear"
          : null,
      isHazard: hazard,
      falseAlarm: frame.flagged && frame.falseAlarm,
    });
  }
  return out;
}

// ── Mission summary (numbers shared with the score) ────────────────────

export interface ObservationSummary {
  totalCells: number;
  /** Cells with a clear look — the engine's observedCells. */
  observedCells: number;
  /** Engine score: 100 × observedCells / totalCells. */
  coveragePct: number;
  downlinkedCells: number;
  /** Share of all cells whose data reached the ground before the mission ended. */
  downlinkedPct: number;
  /** Observed, but first clear look + radio delay is after the mission end. */
  notDownlinkedCells: number;
  blockedOnlyCells: number;
  neverLookedCells: number;
  hazardCells: number;
  hazardFound: number;
  falseAlarms: number;
  missed: Record<NonNullable<SimCellResult["missReason"]>, number>;
  latencyHours: number;
  firstDeliveryHours: number | null;
  deadlineHours: number;
  deadlineMet: boolean | null;
  /** Engine 0–1 factor: (downlink + storage share) ÷ data collected per day. */
  dataMargin: number | null;
  storageMargin: number | null;
  timed: boolean;
}

export function observationSummary(
  mission: Mission,
  result: SimResult,
  latency: number,
): ObservationSummary {
  const span = mission.durationDays * 24;
  const views = cellViews(mission, result, span, latency);
  const count = (s: ObsState) => views.filter((v) => v.state === s).length;
  const missed = {
    "never-in-view": 0,
    "cloud-blocked": 0,
    "not-recognised": 0,
    "before-event": 0,
  };
  let hazardFound = 0;
  let falseAlarms = 0;
  let hazardCells = 0;
  for (const c of result.cells) {
    if (c.truth > 0.5) hazardCells += 1;
    if (isTrueDetection(c)) hazardFound += 1;
    else if (c.detected) falseAlarms += 1;
    if (c.truth > 0.5 && !isTrueDetection(c))
      missed[c.missReason ?? (c.observed ? "not-recognised" : "never-in-view")] += 1;
  }
  const total = result.cells.length;
  const observed = result.cells.filter((c) => c.observed).length;
  const downlinked = count("downlinked");
  const deadline = mission.targetResponseHours;
  return {
    totalCells: total,
    observedCells: observed,
    coveragePct: result.score.coverage,
    downlinkedCells: downlinked,
    downlinkedPct: total ? Math.round((1000 * downlinked) / total) / 10 : 0,
    notDownlinkedCells: count("onboard"),
    blockedOnlyCells: count("blocked"),
    neverLookedCells: count("unseen"),
    hazardCells,
    hazardFound,
    falseAlarms,
    missed,
    latencyHours: latency,
    firstDeliveryHours: result.firstDeliveryHours,
    deadlineHours: deadline,
    deadlineMet:
      result.firstDeliveryHours === null
        ? null
        : result.firstDeliveryHours <= deadline,
    dataMargin: result.diagnostics?.dataMargin ?? null,
    storageMargin: result.diagnostics?.storageMargin ?? null,
    timed: result.cells.some((c) => c.lookHours !== undefined),
  };
}

// ── Captions and the four-step story ───────────────────────────────────

export type Phase = "approach" | "scanning" | "downlink" | "complete";

export const PHASES: { id: Phase; label: string }[] = [
  { id: "approach", label: "Approach" },
  { id: "scanning", label: "Scan" },
  { id: "downlink", label: "Send to Earth" },
  { id: "complete", label: "Complete" },
];

export function phaseAt(args: {
  hour: number;
  span: number;
  windowOpen: boolean;
  onboardCells: number;
}): Phase {
  if (args.hour >= args.span) return "complete";
  if (args.windowOpen) return "scanning";
  if (args.onboardCells > 0) return "downlink";
  return "approach";
}

const SCAN_CAPTION: Record<InstrumentKind, string> = {
  thermal: "Your thermal sensor is measuring surface temperature.",
  optical: "Your camera is photographing the ground. Clouds can block it.",
  multispectral:
    "Your multispectral imager is photographing the ground. Clouds can block it.",
  radar: "Your radar is mapping the ground through the clouds.",
  microwave: "Your microwave radiometer is measuring broad patterns.",
  lidar: "Your laser altimeter is measuring ground height.",
  gravimetry: "Your gravity package is sensing mass changes.",
};

export function captionFor(
  phase: Phase,
  city: string,
  kind: InstrumentKind | null,
  coveragePct: number,
) {
  switch (phase) {
    case "approach":
      return `Your satellite is approaching ${city}.`;
    case "scanning":
      return kind ? SCAN_CAPTION[kind] : "Your satellite is over the target.";
    case "downlink":
      return "Your satellite is sending data back to Earth.";
    case "complete":
      return `Observation complete! You captured ${Math.round(coveragePct)}% of the target area.`;
  }
}

/**
 * Illustrative footprint position while the daily observation window is open:
 * a band sweeping north → south across the target. Height grows with the
 * orbit's swath factor. Which cells are actually looked at comes from the
 * engine's lookHours, not from this band.
 */
export function footprintBand(
  design: SatelliteDesign,
  hour: number,
  windowHours: number,
) {
  const orbit = partsCatalog.orbits.find((o) => o.id === design.orbit);
  if (!orbit || windowHours <= 0) return null;
  const into = hour % 24;
  if (into >= windowHours) return null;
  const height = Math.min(1, Math.max(0.1, 0.16 * orbit.swathFactor));
  const progress = into / windowHours;
  return {
    top: -height + progress * (1 + height),
    height,
    progress,
  };
}

// ── Cell detail popover ────────────────────────────────────────────────

const MISS_TEXT: Record<NonNullable<SimCellResult["missReason"]>, string> = {
  "never-in-view": "No pass looked at this zone.",
  "cloud-blocked": "Every look was blocked by cloud or smoke.",
  "not-recognised": "Your sensor looked clearly but did not recognise it.",
  "before-event": "It was only checked before the hazard started.",
};

export const STATE_TEXT: Record<ObsState, string> = {
  unseen: "Not observed",
  blocked: "Looked at, but cloud or smoke blocked every look",
  onboard: "Observed — data still on the satellite",
  downlinked: "Observed and sent to Earth",
  observed: "Observed (this saved attempt has no pass timing)",
};

const h1 = (n: number) => `h ${Math.round(n * 10) / 10}`;

export function cellDetail(
  view: CellView,
  cell: SimCellResult | undefined,
  mission: Mission,
  hour: number,
  lst: LstReference | null,
) {
  const span = mission.durationDays * 24;
  const grid = mission.grid.find((g) => g.id === view.id);
  const lines: { label: string; value: string }[] = [];
  const lat = view.lat.toFixed(3);
  const lon = Math.abs(view.lon).toFixed(3);
  lines.push({
    label: "Location",
    value: `${lat}° N, ${lon}° ${view.lon < 0 ? "W" : "E"} (row ${view.row + 1}, column ${view.column + 1})`,
  });
  let state = STATE_TEXT[view.state];
  if (view.state === "onboard" && hour >= span)
    state = "Observed, but the data did not reach Earth before the mission ended";
  lines.push({ label: "Your satellite", value: state });
  const blocked = new Set(cell?.blockedHours ?? []);
  const looks = (cell?.lookHours ?? []).filter((h) => h <= hour);
  if (cell?.lookHours !== undefined)
    lines.push({
      label: "Looks",
      value: looks.length
        ? looks
            .map((h) => (blocked.has(h) ? `${h1(h)} (blocked)` : h1(h)))
            .join(", ")
        : "none yet",
    });
  if (view.downlinkHour !== null && view.firstClearHour !== null && view.firstClearHour <= hour)
    lines.push({
      label: "Data on the ground",
      value:
        view.downlinkHour <= span
          ? `${h1(view.downlinkHour)} (look + radio delay)`
          : `would arrive at ${h1(view.downlinkHour)}, after the mission ended`,
    });
  if (view.mark === "found" && cell?.detectedHour != null)
    lines.push({ label: "Hazard", value: `Confirmed at ${h1(cell.detectedHour)}` });
  else if (view.mark === "false-alarm" && cell?.detectedHour != null)
    lines.push({
      label: "Hazard",
      value: `False alarm at ${h1(cell.detectedHour)} — flagged, but no hazard here at that time`,
    });
  else if (view.mark === "missed")
    lines.push({
      label: "Hazard",
      value: `Missed. ${view.missReason ? MISS_TEXT[view.missReason] : "Not confirmed."}`,
    });
  else if (view.mark === "zone")
    lines.push({ label: "Hazard", value: "Hazard zone (mission data), not found yet" });
  if (grid)
    lines.push({
      label: "Cloud / smoke chance",
      value: `${Math.round(grid.cloudProbability * 100)}% per look (mission data)`,
    });
  const ref = lst?.cells[view.id];
  if (lst)
    lines.push({
      label: "Real reference",
      value:
        ref?.meanC != null
          ? `${ref.meanC.toFixed(1)} °C mean land surface temperature (Landsat, ${lst.observedOn})`
          : ref && ref.cloudShare > 0.5
            ? `Cloud-covered in the Landsat scene (${lst.observedOn})`
            : "No land pixels (water) in the Landsat layer",
    });
  return lines;
}

// ── Comparison slider and zoom helpers ─────────────────────────────────

export function sliderKey(value: number, key: string, step = 5) {
  switch (key) {
    case "ArrowLeft":
    case "ArrowDown":
      return Math.max(0, value - step);
    case "ArrowRight":
    case "ArrowUp":
      return Math.min(100, value + step);
    case "PageDown":
      return Math.max(0, value - step * 4);
    case "PageUp":
      return Math.min(100, value + step * 4);
    case "Home":
      return 0;
    case "End":
      return 100;
    default:
      return null;
  }
}

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 6;

export interface ViewTransform {
  scale: number;
  /** Translation in 0..1 fractions of the viewport (applied before scale). */
  x: number;
  y: number;
}

/** Keeps the zoomed content covering the viewport. */
export function clampTransform(t: ViewTransform): ViewTransform {
  const scale = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, t.scale));
  const min = 1 - scale; // content spans [x, x + scale]
  return {
    scale,
    x: Math.min(0, Math.max(min, t.x)),
    y: Math.min(0, Math.max(min, t.y)),
  };
}

/** Zoom about a focal point (fx, fy in 0..1 of the viewport). */
export function zoomAt(
  t: ViewTransform,
  factor: number,
  fx = 0.5,
  fy = 0.5,
): ViewTransform {
  const scale = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, t.scale * factor));
  const k = scale / t.scale;
  return clampTransform({
    scale,
    x: fx - (fx - t.x) * k,
    y: fy - (fy - t.y) * k,
  });
}

/** Grid cell under a viewport point (0..1), north up; null outside. */
export function cellAtPoint(
  mission: Mission,
  t: ViewTransform,
  px: number,
  py: number,
) {
  const { rows, columns } = gridSize(mission);
  const u = (px - t.x) / t.scale;
  const v = (py - t.y) / t.scale;
  if (u < 0 || u >= 1 || v < 0 || v >= 1) return null;
  const column = Math.floor(u * columns);
  const row = rows - 1 - Math.floor(v * rows);
  return mission.grid.find((g) => g.row === row && g.column === column) ?? null;
}

/**
 * Width ÷ height of the mission bbox on the ground (degrees of longitude
 * shrink with cos(latitude)), so the map is not stretched east–west.
 */
export function viewAspect(bbox: Bbox) {
  const [w, s, e, n] = bbox;
  const mid = ((s + n) / 2) * (Math.PI / 180);
  return ((e - w) * Math.cos(mid)) / (n - s);
}
