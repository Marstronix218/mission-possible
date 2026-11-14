import { z } from "zod";
const partId = z.string().regex(/^[a-z0-9_]{1,64}$/);
export const satelliteDesignSchema = z.strictObject({
  instruments: z
    .array(partId)
    .min(1)
    .max(8)
    .refine(
      (values) => new Set(values).size === values.length,
      "Instruments must be unique.",
    ),
  orbit: partId,
  solar: partId,
  battery: partId,
  comm: partId,
  groundStations: z.union([z.literal(1), z.literal(3), z.literal(5)]),
  storage: partId,
});
// Scores, user IDs and constraints are intentionally absent: the server owns them.
export const createAttemptSchema = z.strictObject({
  missionSlug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(80),
  design: satelliteDesignSchema,
});
export type CreateAttemptInput = z.infer<typeof createAttemptSchema>;
export const apiErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});
