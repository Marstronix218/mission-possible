import { z } from "zod";
import { decisionsSchema, designSchema } from "./contracts";
const metric = z.number().finite().min(0).max(100);
const count = z.number().int().nonnegative().max(10000);
const factor = z.number().finite().min(0).max(1);
const hour = z.number().finite().nonnegative();
const diagnosticsSchema = z
  .object({
    hazardCells: count,
    hazardDetected: count,
    hazardNeverInView: count,
    hazardCloudBlocked: count,
    hazardNotRecognised: count,
    hazardBeforeEvent: count,
    falseAlarms: count,
    observedCells: count,
    totalCells: count,
    firstDetectionHours: hour.nullable(),
    downlinkLatencyHours: hour,
    targetResponseHours: hour.positive(),
    powerMargin: factor,
    dataMargin: factor,
    storageMargin: factor,
    batteryContinuity: factor,
    operationFactor: factor,
    coverageChance: factor,
    reliabilityFactor: factor,
    bestInstrumentId: z.string().min(1).nullable(),
    bestInstrumentFit: factor,
    cloudPenetrating: z.boolean(),
    weights: z.object({
      accuracy: metric,
      responseTime: metric,
      coverage: metric,
      costEfficiency: metric,
      reliability: metric,
    }),
    decisions: z.object({
      focus: z.enum(["wide", "hazard"]),
      downlink: z.enum(["fast", "save-power", "standard"]),
      retask: decisionsSchema.shape.retask,
    }),
  })
  .refine(
    (d) =>
      d.hazardDetected +
        d.hazardNeverInView +
        d.hazardCloudBlocked +
        d.hazardNotRecognised +
        d.hazardBeforeEvent ===
        d.hazardCells &&
      d.hazardCells <= d.totalCells &&
      d.observedCells <= d.totalCells &&
      Math.abs(Object.values(d.weights).reduce((a, b) => a + b, 0) - 100) <
        0.001,
    "Inconsistent simulation diagnostics",
  );
export const resultSnapshotSchema = z.object({
  score: z.object({
    accuracy: metric,
    responseTime: metric,
    coverage: metric,
    costEfficiency: metric,
    reliability: metric,
    total: metric,
  }),
  cells: z
    .array(
      z.object({
        id: z.string(),
        truth: z.number().finite(),
        observed: z.boolean(),
        detected: z.boolean(),
        // Per-pass detail from engine 1.2.0+; absent on older saved attempts.
        lookHours: z.array(hour).max(200).optional(),
        blockedHours: z.array(hour).max(200).optional(),
        detectedHour: hour.nullable().optional(),
        missReason: z
          .enum([
            "never-in-view",
            "cloud-blocked",
            "not-recognised",
            "before-event",
          ])
          .optional(),
      }),
    )
    .max(10000),
  timeline: z
    .array(
      z.object({
        t: z.number().finite().nonnegative(),
        lat: z.number().min(-90).max(90),
        lon: z.number().min(-180).max(180),
        event: z.string().optional(),
      }),
    )
    .max(10000),
  feedback: z.array(
    z.object({
      type: z.enum(["success", "warning", "tip"]),
      key: z.string(),
      message: z.string(),
      params: z.record(z.string(), z.number().finite()).optional(),
    }),
  ),
  success: z.boolean(),
  firstDeliveryHours: z.number().finite().nonnegative().nullable(),
  engineVersion: z.string().min(1),
  diagnostics: diagnosticsSchema.optional(),
});
export const savedAttemptSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  design: designSchema,
  constraints: z.object({
    budgetM: z.number().finite().positive(),
    massKg: z.number().finite().positive(),
  }),
  result: resultSnapshotSchema,
  at: z.string().datetime({ offset: true }),
  classroomId: z.string().min(1).optional(),
  verified: z.boolean().default(false),
});
export type SavedAttempt = z.infer<typeof savedAttemptSchema>;
export function parseSavedAttempts(raw: string | null): SavedAttempt[] {
  try {
    const rows: unknown = JSON.parse(raw ?? "[]");
    if (!Array.isArray(rows)) return [];
    return rows
      .flatMap((row) => {
        const parsed = savedAttemptSchema.safeParse(row);
        return parsed.success ? [parsed.data] : [];
      })
      .slice(-50);
  } catch {
    return [];
  }
}
export function comparableAttempts(a: SavedAttempt, b: SavedAttempt) {
  return (
    a.id !== b.id &&
    a.slug === b.slug &&
    a.classroomId === b.classroomId &&
    a.result.engineVersion === b.result.engineVersion &&
    a.constraints.budgetM === b.constraints.budgetM &&
    a.constraints.massKg === b.constraints.massKg
  );
}
export function previousComparableAttempt(
  history: SavedAttempt[],
  selected: SavedAttempt,
) {
  const sorted = [...history].sort((a, b) => b.at.localeCompare(a.at));
  const index = sorted.findIndex((a) => a.id === selected.id);
  return index < 0
    ? undefined
    : sorted.slice(index + 1).find((a) => comparableAttempts(selected, a));
}
