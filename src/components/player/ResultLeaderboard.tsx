"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, backendAvailable, isMockMode } from "@/components/results/cloud";
import type { LeaderboardSubmission } from "@/lib/api/leaderboard";
import { getMission } from "@/components/results/missions";
import {
  conditionsLabel,
  difficultyLabels,
  type Difficulty,
} from "@/lib/leaderboard/difficulty";
import { usePlayerName } from "./player-name";
import { createLeaderboardSubmitter } from "./submit";
import { LeaderboardTable } from "./LeaderboardTable";

const submitScore = createLeaderboardSubmitter((action, input) =>
  api(action, input),
);
const visibleRows = 10;
/** `mission_ranking` returns at most this many rows. */
const rankingLimit = 100;
const deviceOnlyMessage =
  "This attempt was saved only on this device, so it isn't on the leaderboard.";

/**
 * Rank wording. With the total number of ranked players (scoped rankings) it
 * is exact; otherwise the ranking RPC stops at `rankingLimit` rows.
 */
export function rankPhrase(rank: number, rows: number, players?: number) {
  if (players !== undefined) return `#${rank} of ${players}`;
  return rows >= rankingLimit
    ? `#${rank} in the top ${rankingLimit}`
    : `#${rank} of ${rows}`;
}

/** Full leaderboard link for the same mission + difficulty scope. */
export function leaderboardHref(
  missionSlug: string,
  classroomId?: string,
  difficulty?: Difficulty,
  constraints?: { budgetM: number; massKg: number },
) {
  const q = new URLSearchParams(
    classroomId
      ? { tab: "class", classroom: classroomId }
      : { tab: "global", mission: missionSlug },
  );
  if (!classroomId && difficulty) q.set("difficulty", difficulty);
  if (!classroomId && constraints) {
    q.set("budget", String(constraints.budgetM));
    q.set("mass", String(constraints.massKg));
  }
  return "/leaderboard?" + q.toString();
}

/** The server answers 404 when the attempt was never saved there. */
export function isUnsavedAttempt(e: unknown) {
  return (e as { status?: unknown } | null)?.status === 404;
}

type State =
  | { status: "loading" }
  | { status: "done"; data: LeaderboardSubmission }
  | { status: "error"; message: string }
  | { status: "device-only" };

/**
 * Posts the server-scored attempt to its leaderboard as soon as the results
 * screen loads, then shows the ranking with the player's own row highlighted.
 * Failures never hide the mission result above it.
 */
