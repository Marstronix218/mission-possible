import type {
  Category,
  Constraints,
  ResourceSummary,
  ScoreBreakdown,
  SimDiagnostics,
  SimResult,
} from "../../types/game";
import { categoryRules } from "./catalog";

export type ScoreMetric = keyof Omit<ScoreBreakdown, "total">;

export interface MetricExplanation {
  metric: ScoreMetric;
  label: string;
  /** 0–100 metric value exactly as scored. */
  value: number;
  /** Weight in percent for this mission category (weights sum to 100). */
  weight: number;
  /** value × weight / 100, rounded to 0.1. Sums to the total within rounding. */
  weightedPoints: number;
  /** How the engine computes this metric. */
  formula: string;
  /**
   * Why this run got this value, built only from engine diagnostics and score
   * inputs; null when the result has no diagnostics (invalid design or a
   * pre-1.2.0 result), so callers never show a reason the engine did not compute.
   */
  why: string | null;
}

export const METRIC_ORDER: ScoreMetric[] = ["accuracy", "responseTime", "coverage", "costEfficiency", "reliability"];

export const METRIC_LABELS: Record<ScoreMetric, string> = {
  accuracy: "Accuracy",
  responseTime: "Response time",
  coverage: "Coverage",
  costEfficiency: "Cost efficiency",
  reliability: "Reliability",
};

/** Mirrors src/lib/sim/scoring.ts and the reliability term in engine.ts. */
export const METRIC_FORMULAS: Record<ScoreMetric, string> = {
  accuracy: "100 × (danger zones found − ½ × false alarms) ÷ danger zones",
  responseTime: "100 × (1 − first alert delivery hour ÷ (2 × target hours)); 0 if no alert",
  coverage: "100 × cells seen clearly at least once ÷ all cells",
  costEfficiency: "100 × (1 − cost ÷ budget), only once accuracy and coverage both reach 25",
  reliability: "100 × orbit reliability × (0.55 + 0.3 × power margin + 0.15 × battery) × (0.75 + 0.15 × data margin + 0.1 × storage margin)",
};

const pct = (value: number): number => Math.round(value * 100);
const round1 = (value: number): number => Math.round(value * 10) / 10;
const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? "" : "s"}`;

/** "Total = 30% Accuracy + 30% Response time + …" for a hazard category. */
export function scoreFormulaText(category: Category): string {
  const weights = categoryRules[category].weights;
  const terms = METRIC_ORDER.map((metric) => `${weights[metric]}% ${METRIC_LABELS[metric]}`);
  return `Total = ${terms.join(" + ")}`;
}

function missBreakdown(d: SimDiagnostics): string {
  const parts = [
    d.hazardNeverInView > 0 ? `${d.hazardNeverInView} never in view` : null,
    d.hazardCloudBlocked > 0 ? `${d.hazardCloudBlocked} blocked by clouds or smoke` : null,
    d.hazardNotRecognised > 0 ? `${d.hazardNotRecognised} seen but not recognised` : null,
    d.hazardBeforeEvent > 0 ? `${d.hazardBeforeEvent} checked before the hazard started` : null,
  ].filter((part) => part !== null);
  return parts.length > 0 ? ` Missed: ${parts.join(", ")}.` : "";
}

function whyFor(
  metric: ScoreMetric,
  score: ScoreBreakdown,
  result: SimResult,
  d: SimDiagnostics,
  options: { resources?: ResourceSummary; constraints?: Constraints },
): string {
  switch (metric) {
    case "accuracy": {
      const alarms = d.falseAlarms > 0
        ? ` ${plural(d.falseAlarms, "false alarm")} took off ${plural(round1(d.falseAlarms * 0.5), "zone")}.`
        : "";
      return `Found ${d.hazardDetected} of ${d.hazardCells} danger zones.${alarms}${missBreakdown(d)}`;
    }
    case "responseTime":
      if (result.firstDeliveryHours === null || d.firstDetectionHours === null) {
        return "No danger zone was confirmed, so no alert was delivered.";
      }
      return `First alert spotted at hour ${d.firstDetectionHours} and delivered at hour ${result.firstDeliveryHours} after ${d.downlinkLatencyHours} h of downlink. Target is ${d.targetResponseHours} h; the score reaches 0 at ${d.targetResponseHours * 2} h.`;
    case "coverage": {
      const unseen = d.totalCells - d.observedCells;
      return `Got a clear look at ${d.observedCells} of ${d.totalCells} cells; ${unseen} were never seen clearly.`;
    }
    case "costEfficiency": {
      if (score.accuracy < 25 || score.coverage < 25) {
        return `No budget points: accuracy (${score.accuracy}) and coverage (${score.coverage}) must both reach 25 first.`;
      }
      if (options.resources && options.constraints) {
        return `Spent $${options.resources.costM}M of a $${options.constraints.budgetM}M budget.`;
      }
      return `${score.costEfficiency}% of the budget was left unspent.`;
    }
    case "reliability":
      return `Power margin ${pct(d.powerMargin)}%, battery through eclipse ${pct(d.batteryContinuity)}%, data margin ${pct(d.dataMargin)}%, storage margin ${pct(d.storageMargin)}%.`;
  }
}

/**
 * Per-metric explanation of a result, in METRIC_ORDER. Pass the attempt's
 * resources and constraints to show dollar amounts for cost efficiency.
 */
export function explainScore(
  result: SimResult,
  mission: { category: Category },
  options: { resources?: ResourceSummary; constraints?: Constraints } = {},
): MetricExplanation[] {
  const weights = result.diagnostics?.weights ?? categoryRules[mission.category].weights;
  return METRIC_ORDER.map((metric) => {
    const value = result.score[metric];
    return {
      metric,
      label: METRIC_LABELS[metric],
      value,
      weight: weights[metric],
      weightedPoints: round1((value * weights[metric]) / 100),
      formula: METRIC_FORMULAS[metric],
      why: result.diagnostics ? whyFor(metric, result.score, result, result.diagnostics, options) : null,
    };
  });
}
