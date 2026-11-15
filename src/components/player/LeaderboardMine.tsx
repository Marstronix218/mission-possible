"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, backendAvailable, isMockMode } from "@/components/results/cloud";
import { demoUpdateEvent } from "@/components/results/mock-storage";
import { getMission } from "@/components/results/missions";
import { loadAttempts } from "@/components/results/session";
import type { MyAttempt } from "@/components/results/contracts";
import {
  conditionsLabel,
  difficultyLabels,
} from "@/lib/leaderboard/difficulty";
import {
  buildProgress,
  scoreComponentLabels,
  type ProgressAttempt,
} from "@/lib/leaderboard/progress";
import { LeaderboardProgressChart } from "./LeaderboardProgressChart";

const missionName = (slug: string) => getMission(slug)?.city ?? slug;
const fmt = (n: number) => (n >= 0 ? "+" : "−") + Math.abs(n).toFixed(1);

/** Attempts saved in this browser (offline play, or before the server answered). */
function deviceAttempts(): ProgressAttempt[] {
  return loadAttempts().map((a) => ({
    id: a.id,
    missionSlug: a.slug,
    classroomId: a.classroomId ?? null,
    at: a.at,
    score: a.result.score.total,
    breakdown: a.result.score,
    constraints: a.constraints,
    engineVersion: a.result.engineVersion,
  }));
}

function fromServer(rows: MyAttempt[]): ProgressAttempt[] {
  return rows.map((a) => ({
    id: a.id,
    missionSlug: a.mission_slug,
    classroomId: a.classroom_id,
    at: a.created_at,
    score: Number(a.score_total),
    breakdown: a.score_breakdown,
    constraints: a.constraints
      ? {
          budgetM: Number(a.constraints.budgetM),
          massKg: Number(a.constraints.massKg),
        }
      : null,
    engineVersion: a.engine_version,
  }));
}

/**
 * MY PERFORMANCE: the player's own saved attempts. Live mode reads the server
 * copy (`myAttempts`); without a backend it reads this device's saved attempts.
 */
export function LeaderboardMine({ canLoad }: { canLoad: boolean }) {
  const [attempts, setAttempts] = useState<ProgressAttempt[] | null>(null);
  const [source, setSource] = useState<"server" | "device">("device");
  const [error, setError] = useState("");
  const [requested, setRequested] = useState(false);
  const useServer = backendAvailable && (canLoad || requested);

  const load = useCallback(async () => {
    try {
      const rows = await api<MyAttempt[]>("myAttempts");
      setAttempts(fromServer(rows));
      setSource("server");
      setError("");
    } catch (e) {
      setAttempts(deviceAttempts());
      setSource("device");
      setError(
        e instanceof Error ? e.message : "Could not load your saved scores.",
      );
    }
  }, []);

  useEffect(() => {
    let active = true;
    if (!useServer) {
      Promise.resolve().then(() => {
        if (!active) return;
        setAttempts(deviceAttempts());
        setSource("device");
      });
      return () => {
        active = false;
      };
    }
    void Promise.resolve().then(() => {
      if (active) void load();
    });
    const changed = () => void load();
    if (isMockMode) window.addEventListener(demoUpdateEvent, changed);
    return () => {
      active = false;
      window.removeEventListener(demoUpdateEvent, changed);
    };
  }, [useServer, load]);

  const progress = useMemo(
    () =>
      attempts
        ? buildProgress(
            attempts,
            (slug) => getMission(slug)?.defaultConstraints,
            missionName,
          )
        : null,
    [attempts],
  );

  if (!progress) return <p aria-live="polite">Loading your attempts…</p>;

  return (
    <div>
      <h2 className="mt-0">My performance</h2>
      <p className="muted">
        {source === "server"
          ? "Your latest 300 server-scored attempts. Only you can see this tab."
          : "The latest 50 attempts saved on this device. Only you can see this tab."}{" "}
        Progress is compared only between attempts on the same mission, exact
        budget/mass limits, difficulty and simulator version. Totals, best
        scores and progress below cover this saved-attempt window.
      </p>
      {error && (
        <p className="error" role="alert">
          {error} Showing attempts saved on this device instead.
        </p>
      )}
      {backendAvailable && !useServer && (
        <p>
          <button
            type="button"
            className="btn-pop btn-pop--sm"
            onClick={() => setRequested(true)}
          >
            Load my saved scores
          </button>
        </p>
      )}
      {!progress.totalAttempts ? (
        <section className="panel">
          <h3 className="mt-0">No missions yet</h3>
          <p>
            Every mission you finish shows up here with your best score, your
            latest score and a chart of how you improve. Pick a city and launch
            your first satellite!
          </p>
          <Link className="primary" href="/map">
            Choose a mission ↗
          </Link>
        </section>
      ) : (
        <>
          <dl
            className="grid gap-4"
            style={{
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            }}
          >
            <div className="stat">
              <dt>Missions completed</dt>
              <dd className="m-0">
                <strong>{progress.missionsCompleted}</strong>
              </dd>
            </div>
            <div className="stat">
              <dt>Total attempts</dt>
              <dd className="m-0">
                <strong>{progress.totalAttempts}</strong>
              </dd>
            </div>
          </dl>
          <div className="table-scroll">
            <table>
              <caption>Your missions · most recently played first</caption>
              <thead>
                <tr>
                  <th scope="col">Mission</th>
                  <th scope="col">Attempts</th>
                  <th scope="col">Best score</th>
                  <th scope="col">Most recent score</th>
                  <th scope="col">Last played</th>
                </tr>
              </thead>
              <tbody>
                {progress.missions.map((m) => (
                  <tr key={m.missionSlug}>
                    <th scope="row">{missionName(m.missionSlug)}</th>
                    <td>{m.attempts}</td>
                    <td>{m.best.toFixed(1)}</td>
                    <td>{m.latest.toFixed(1)}</td>
                    <td>{new Date(m.latestAt).toLocaleDateString("en-US")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {progress.missions.flatMap((m) =>
            m.groups.map((g) => {
              const last = g.points[g.points.length - 1];
              const title = `${missionName(m.missionSlug)} · ${difficultyLabels[g.difficulty]} · ${conditionsLabel(g.constraints)} · simulator ${g.engineVersion}`;
              return (
                <section
                  key={g.key}
                  className="panel mt-4"
                  aria-label={`Progress: ${title}`}
                >
                  <h3 className="mt-0">{title}</h3>
                  <p className="font-display">{g.summary}</p>
                  <ul>
                    <li>
                      Attempts: {g.points.length} · Best {g.best.toFixed(1)} ·
                      Most recent {g.latest.toFixed(1)}
                    </li>
                    {last.delta !== null && (
                      <li>
                        Latest change: {fmt(last.delta)} points
                        {last.changes.length
                          ? ` (${last.changes
                              .slice(0, 3)
                              .map(
                                (c) =>
                                  `${scoreComponentLabels[c.component]} ${fmt(c.delta)}`,
                              )
                              .join(", ")})`
                          : ""}
                      </li>
                    )}
                  </ul>
                  <LeaderboardProgressChart
                    group={g}
                    title={`Score per attempt: ${title}`}
                  />
                </section>
              );
            }),
          )}
        </>
      )}
    </div>
  );
}
