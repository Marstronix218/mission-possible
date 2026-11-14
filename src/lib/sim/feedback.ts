import type { FeedbackItem, ResourceSummary, ScoreBreakdown } from "../../types/game";

export function generateFeedback(
  score: ScoreBreakdown,
  resources: ResourceSummary,
  success: boolean,
): FeedbackItem[] {
  const feedback: FeedbackItem[] = [];

  if (success) {
    feedback.push({
      type: "success",
      key: "mission.success",
      message: "Mission objectives achieved: the design reached the score and coverage thresholds.",
    });
  } else {
    feedback.push({
      type: "warning",
      key: "mission.threshold_not_met",
      message: "The mission needs a score of 60 and at least 50% coverage.",
      params: { score: score.total, coverage: score.coverage },
    });
  }

  if (score.accuracy < 55) {
    feedback.push({ type: "tip", key: "accuracy.sensor_fit", message: "Choose an instrument that is better matched to this hazard." });
  } else {
    feedback.push({ type: "success", key: "accuracy.strong", message: "Your instrument package identified target cells accurately." });
  }
  if (score.coverage < 50) {
    feedback.push({ type: "tip", key: "coverage.orbit", message: "Try an orbit with a wider swath or more frequent access." });
  }
  if (score.responseTime < 50) {
    feedback.push({ type: "tip", key: "response.downlink", message: "Increase downlink capacity or add ground stations to deliver observations sooner." });
  }
  if (score.reliability < 70) {
    feedback.push({ type: "warning", key: "reliability.margin", message: "Increase power, battery, storage, or downlink margin to improve reliability." });
  }
  if (score.costEfficiency >= 50) {
    feedback.push({ type: "success", key: "cost.efficient", message: "The mission preserves a strong budget margin without sacrificing core performance." });
  }
  resources.warnings.forEach((message, index) => {
    feedback.push({ type: "warning", key: `resources.warning_${index + 1}`, message });
  });

  return feedback.slice(0, 6);
}
