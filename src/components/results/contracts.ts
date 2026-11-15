import { z } from "zod";
import { missionSlugs } from "@/lib/missions/registry";
export const decisionsSchema = z
  .object({
    focus: z.enum(["wide", "hazard"]).optional(),
    downlink: z.enum(["fast", "save-power"]).optional(),
    retask: z
      .object({
        day: z.number().int().min(0).max(30),
        quadrant: z.enum(["nw", "ne", "sw", "se"]),
      })
      .strict()
      .optional(),
  })
  .strict();
export const designSchema = z
  .object({
    instruments: z.array(z.string().max(30)).min(1).max(8),
    orbit: z.string().max(30),
    solar: z.string().max(30),
    battery: z.string().max(30),
    comm: z.string().max(30),
    groundStations: z.union([z.literal(1), z.literal(3), z.literal(5)]),
    storage: z.string().max(30),
    decisions: decisionsSchema.optional(),
  })
  .strict();
export const classSchema = z.object({
  name: z.string().trim().min(1).max(80),
  mission_slug: z.enum(missionSlugs),
  budget_m: z.number().min(80).max(1000),
  mass_kg: z.number().min(150).max(1500),
  max_attempts: z.number().int().min(1).max(100).nullable(),
  deadline: z.string().datetime().nullable(),
});
export const nicknameSchema = z
  .string()
  .trim()
  .min(2)
  .max(24)
  .regex(
    /^[\p{L}\p{N} _-]+$/u,
    "Use letters, numbers, spaces, hyphens, or underscores.",
  )
  .refine(
    (s) => !/(fuck|shit|nigger|bitch)/i.test(s),
    "Please choose a different nickname.",
  );
export type Classroom = {
  id: string;
  name: string;
  mission_slug: string;
  budget_m: number;
  mass_kg: number;
  max_attempts: number | null;
  deadline: string | null;
  join_code: string;
  is_active: boolean;
  teacher_id: string;
};
export type Ranking = {
  entry_id: number;
  nickname: string;
  score: number;
  attempts: number;
  improvement: number;
  achieved: string;
  /** Ranked players in this scope (scoped rankings only). */
  players?: number;
  /** Set by the server/demo model for the requesting player's own row. */
  mine?: boolean;
};

export type ClassroomProgress = {
  attemptsUsed: number;
  canSubmit: boolean;
  isTeacher: boolean;
};

/** The caller's own attempt summary for the "My performance" leaderboard tab. */
export type MyAttempt = {
  id: string;
  mission_slug: string;
  classroom_id: string | null;
  score_total: number;
  score_breakdown: Partial<Record<string, number>> | null;
  constraints: { budgetM: number; massKg: number } | null;
  engine_version: string;
  created_at: string;
};

/** A class the caller joined (class nickname) or teaches (join code). */
export type MyClass = {
  id: string;
  name: string;
  mission_slug: string;
  budget_m: number;
  mass_kg: number;
  max_attempts: number | null;
  deadline: string | null;
  is_active: boolean;
  role: "student" | "teacher";
  nickname: string | null;
  join_code?: string;
};
