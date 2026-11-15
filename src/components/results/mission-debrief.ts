// DISCOVER / IMPROVE logic: short cause lines, wins, the response-team payoff
// and the slots to fix. Pure. A cause line is only produced when the engine
// output that proves it is present (result.diagnostics, cells[].missReason,
// firstDeliveryHours, or — for pre-1.2.0 saved attempts — feedback keys).
import type {
  Mission,
  ResourceSummary,
  SatelliteDesign,
  SimResult,
} from "@/types/game";
import {
  DECISION_EFFECTS,
  explainScore,
  partsCatalog,
  type MetricExplanation,
  type ScoreMetric,
} from "@/lib/sim";
import { getMissionStory } from "@/lib/story/missions";
import { partLabel } from "@/lib/story/events";
import type { PartSlot } from "@/lib/story/parts";
import {
  gridSize,
  isTrueDetection,
  quadrantOf,
  quadrantName,
  type Quadrant,
} from "./mission-playback";

export type DecisionId = "focus" | "downlink" | "retask";

export interface CauseLine {
  id: string;
  tone: "good" | "bad";
  icon: string;
  /** Short punchy line. */
  text: string;
  /** One supporting fact with real numbers. */
  detail?: string;
  slot?: PartSlot;
  decision?: DecisionId;
  metric?: ScoreMetric;
  /** Engine field(s) this line is read from (shown in the "how we know" tooltip). */
  source: string;
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const zones = (n: number) => `${n} danger zone${n === 1 ? "" : "s"}`;

function hazardWords(mission: Mission) {
  const story = getMissionStory(mission.slug);
  return {
    hazard: story?.hazardNoun ?? "hazard",
    team: story?.dependents ?? "Emergency teams",
    obstacle:
      mission.category === "wildfire" || mission.category === "volcano"
        ? "Smoke"
        : "Clouds",
  };
}

/** Radio vs ground stations: which one limits the downlink (same rule as the story layer). */
function downlinkSlot(design: SatelliteDesign): PartSlot {
  const rate =
    partsCatalog.communications.find((c) => c.id === design.comm)?.rateGbps ??
    0;
  return design.groundStations === 1 && rate >= 2 ? "groundStations" : "comm";
}

/** Problems, most damaging first. */
export function causeLines(
  mission: Mission,
  design: SatelliteDesign,
  result: SimResult,
): CauseLine[] {
  const { hazard, obstacle } = hazardWords(mission);
  const d = result.diagnostics;
  const target = d?.targetResponseHours ?? mission.targetResponseHours;
  const delivered = result.firstDeliveryHours;
  const lines: CauseLine[] = [];

  if (!d) {
    // Pre-1.2.0 attempt: only the delivery hour and feedback keys are known.
    if (delivered === null)
      lines.push({
        id: "no-delivery",
        tone: "bad",
        icon: "📭",
        text: "No alert ever reached the ground!",
        metric: "responseTime",
        source: "firstDeliveryHours",
      });
    else if (delivered > target)
      lines.push({
        id: "late",
        tone: "bad",
        icon: "⏰",
        text: `Data arrived ${r1(delivered - target)} h late!`,
        metric: "responseTime",
        source: "firstDeliveryHours",
        slot: downlinkSlot(design),
      });
    const keyed: Record<string, Omit<CauseLine, "id" | "tone" | "source">> = {
      "coverage.orbit": {
        icon: "🛰️",
        text: "Your orbit left too much of the map unseen.",
        slot: "orbit",
        metric: "coverage",
      },
      "accuracy.sensor_fit": {
        icon: "🔭",
        text: `Your sensor struggled to recognise the ${hazard}.`,
        slot: "instruments",
        metric: "accuracy",
      },
      "reliability.margin": {
        icon: "🔋",
        text: "Power and data margins were too thin.",
        slot: "battery",
        metric: "reliability",
      },
    };
    for (const f of result.feedback) {
      const k = keyed[f.key];
      if (k && !lines.some((l) => l.id === f.key))
        lines.push({
          id: f.key,
          tone: "bad",
          source: `feedback:${f.key}`,
          ...k,
        });
    }
    return lines;
  }

  // ── Timeliness ────────────────────────────────────────────────────────
  const save = d.decisions.downlink === "save-power";
  const batchHours = save
    ? DECISION_EFFECTS.savePowerBatchHours / design.groundStations
    : 0;
  if (delivered === null) {
    lines.push({
      id: "no-delivery",
      tone: "bad",
      icon: "📭",
      text: "No alert ever reached the ground!",
      detail: `Your satellite never confirmed the ${hazard}, so there was nothing to send.`,
      metric: "responseTime",
      source: "firstDeliveryHours, diagnostics.firstDetectionHours",
    });
  } else if (delivered > target && d.firstDetectionHours !== null) {
    const late = r1(delivered - target);
    lines.push({
      id:
        save &&
        d.firstDetectionHours + d.downlinkLatencyHours - batchHours <= target
          ? "late-save-power"
          : "late",
      tone: "bad",
      icon: "⏰",
      text: `Data arrived ${late} h after the deadline.`,
      detail: `First detection: hour ${d.firstDetectionHours}. Downlink added ${d.downlinkLatencyHours} h.${save ? ` Save-power batching contributed ${r1(batchHours)} h.` : ""} Try changing the radio or ground stations and compare.`,
      slot: downlinkSlot(design),
      metric: "responseTime",
      source:
        "diagnostics.firstDetectionHours, diagnostics.downlinkLatencyHours, firstDeliveryHours",
    });
  }

  // ── Missed danger zones (largest first) ───────────────────────────────
  const misses: CauseLine[] = [];
  if (d.hazardCloudBlocked > 0)
    misses.push({
      id: "cloud-blocked",
      tone: "bad",
      icon: "☁️",
      text: d.cloudPenetrating
        ? `${obstacle} still hid ${zones(d.hazardCloudBlocked)}!`
        : `${obstacle} blocked your sensor on ${zones(d.hazardCloudBlocked)}!`,
      detail: d.cloudPenetrating
        ? "Every look at them happened to be blocked. More passes give more chances."
        : `Your ${partLabel("instruments", design)} can't see through ${obstacle.toLowerCase()}.`,
      slot: d.cloudPenetrating ? "orbit" : "instruments",
      metric: "accuracy",
      source: "diagnostics.hazardCloudBlocked, cells[].missReason",
    });
  if (d.hazardNeverInView > 0)
    misses.push({
      id: "never-in-view",
      tone: "bad",
      icon: "🛰️",
      text: `${zones(d.hazardNeverInView)} never came into view!`,
      detail: `No pass ever looked at them in ${mission.durationDays} days.`,
      slot: "orbit",
      metric: "accuracy",
      source: "diagnostics.hazardNeverInView, cells[].missReason",
    });
  if (d.hazardNotRecognised > 0)
    misses.push({
      id: "not-recognised",
      tone: "bad",
      icon: "🔭",
      text: `Your sensor looked right at ${zones(d.hazardNotRecognised)} — and didn't recognise ${d.hazardNotRecognised === 1 ? "it" : "them"}!`,
      detail: `Sensor match for ${hazard}: ${Math.round(d.bestInstrumentFit * 100)}%.`,
      slot: "instruments",
      metric: "accuracy",
      source: "diagnostics.hazardNotRecognised, diagnostics.bestInstrumentFit",
    });
  if (d.hazardBeforeEvent > 0)
    misses.push({
      id: "before-event",
      tone: "bad",
      icon: "⏱️",
      text: `${zones(d.hazardBeforeEvent)} checked before the ${hazard} started there.`,
      detail: "No later look confirmed the hazard after it began.",
      decision: "retask",
      metric: "accuracy",
      source: "diagnostics.hazardBeforeEvent, cells[].missReason",
    });
  misses.sort((a, b) => countOf(b, d) - countOf(a, d));
  lines.push(...misses);

  if (d.falseAlarms > 0)
    lines.push({
      id: "false-alarms",
      tone: "bad",
      icon: "🚨",
      text: `${d.falseAlarms} false alarm${d.falseAlarms === 1 ? "" : "s"} cost accuracy.`,
      slot: "instruments",
      metric: "accuracy",
      source: "diagnostics.falseAlarms",
    });

  // ── Coverage & decisions ──────────────────────────────────────────────
  if (result.score.coverage < 50) {
    lines.push({
      id: "low-coverage",
      tone: "bad",
      icon: "🗺️",
      text: `Only ${d.observedCells} of ${d.totalCells} map cells seen clearly — under half!`,
      slot: "orbit",
      metric: "coverage",
      source: "diagnostics.observedCells, score.coverage",
    });
    if (d.decisions.focus === "hazard")
      lines.push({
        id: "focus-narrow",
        tone: "bad",
        icon: "🎯",
        text: "Hazard focus left the rest of the map with fewer looks.",
        detail: `Background cells got ×${DECISION_EFFECTS.hazardFocusBackgroundFactor} look chance.`,
        decision: "focus",
        metric: "coverage",
        source: "diagnostics.decisions.focus",
      });
  }

  // ── Reliability factors ───────────────────────────────────────────────
  // "fast" downlink draws extra transmitter power; blame the call, not the part,
  // when the part alone would have been fine.
  const fast = d.decisions.downlink === "fast";
  const batteryPart = partsCatalog.batteries.find(
    (b) => b.id === design.battery,
  );
  if (d.powerMargin < 0.9)
    lines.push({
      id: "power",
      tone: "bad",
      icon: "⚡",
      text: fast
        ? "Fast downlink reduced your observing power margin."
        : "Low power margin reduced observing chances.",
      detail: `Power margin ${Math.round(d.powerMargin * 100)}%.`,
      ...(fast
        ? { decision: "downlink" as const }
        : { slot: "solar" as const }),
      metric: "reliability",
      source:
        "diagnostics.powerMargin" +
        (fast ? ", diagnostics.decisions.downlink" : ""),
    });
  if (d.batteryContinuity < 0.8) {
    const callToBlame = fast && (batteryPart?.eclipseContinuity ?? 0) >= 0.8;
    lines.push({
      id: "battery",
      tone: "bad",
      icon: "🌑",
      text: callToBlame
        ? "Fast downlink reduced battery continuity in Earth's shadow."
        : "Battery coverage in Earth's shadow was limited.",
      detail: `Only ${Math.round(d.batteryContinuity * 100)}% of work kept going through eclipse.`,
      ...(callToBlame
        ? { decision: "downlink" as const }
        : { slot: "battery" as const }),
      metric: "reliability",
      source:
        "diagnostics.batteryContinuity" +
        (callToBlame ? ", diagnostics.decisions.downlink" : ""),
    });
  }
  if (d.dataMargin < 1)
    lines.push({
      id: "data",
      tone: "bad",
      icon: "💾",
      text: "Data production outpaced the modeled data budget.",
      detail: `Data margin ${Math.round(d.dataMargin * 100)}%.`,
      slot: "storage",
      metric: "reliability",
      source: "diagnostics.dataMargin",
    });
  return lines;
}

function countOf(line: CauseLine, d: NonNullable<SimResult["diagnostics"]>) {
  if (line.id === "cloud-blocked") return d.hazardCloudBlocked;
  if (line.id === "never-in-view") return d.hazardNeverInView;
  if (line.id === "not-recognised") return d.hazardNotRecognised;
  if (line.id === "before-event") return d.hazardBeforeEvent;
  return 0;
}

/** What helped. Only claims backed by the result. */
export function winLines(
  mission: Mission,
  design: SatelliteDesign,
  result: SimResult,
): CauseLine[] {
  const { hazard, obstacle } = hazardWords(mission);
  const d = result.diagnostics;
  const target = d?.targetResponseHours ?? mission.targetResponseHours;
  const delivered = result.firstDeliveryHours;
  const lines: CauseLine[] = [];
  if (delivered !== null && delivered <= target)
    lines.push({
      id: "on-time",
      tone: "good",
      icon: "📡",
      text: `Data landed ${r1(target - delivered)} h before the deadline!`,
      detail: d
        ? `Spotted at hour ${d.firstDetectionHours}, down in ${d.downlinkLatencyHours} h.`
        : undefined,
      slot: downlinkSlot(design),
      metric: "responseTime",
      source: "firstDeliveryHours",
    });
  if (d && d.bestInstrumentFit >= 0.85)
    lines.push({
      id: "sensor-fit",
      tone: "good",
      icon: "🔭",
      text: `${partsCatalog.instruments.find((p) => p.id === d.bestInstrumentId)?.name ?? "Your sensor"} was made for ${hazard}!`,
      detail: `Sensor match ${Math.round(d.bestInstrumentFit * 100)}%.`,
      slot: "instruments",
      metric: "accuracy",
      source: "diagnostics.bestInstrumentFit",
    });
  if (d && d.cloudPenetrating && d.hazardDetected > 0)
    lines.push({
      id: "through-clouds",
      tone: "good",
      icon: "🌩️",
      text: `Your sensor can observe through ${obstacle.toLowerCase()}.`,
      slot: "instruments",
      metric: "accuracy",
      source: "diagnostics.cloudPenetrating",
    });
  if (result.score.coverage >= 50)
    lines.push({
      id: "coverage",
      tone: "good",
      icon: "🗺️",
      text: `Mapped ${Math.round(result.score.coverage)}% of the area!`,
      slot: "orbit",
      metric: "coverage",
      source: "score.coverage",
    });
  if (
    d &&
    d.powerMargin >= 0.9 &&
    d.batteryContinuity >= 0.8 &&
    d.dataMargin >= 1
  )
    lines.push({
      id: "steady",
      tone: "good",
      icon: "🔋",
      text: "Power and data margins supported the mission.",
      metric: "reliability",
      source: "diagnostics.powerMargin, batteryContinuity, dataMargin",
    });
  if (
    d &&
    d.decisions.downlink === "fast" &&
    delivered !== null &&
    delivered <= target
  )
    lines.push({
      id: "fast-call",
      tone: "good",
      icon: "🚀",
      text: "Your fast-downlink call paid off!",
      detail: `Radio delay cut by ×${DECISION_EFFECTS.fastLatencyFactor}.`,
      decision: "downlink",
      metric: "responseTime",
      source: "diagnostics.decisions.downlink",
    });
  return lines;
}

/** The emotional payoff line for the fictional response team. Simulation-based only. */
export function teamPayoff(
  mission: Mission,
  result: SimResult,
): { tone: "good" | "bad"; headline: string; sub?: string } {
  const { hazard, team } = hazardWords(mission);
  const target =
    result.diagnostics?.targetResponseHours ?? mission.targetResponseHours;
  const delivered = result.firstDeliveryHours;
  const side = unmappedSide(mission, result);
  const sub = side
    ? `Danger zones in the ${quadrantName[side]} remained unconfirmed.`
    : undefined;
  if (delivered === null)
    return {
      tone: "bad",
      headline: `${team} had to work without your map.`,
      sub,
    };
  if (delivered <= target && result.success)
    return { tone: "good", headline: `${team} got your map in time!`, sub };
  if (delivered <= target)
    return {
      tone: "good",
      headline: `Your first ${hazard} alert landed in time!`,
      sub: sub ?? "But the full map came up short.",
    };
  return {
    tone: "bad",
    headline: `Your map reached ${team.toLowerCase()} ${r1(delivered - target)} h after they had to decide.`,
    sub,
  };
}

/** The quadrant with the most undetected hazard cells (needs ≥ 3 and ≥ 40% of misses), from the result. */
export function unmappedSide(
  mission: Mission,
  result: SimResult,
): Quadrant | null {
  const { rows, columns } = gridSize(mission);
  const byId = new Map(mission.grid.map((c) => [c.id, c]));
  const counts = new Map<Quadrant, number>();
  let total = 0;
  for (const c of result.cells) {
    if (c.truth <= 0.5 || isTrueDetection(c)) continue;
    const g = byId.get(c.id);
    if (!g) continue;
    total += 1;
    const q = quadrantOf(g, rows, columns);
    counts.set(q, (counts.get(q) ?? 0) + 1);
  }
  const top = [...counts].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  )[0];
  return top && top[1] >= 3 && top[1] / total >= 0.4 ? top[0] : null;
}

