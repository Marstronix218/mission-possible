"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, backendAvailable, isMockMode } from "@/components/results/cloud";
import { demoUpdateEvent } from "@/components/results/mock-storage";
import { playableMissions } from "@/components/results/missions";
import type { Ranking } from "@/components/results/contracts";
import { usePlayerName } from "./player-name";
import { LeaderboardTable } from "./LeaderboardTable";

/**
 * Mission leaderboard. Completed missions are posted automatically from the
 * results screen under the player's pilot name, so there is no publish form.
 */
export function LeaderboardView({
  initialMission = "los-angeles",
  classroomId,
}: {
  initialMission?: string;
  classroomId?: string;
}) {
  const name = usePlayerName();
  const [slug, setSlug] = useState(
    playableMissions.some((m) => m.slug === initialMission)
      ? initialMission
      : "los-angeles",
  );
  const [rows, setRows] = useState<Ranking[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Live mode signs in anonymously to read rankings; only do that unprompted
  // for players who have already chosen a pilot name.
  const autoLoad = backendAvailable && (isMockMode || !!name || !!classroomId);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRows(
        await api<Ranking[]>("ranking", { missionSlug: slug, classroomId }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load ranking.");
    } finally {
      setLoading(false);
    }
  }, [slug, classroomId]);

  useEffect(() => {
    if (!autoLoad) return;
    let active = true;
    api<Ranking[]>("ranking", { missionSlug: slug, classroomId })
      .then((data) => {
        if (active) {
          setRows(data);
          setError("");
        }
      })
      .catch((e: unknown) => {
        if (active)
          setError(e instanceof Error ? e.message : "Could not load ranking.");
      });
    const changed = () => void load();
    if (isMockMode) window.addEventListener(demoUpdateEvent, changed);
    return () => {
      active = false;
      window.removeEventListener(demoUpdateEvent, changed);
    };
  }, [autoLoad, slug, classroomId, load]);

  return (
    <main id="main-content" tabIndex={-1}>
      <div className="eyebrow">
        {classroomId ? "CLASSROOM" : "GLOBAL"} / LEADERBOARD
      </div>
      <h1>
        Better designs.
        <br />
        <em>Shared discoveries.</em>
      </h1>
      <p>
        Scores are simulated by the server for each mission and engine version.
        Custom class conditions stay in their class ranking.
      </p>
      {!backendAvailable ? (
        <section className="panel">
          <h2>Leaderboard unavailable</h2>
          <p>
            Rankings need the live service, which is not configured in this
            environment. Solo missions remain playable and saved on this device.
          </p>
          <Link className="primary" href="/map">
            Explore solo missions ↗
          </Link>
        </section>
      ) : (
        <section className="panel">
          <label className="field">
            Mission
            <select
              disabled={!!classroomId}
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setRows(null);
              }}
            >
              {playableMissions.map((m) => (
                <option key={m.slug} value={m.slug}>
                  {m.city} · {m.category}
                </option>
              ))}
            </select>
          </label>
          {!classroomId && (
            <p className="muted">
              {name
                ? `Your completed missions are posted automatically as “${name}”. Change your pilot name from the header.`
                : "Finish a mission to join the leaderboard. You will choose a pilot name before your first mission."}
            </p>
          )}
          {!autoLoad && (
            <button className="primary" disabled={loading} onClick={load}>
              {loading ? "Loading…" : "Load ranking"}
            </button>
          )}
          {error && (
            <p className="error" role="alert">
              {error}{" "}
              <button
                type="button"
                className="btn-pop btn-pop--sm"
                onClick={load}
              >
                ↻ Try again
              </button>
            </p>
          )}
          {rows ? (
            <LeaderboardTable rows={rows} />
          ) : (
            !error && autoLoad && <p aria-live="polite">Loading ranking…</p>
          )}
        </section>
      )}
    </main>
  );
}
