import type {
  Category,
  Constraints,
  ResourceSummary,
  ScoreBreakdown,
} from "../../types/game";
import { categoryRules } from "./catalog";

const clamp = (value: number): number => Math.min(100, Math.max(0, value));
const rounded = (value: number): number => Math.round(clamp(value) * 10) / 10;

export interface ScoreInputs {
  category: Category;
  truePositives: number;
  falsePositives: number;
  targetCells: number;
  observedCells: number;
  totalCells: number;
  firstDeliveryHours: number | null;
  targetResponseHours: number;
  reliability: number;
  resources: ResourceSummary;
  constraints: Constraints;
}

export function calculateScore(input: ScoreInputs): ScoreBreakdown {
  const weights = categoryRules[input.category].weights;
  const accuracy =
    input.targetCells === 0
      ? 100
      : (100 * Math.max(0, input.truePositives - input.falsePositives * 0.5)) /
        input.targetCells;
  const coverage =
    input.totalCells === 0 ? 0 : (100 * input.observedCells) / input.totalCells;
  const responseTime =
    input.firstDeliveryHours === null
      ? 0
      : 100 * (1 - input.firstDeliveryHours / (input.targetResponseHours * 2));
  const costEfficiency =
    accuracy >= 25 && coverage >= 25
      ? 100 * (1 - input.resources.costM / input.constraints.budgetM)
      : 0;
  const reliability = input.reliability * 100;
  const metrics = {
    accuracy: rounded(accuracy),
    responseTime: rounded(responseTime),
    coverage: rounded(coverage),
    costEfficiency: rounded(costEfficiency),
    reliability: rounded(reliability),
  };
  const evaluationWeight =
    weights.accuracy +
    weights.responseTime +
    weights.coverage +
    weights.reliability;
  const total =
    (metrics.accuracy * weights.accuracy +
      metrics.responseTime * weights.responseTime +
      metrics.coverage * weights.coverage +
      metrics.reliability * weights.reliability) /
    evaluationWeight;

  return { ...metrics, total: rounded(total) };
}

/** Evaluation weights after treating budget as a launch constraint, not a score. */
export function evaluationWeights(category: Category) {
  const source = categoryRules[category].weights;
  const active =
    source.accuracy +
    source.responseTime +
    source.coverage +
    source.reliability;
  return {
    accuracy: (source.accuracy / active) * 100,
    responseTime: (source.responseTime / active) * 100,
    coverage: (source.coverage / active) * 100,
    costEfficiency: 0,
    reliability: (source.reliability / active) * 100,
  };
}