export function ResultLeaderboard({
  attemptId,
  missionSlug,
  classroomId,
  verified,
}: {
  attemptId: string;
  missionSlug: string;
  classroomId?: string;
  /** False when the live save failed and the attempt exists only locally. */
  verified?: boolean;
}) {
  const name = usePlayerName();
  const [state, setState] = useState<State>({ status: "loading" });
  const [globalRows, setGlobalRows] = useState<
    LeaderboardSubmission["rows"] | null
  >(null);
  const [round, setRound] = useState(0);
  // Mock attempts are never server-verified, but the demo board accepts them.
  const deviceOnly = !isMockMode && verified === false;
  const ready =
    backendAvailable && !deviceOnly && (classroomId ? true : !!name);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    // Only an explicitly chosen public name opts class attempts into global rankings.
    submitScore(attemptId, name ?? undefined)
      .then((data) => {
        if (active) setState({ status: "done", data });
      })
      .catch((e: unknown) => {
        if (!active) return;
        if (isUnsavedAttempt(e)) setState({ status: "device-only" });
        else
          setState({
            status: "error",
            message:
              e instanceof Error
                ? e.message
                : "Could not reach the leaderboard.",
          });
      });
    return () => {
      active = false;
    };
  }, [ready, attemptId, name, round]);

  const scope = state.status === "done" ? state.data.scope : undefined;
  const globalDifficulty = scope?.difficulty;
  const globalBudget = scope?.constraints?.budgetM;
  const globalMass = scope?.constraints?.massKg;
  const posted = state.status === "done";
  useEffect(() => {
    if (!classroomId || !backendAvailable || !posted) return;
    let active = true;
    api<LeaderboardSubmission["rows"]>("ranking", {
      missionSlug,
      difficulty: globalDifficulty,
      constraints:
        globalBudget !== undefined && globalMass !== undefined
          ? { budgetM: globalBudget, massKg: globalMass }
          : undefined,
    })
      .then((rows) => {
        if (active) setGlobalRows(rows);
      })
      .catch(() => {
        if (active) setGlobalRows([]);
      });
    return () => {
      active = false;
    };
  }, [
    classroomId,
    missionSlug,
    posted,
    globalDifficulty,
    globalBudget,
    globalMass,
  ]);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    setRound((n) => n + 1);
  }, []);

  const fullHref = leaderboardHref(
    missionSlug,
    classroomId,
    scope?.difficulty,
    scope?.constraints,
  );
  const scopeLabel = scope
    ? `${getMission(scope.missionSlug)?.city ?? scope.missionSlug} · ${difficultyLabels[scope.difficulty]}${scope.constraints ? ` · ${conditionsLabel(scope.constraints)}` : ""} · simulator ${scope.engineVersion}`
    : null;

  let body: React.ReactNode;
  if (!backendAvailable)
    body = (
      <p className="m-0">
        The leaderboard needs the live service, which is not configured here.
        Your result is saved on this device.
      </p>
    );
  else if (deviceOnly || state.status === "device-only")
    body = <p className="m-0">{deviceOnlyMessage}</p>;
  else if (!classroomId && name === null)
    body = (
      <p className="m-0">
        Choose a pilot name to post this score to the leaderboard.
      </p>
    );
  else if (!ready || state.status === "loading")
    body = <p className="m-0">Posting your score to the leaderboard…</p>;
  else if (state.status === "error")
    body = (
      <div className="error">
        <p className="mt-0">
          Your mission result is safe, but we could not post it to the
          leaderboard: {state.message}
        </p>
        <button type="button" className="btn-pop btn-pop--sm" onClick={retry}>
          ↻ Try again
        </button>
      </div>
    );
  else {
    const { rows, me, attempt } = state.data;
    const shown = rows.slice(0, visibleRows);
    const mine = rows.find((r) => r.mine);
    if (mine && !shown.includes(mine)) shown.push(mine);
    body = (
      <>
        <p className="m-0 font-display text-lg">
          {me
            ? `🏆 ${me.nickname}, you are ${rankPhrase(me.rank, rows.length, me.players)} with ${me.score.toFixed(1)} points.`
            : attempt.ranked
              ? "Your score is posted. You are outside the top 100 for now."
              : "This attempt used an older simulator version, so it is not ranked."}
        </p>
        {me && attempt.score < me.score && (
          <p className="muted mt-1">
            This attempt scored {attempt.score.toFixed(1)}; your best score
            counts on the leaderboard.
          </p>
        )}
        {scopeLabel && (
          <p className="muted mt-1">
            Ranked against the same mission, difficulty and simulator version:{" "}
            <strong>{scopeLabel}</strong>.
          </p>
        )}
        <LeaderboardTable
          rows={shown}
          caption={
            (scopeLabel ? scopeLabel + " · " : "") +
            (rows.length > shown.length
              ? `Top ${visibleRows} of ${me?.players ?? rows.length} pilots · simulated scores`
              : "Best simulated score per pilot · ties go to the earliest")
          }
        />
        {classroomId && globalRows && (
          <div className="mt-6">
            <h3 className="font-display text-lg">Global mission ranking</h3>
            <p className="muted">
              Compare public scores for this mission under the same engineering
              limits. Only pilots with a public name appear here.
            </p>
            <LeaderboardTable
              rows={globalRows.slice(0, visibleRows)}
              caption="Global top pilots for this mission"
            />
          </div>
        )}
      </>
    );
  }

  return (
    <section className="panel mt-6" aria-labelledby="result-leaderboard">
      <h2 id="result-leaderboard" className="mt-0 font-display text-xl">
        🏆 {classroomId ? "Your score and rankings" : "Leaderboard"}
      </h2>
      <div aria-live="polite">{body}</div>
      <p className="mb-0 mt-3">
        <Link href={fullHref}>
          {classroomId
            ? "Open the full class leaderboard ↗"
            : "Open the full leaderboards ↗"}
        </Link>
        {classroomId && (
          <>
            {" · "}
            <Link
              href={leaderboardHref(
                missionSlug,
                undefined,
                scope?.difficulty,
                scope?.constraints ?? undefined,
              )}
            >
              View global mission ranking ↗
            </Link>
          </>
        )}
      </p>
    </section>
  );
}
