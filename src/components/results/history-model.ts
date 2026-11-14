import { z } from "zod";
import { designSchema } from "./contracts";
const metric = z.number().finite().min(0).max(100);
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
  at: z.string().datetime(),
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
