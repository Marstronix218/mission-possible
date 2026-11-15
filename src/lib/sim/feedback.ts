import type {
  FeedbackItem,
  ResourceSummary,
  ScoreBreakdown,
  SimDiagnostics,
} from "../../types/game";

const percent = (value: number): number => Math.round(value * 100);

/**
 * Feedback is built only from numbers the engine computed in this run. Every
 * cause it names is a counter or factor in `diagnostics`; nothing is guessed.
 */
export function generateFeedback(
  score: ScoreBreakdown,
  resources: ResourceSummary,
  success: boolean,
  diagnostics: SimDiagnostics,
): FeedbackItem[] {
  const feedback: FeedbackItem[] = [];
  const d = diagnostics;

  if (success) {
    feedback.push({
      type: "success",
      key: "mission.success",
      message:
        "Mission objectives achieved: the design reached the score and coverage thresholds.",
    });
  } else {
    feedback.push({
      type: "warning",
      key: "mission.threshold_not_met",
      message: "The mission needs a score of 60 and at least 50% coverage.",
      params: { score: score.total, coverage: score.coverage },
    });
  }

  feedback.push({
    type:
      d.hazardCells > 0 && d.hazardDetected * 2 >= d.hazardCells
        ? "success"
        : "tip",
    key: "hazard.found",
    message: `You found ${d.hazardDetected} of ${d.hazardCells} danger zones.`,
    params: { detected: d.hazardDetected, total: d.hazardCells },
  });

  // Miss causes, largest first, so the biggest real problem is never cut off.
  const misses: FeedbackItem[] = [];
  if (d.hazardNeverInView > 0) {
    misses.push({
      type: "tip",
      key: "hazard.never_in_view",
      message: `Your satellite never looked at ${d.hazardNeverInView} danger zones.`,
      params: { count: d.hazardNeverInView, coverageChance: d.coverageChance },
    });
  }
  if (d.hazardCloudBlocked > 0) {
    misses.push({
      type: "tip",
      key: d.cloudPenetrating
        ? "hazard.cloud_blocked_residual"
        : "hazard.cloud_blocked",
      message: d.cloudPenetrating
        ? `Even through clouds, every look at ${d.hazardCloudBlocked} danger zones was blocked.`
        : `Clouds or smoke blocked every look at ${d.hazardCloudBlocked} danger zones.`,
      params: { count: d.hazardCloudBlocked },
    });
  }
  if (d.hazardNotRecognised > 0) {
    misses.push({
      type: "tip",
      key: "hazard.not_recognised",
      message: `Your sensor saw ${d.hazardNotRecognised} danger zones clearly but did not recognise the hazard (sensor match ${percent(d.bestInstrumentFit)}%).`,
      params: { count: d.hazardNotRecognised, fit: d.bestInstrumentFit },
    });
  }
  if (d.hazardBeforeEvent > 0) {
    misses.push({
      type: "tip",
      key: "hazard.before_event",
      message: `${d.hazardBeforeEvent} danger zones had no clear observation after the hazard started there.`,
      params: { count: d.hazardBeforeEvent },
    });
  }
  misses.sort((a, b) => (b.params?.count ?? 0) - (a.params?.count ?? 0));
  feedback.push(...misses);

  if (d.firstDetectionHours === null) {
    feedback.push({
      type: "warning",
      key: "response.no_detection",
      message: "No danger zone was confirmed, so no alert reached the ground.",
    });
  } else {
    feedback.push({
      type: score.responseTime >= 50 ? "success" : "tip",
      key: "response.delivery",
      message: `First alert spotted at hour ${d.firstDetectionHours}; the data took ${d.downlinkLatencyHours} h to come down.`,
      params: {
        detectedHour: d.firstDetectionHours,
        latencyHours: d.downlinkLatencyHours,
        targetHours: d.targetResponseHours,
      },
    });
  }

  if (d.falseAlarms > 0) {
    feedback.push({
      type: "tip",
      key: "accuracy.false_alarms",
      message: `${d.falseAlarms} false alarms cost accuracy points.`,
      params: { count: d.falseAlarms },
    });
  }
  if (score.reliability < 70) {
    feedback.push({
      type: "warning",
      key: "reliability.margins",
      message: `Reliability is low: power margin ${percent(d.powerMargin)}%, battery ${percent(d.batteryContinuity)}%, data margin ${percent(d.dataMargin)}%.`,
      params: {
        power: d.powerMargin,
        battery: d.batteryContinuity,
        data: d.dataMargin,
      },
    });
  }
  resources.warnings.forEach((message, index) => {
    feedback.push({
      type: "warning",
      key: `resources.warning_${index + 1}`,
      message,
    });
  });

  return feedback.slice(0, 7);
}
