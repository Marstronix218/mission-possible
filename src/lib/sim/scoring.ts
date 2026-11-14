import type { Category, Constraints, ResourceSummary, ScoreBreakdown } from "../../types/game";
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
  const accuracy = input.targetCells === 0
    ? 100
    : 100 * Math.max(0, input.truePositives - input.falsePositives * 0.5) / input.targetCells;
  const coverage = input.totalCells === 0 ? 0 : 100 * input.observedCells / input.totalCells;
  const responseTime = input.firstDeliveryHours === null
    ? 0
    : 100 * (1 - input.firstDeliveryHours / (input.targetResponseHours * 2));
  const costEfficiency = accuracy >= 25 && coverage >= 25
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
  const total =
    (metrics.accuracy * weights.accuracy +
      metrics.responseTime * weights.responseTime +
      metrics.coverage * weights.coverage +
      metrics.costEfficiency * weights.costEfficiency +
      metrics.reliability * weights.reliability) /
    100;

  return { ...metrics, total: rounded(total) };
}
