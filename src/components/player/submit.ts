import {
  leaderboardSubmissionSchema,
  type LeaderboardSubmission,
} from "@/lib/api/leaderboard";

type Call = (
  action: string,
  input: Record<string, unknown>,
) => Promise<unknown>;

/**
 * Publish a saved attempt to its leaderboard. Concurrent calls for the same
 * attempt and name share one request (React re-mounts, double clicks); the
 * server is idempotent per attempt ID, so a refresh or revisit only re-reads
 * the ranking. Failed requests are forgotten so the player can retry.
 */
export function createLeaderboardSubmitter(call: Call) {
  const inflight = new Map<string, Promise<LeaderboardSubmission>>();
  return function submit(
    attemptId: string,
    nickname?: string,
  ): Promise<LeaderboardSubmission> {
    const key = attemptId + "\u0000" + nickname;
    const pending = inflight.get(key);
    if (pending) return pending;
    const request = call("submitScore", {
      attemptId,
      ...(nickname ? { nickname } : {}),
    })
      .then((body) => leaderboardSubmissionSchema.parse(body))
      .finally(() => inflight.delete(key));
    inflight.set(key, request);
    return request;
  };
}
