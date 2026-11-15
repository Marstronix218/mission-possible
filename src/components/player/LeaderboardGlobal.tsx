"use client";
import { useCallback, useEffect, useState } from "react";
import { api, isMockMode } from "@/components/results/cloud";
import { demoUpdateEvent } from "@/components/results/mock-storage";
import { getMission, playableMissions } from "@/components/results/missions";
import type { Constraints } from "@/types/game";
import type { Ranking } from "@/components/results/contracts";
import {
  conditionsKey,
  conditionsLabel,
  difficultyOf,
  sameConditions,
  difficulties,
  difficultyDescriptions,
  difficultyLabels,
  type Difficulty,
} from "@/lib/leaderboard/difficulty";
import { LeaderboardTable } from "./LeaderboardTable";

/** "#7 of 12" for the player's row; ranks beyond the list say so explicitly. */
export function myRankLine(rows: Ranking[]) {
  const mine = rows.find((r) => r.mine);
  if (!mine) return null;
  const players = mine.players ?? rows.length;
  const outside = rows.filter((r) => !r.mine).length < mine.entry_id - 1;
  return `★ Your rank: #${mine.entry_id} of ${players} with ${mine.score.toFixed(1)} points${outside ? " (shown below the top list)" : ""}.`;
}

/**
 * GLOBAL leaderboard: one mission × one difficulty tier × the current
 * simulator version at a time, so different conditions are never mixed.
 */
