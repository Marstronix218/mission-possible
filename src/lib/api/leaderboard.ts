import { z } from "zod";
import { difficulties } from "@/lib/leaderboard/difficulty";

/** One row of a mission ranking as returned by the database or the demo model. */
export type RankingSource = {
  user_id: string;
  nickname: string;
  score: number;
  attempts: number;
  improvement: number;
  achieved: string;
  /** True rank within the scope (mission_ranking_scoped); defaults to row order. */
  rank?: number;
  /** Number of ranked players in the scope. */
  players?: number;
};

export const rankingEntrySchema = z.object({
  entry_id: z.number().int().positive(),
  nickname: z.string(),
  score: z.coerce.number(),
  attempts: z.coerce.number(),
  improvement: z.coerce.number(),
  achieved: z.string(),
  players: z.coerce.number().optional(),
  mine: z.boolean().optional(),
});
export type RankingEntry = z.infer<typeof rankingEntrySchema>;

export const leaderboardSubmissionSchema = z.object({
  rows: z.array(rankingEntrySchema),
  me: z
    .object({
      rank: z.number().int().positive(),
      nickname: z.string(),
      score: z.coerce.number(),
      players: z.coerce.number().optional(),
    })
    .nullable(),
  /** Ranking scope: never mixes missions, difficulty tiers or engine versions. */
  scope: z
    .object({
      missionSlug: z.string(),
      difficulty: z.enum(difficulties),
      engineVersion: z.string(),
      constraints: z
        .object({ budgetM: z.number(), massKg: z.number() })
        .optional(),
    })
    .optional(),
  attempt: z.object({
    id: z.string(),
    missionSlug: z.string(),
    classroomId: z.string().nullable(),
    score: z.coerce.number(),
    ranked: z.boolean(),
  }),
});
export type LeaderboardSubmission = z.infer<typeof leaderboardSubmissionSchema>;

/** Strip user IDs before ranking rows leave the server; only a "mine" flag remains. */
export function publicRanking(
  rows: RankingSource[],
  userId: string,
): RankingEntry[] {
  return rows.map((row, i) => ({
    entry_id: row.rank === undefined ? i + 1 : Number(row.rank),
    nickname: row.nickname,
    score: Number(row.score),
    attempts: Number(row.attempts),
    improvement: Number(row.improvement),
    achieved: row.achieved,
    ...(row.players === undefined ? {} : { players: Number(row.players) }),
    mine: row.user_id === userId,
  }));
}

/** Combine a server-scored attempt with its mission ranking for the results screen. */
export function leaderboardSubmission(
  rows: RankingSource[],
  userId: string,
  attempt: {
    id: string;
    mission_slug: string;
    classroom_id: string | null;
    score_total: number;
    engine_version: string;
  },
  engineVersion: string,
  scope?: LeaderboardSubmission["scope"],
): LeaderboardSubmission {
  const ranked = publicRanking(rows, userId);
  const mine = ranked.find((r) => r.mine);
  return {
    rows: ranked,
    ...(scope ? { scope } : {}),
    me: !mine
      ? null
      : {
          rank: mine.entry_id,
          nickname: mine.nickname,
          score: mine.score,
          ...(mine.players === undefined ? {} : { players: mine.players }),
        },
    attempt: {
      id: attempt.id,
      missionSlug: attempt.mission_slug,
      classroomId: attempt.classroom_id,
      score: Number(attempt.score_total),
      ranked: attempt.engine_version === engineVersion,
    },
  };
}