/** Score categories with real weights and points (engine explainScore), biggest loss first flagged. */
export function scoreRows(
  mission: Mission,
  result: SimResult,
  resources?: ResourceSummary,
): (MetricExplanation & { lost: number })[] {
  return explainScore(result, mission, resources ? { resources } : {}).map(
    (m) => ({
      ...m,
      lost: r1(m.weight - m.weightedPoints),
    }),
  );
}

/**
 * Slots for "FIX & RETRY": from real problem causes first; if there are none,
 * from the unearned stars (deadline → downlink, otherwise the slot behind the
 * weakest metric). Never more than `max`.
 */
export function fixSlots(
  mission: Mission,
  design: SatelliteDesign,
  result: SimResult,
  causes: CauseLine[],
  max = 2,
): PartSlot[] {
  const out: PartSlot[] = [];
  for (const c of causes) if (c.slot && !out.includes(c.slot)) out.push(c.slot);
  if (out.length === 0) {
    const target =
      result.diagnostics?.targetResponseHours ?? mission.targetResponseHours;
    if (
      result.firstDeliveryHours === null ||
      result.firstDeliveryHours > target
    )
      out.push(downlinkSlot(design));
    const metricSlot: Record<ScoreMetric, PartSlot> = {
      accuracy: "instruments",
      responseTime: downlinkSlot(design),
      coverage: "orbit",
      costEfficiency: "orbit",
      reliability: "battery",
    };
    const weakest = scoreRows(mission, result).sort(
      (a, b) => b.lost - a.lost,
    )[0];
    if (weakest && !out.includes(metricSlot[weakest.metric]))
      out.push(metricSlot[weakest.metric]);
  }
  return out.slice(0, max);
}