export function LeaderboardGlobal({
  mission,
  difficulty,
  conditions,
  onFilter,
  canLoad,
  name,
}: {
  mission: string;
  difficulty: Difficulty;
  conditions: Constraints | null;
  onFilter: (next: {
    mission?: string;
    difficulty?: Difficulty;
    conditions?: Constraints | null;
  }) => void;
  canLoad: boolean;
  name: string | null | undefined;
}) {
  const [scopeState, setScopeState] = useState<{
    key: string;
    scopes: Constraints[];
    error?: string;
  } | null>(null);
  const [resultState, setResultState] = useState<{
    key: string;
    rows?: Ranking[];
    error?: string;
  } | null>(null);
  const [round, setRound] = useState(0);
  const [requested, setRequested] = useState(false);
  const ready = canLoad || requested;
  const filterKey = `${mission}|${difficulty}`;
  const scopes = scopeState?.key === filterKey ? scopeState.scopes : [];
  const selected =
    scopes.find((c) => conditions && sameConditions(c, conditions)) ??
    scopes.find((c) =>
      sameConditions(c, getMission(mission)!.defaultConstraints),
    ) ??
    scopes[0];
  const rankKey = selected ? `${filterKey}|${conditionsKey(selected)}` : "";
  const rows =
    resultState?.key === rankKey
      ? (resultState.rows ?? null)
      : scopeState?.key === filterKey && !scopeState.error && !scopes.length
        ? []
        : null;
  const error =
    (scopeState?.key === filterKey ? scopeState.error : "") ||
    (resultState?.key === rankKey ? resultState.error : "") ||
    "";
  const load = useCallback(() => setRound((n) => n + 1), []);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    void api<Constraints[]>("rankingConditions", {
      missionSlug: mission,
      difficulty,
    })
      .then((available) => {
        if (!active) return;
        const defaults = getMission(mission)!.defaultConstraints;
        const list = [...available];
        if (
          difficultyOf(defaults, defaults) === difficulty &&
          !list.some((c) => sameConditions(c, defaults))
        )
          list.unshift(defaults);
        setScopeState({ key: filterKey, scopes: list });
      })
      .catch((e) => {
        if (active)
          setScopeState({
            key: filterKey,
            scopes: [],
            error:
              e instanceof Error
                ? e.message
                : "Could not load ranking conditions.",
          });
      });
    return () => {
      active = false;
    };
  }, [ready, mission, difficulty, filterKey, round]);

  const budgetM = selected?.budgetM;
  const massKg = selected?.massKg;
  useEffect(() => {
    if (!ready || budgetM === undefined || massKg === undefined) return;
    let active = true;
    void api<Ranking[]>("ranking", {
      missionSlug: mission,
      difficulty,
      constraints: { budgetM, massKg },
    })
      .then((rows) => {
        if (active) setResultState({ key: rankKey, rows });
      })
      .catch((e) => {
        if (active)
          setResultState({
            key: rankKey,
            error: e instanceof Error ? e.message : "Could not load ranking.",
          });
      });
    return () => {
      active = false;
    };
  }, [ready, mission, difficulty, budgetM, massKg, rankKey, round]);

  useEffect(() => {
    if (!isMockMode) return;
    window.addEventListener(demoUpdateEvent, load);
    return () => window.removeEventListener(demoUpdateEvent, load);
  }, [load]);

  const city = getMission(mission)?.city ?? mission;
  const label = difficultyLabels[difficulty];
  const rankLine = rows ? myRankLine(rows) : null;
  return (
    <div>
      <div className="section-heading">
        <h2 className="mt-0">Global leaderboard</h2>
        <span className="chip chip--solid">🌍 GLOBAL · all pilots</span>
      </div>
      <p className="muted">
        Every pilot with a public pilot name, from solo and class missions. Each
        mission, difficulty and exact budget/mass limits are ranked separately
        on the current simulator version. This is not your class ranking.
      </p>
      <div className="flex flex-wrap gap-4">
        <label className="field">
          Mission
          <select
            value={mission}
            onChange={(e) => onFilter({ mission: e.target.value })}
          >
            {playableMissions.map((m) => (
              <option key={m.slug} value={m.slug}>
                {m.city} · {m.category}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Difficulty
          <select
            value={difficulty}
            onChange={(e) =>
              onFilter({ difficulty: e.target.value as Difficulty })
            }
            aria-describedby="global-difficulty-help"
          >
            {difficulties.map((d) => (
              <option key={d} value={d}>
                {difficultyLabels[d]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Engineering limits
          <select
            value={selected ? conditionsKey(selected) : ""}
            disabled={!scopes.length}
            onChange={(e) =>
              onFilter({
                conditions:
                  scopes.find((c) => conditionsKey(c) === e.target.value) ??
                  null,
              })
            }
          >
            {!scopes.length && (
              <option value="">No public scores in this tier yet</option>
            )}
            {scopes.map((c) => (
              <option key={conditionsKey(c)} value={conditionsKey(c)}>
                {conditionsLabel(c)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p id="global-difficulty-help" className="muted text-sm">
        {label}: {difficultyDescriptions[difficulty]} Solo missions always use
        Standard conditions.
      </p>
      <p className="muted text-sm">
        {name
          ? `Your completed missions are posted automatically as “${name}”. Change your pilot name from the header.`
          : "Finish a mission to join the leaderboard. You will choose a pilot name before your first mission."}
      </p>
      {!ready && (
        <button
          type="button"
          className="primary"
          onClick={() => setRequested(true)}
        >
          Load global ranking
        </button>
      )}
      {error && (
        <p className="error" role="alert">
          {error}{" "}
          <button type="button" className="btn-pop btn-pop--sm" onClick={load}>
            ↻ Try again
          </button>
        </p>
      )}
      {rankLine && <p className="font-display text-lg">{rankLine}</p>}
      {rows ? (
        <LeaderboardTable
          rows={rows}
          mission={city}
          difficulty={label}
          caption={`Global · ${city} · ${label}${selected ? ` · ${conditionsLabel(selected)}` : ""} · best simulated score per pilot · ties go to the earliest`}
          emptyText={`No ${label} entries for ${city} yet. Finish this mission to set the first score.`}
        />
      ) : (
        ready && !error && <p aria-live="polite">Loading ranking…</p>
      )}
    </div>
  );
}
