import { z } from "zod";

/** One row of a mission ranking as returned by the database or the demo model. */
export type RankingSource = {
  user_id: string;
  nickname: string;
  score: number;
  attempts: number;
  improvement: number;
  achieved: string;
};

export const rankingEntrySchema = z.object({
  entry_id: z.number().int().positive(),
  nickname: z.string(),
  score: z.coerce.number(),
  attempts: z.coerce.number(),
  improvement: z.coerce.number(),
  achieved: z.string(),
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
    })
    .nullable(),
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
    entry_id: i + 1,
    nickname: row.nickname,
    score: Number(row.score),
    attempts: Number(row.attempts),
    improvement: Number(row.improvement),
    achieved: row.achieved,
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
): LeaderboardSubmission {
  const ranked = publicRanking(rows, userId);
  const index = ranked.findIndex((r) => r.mine);
  return {
    rows: ranked,
    me:
      index < 0
        ? null
        : {
            rank: index + 1,
            nickname: ranked[index].nickname,
            score: ranked[index].score,
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