export function fixHref(slug: string, slots: PartSlot[], classroomId?: string) {
  const params = new URLSearchParams();
  if (slots.length) params.set("fix", slots.join(","));
  if (classroomId) params.set("classroom", classroomId);
  const q = params.toString().replace(/%2C/g, ",");
  return `/mission/${slug}/design${q ? "?" + q : ""}`;
}

/** A design without in-mission decisions (they are made fresh on every run). */
export function stripDecisions(design: SatelliteDesign): SatelliteDesign {
  const { decisions: _unused, ...rest } = design;
  void _unused;
  return rest;
}

// ── Attempt comparison ─────────────────────────────────────────────────

export type Trend = "up" | "down" | "same";

export interface ComparisonRow {
  id: string;
  label: string;
  before: string;
  after: string;
  trend: Trend;
  /** Whether "up" is good for this row (for delivery time lower is better). */
  better: boolean | null;
}

const trendOf = (before: number, after: number, eps = 0.05): Trend =>
  after > before + eps ? "up" : after < before - eps ? "down" : "same";

export function compareAttempts(
  before: { result: SimResult; costM: number },
  after: { result: SimResult; costM: number },
): ComparisonRow[] {
  const found = (r: SimResult) => r.cells.filter(isTrueDetection).length;
  const rows: ComparisonRow[] = [];
  const add = (
    id: string,
    label: string,
    b: number,
    a: number,
    fmt: (n: number) => string,
    higherIsBetter: boolean,
  ) => {
    const trend = trendOf(b, a);
    rows.push({
      id,
      label,
      before: fmt(b),
      after: fmt(a),
      trend,
      better: trend === "same" ? null : (trend === "up") === higherIsBetter,
    });
  };
  add(
    "score",
    "Score",
    before.result.score.total,
    after.result.score.total,
    (n) => n.toFixed(1),
    true,
  );
  add(
    "found",
    "Danger zones found",
    found(before.result),
    found(after.result),
    (n) => String(n),
    true,
  );
  add(
    "coverage",
    "Coverage",
    before.result.score.coverage,
    after.result.score.coverage,
    (n) => `${Math.round(n)}%`,
    true,
  );
  const db = before.result.firstDeliveryHours;
  const da = after.result.firstDeliveryHours;
  if (db === null || da === null) {
    const trend: Trend = db === da ? "same" : da === null ? "down" : "up";
    rows.push({
      id: "delivery",
      label: "Data delivered",
      before: db === null ? "never" : `hour ${db}`,
      after: da === null ? "never" : `hour ${da}`,
      trend,
      better: trend === "same" ? null : da !== null,
    });
  } else
    add("delivery", "Data delivered (hour)", db, da, (n) => `hour ${n}`, false);
  add("cost", "Cost", before.costM, after.costM, (n) => `$${n}M`, false);
  for (const m of [
    "accuracy",
    "responseTime",
    "coverage",
    "costEfficiency",
    "reliability",
  ] as const) {
    if (m === "coverage") continue;
    add(
      "metric-" + m,
      METRIC_NAMES[m],
      before.result.score[m],
      after.result.score[m],
      (n) => n.toFixed(0),
      true,
    );
  }
  return rows;
}

const METRIC_NAMES: Record<ScoreMetric, string> = {
  accuracy: "Accuracy",
  responseTime: "Response time",
  coverage: "Coverage",
  costEfficiency: "Cost efficiency",
  reliability: "Reliability",
};
