import { z } from "zod";
export const designSchema = z
  .object({
    instruments: z.array(z.string().max(30)).min(1).max(8),
    orbit: z.string().max(30),
    solar: z.string().max(30),
    battery: z.string().max(30),
    comm: z.string().max(30),
    groundStations: z.union([z.literal(1), z.literal(3), z.literal(5)]),
    storage: z.string().max(30),
  })
  .strict();
export const classSchema = z.object({
  name: z.string().trim().min(1).max(80),
  mission_slug: z.enum(["los-angeles", "houston", "phoenix"]),
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
  user_id: string;
  nickname: string;
  score: number;
  attempts: number;
  improvement: number;
  achieved: string;
};
