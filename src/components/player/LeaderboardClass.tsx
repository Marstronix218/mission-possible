"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, isMockMode } from "@/components/results/cloud";
import { demoUpdateEvent } from "@/components/results/mock-storage";
import { getMission } from "@/components/results/missions";
import { JoinClassForm } from "@/components/results/ClassroomUI";
import type { MyClass, Ranking } from "@/components/results/contracts";
import {
  defaultRankingDifficulty,
  difficulties,
  difficultyLabels,
  type Difficulty,
} from "@/lib/leaderboard/difficulty";
import { LeaderboardTable } from "./LeaderboardTable";
import { myRankLine } from "./LeaderboardGlobal";

const city = (slug: string) => getMission(slug)?.city ?? slug;
/** A class always ranks under its own locked budget/mass conditions. */
export function classDifficulty(
  c: Pick<MyClass, "mission_slug" | "budget_m" | "mass_kg">,
): Difficulty {
  const mission = getMission(c.mission_slug);
  return mission
    ? defaultRankingDifficulty(mission.defaultConstraints, c)
    : "custom";
}

/**
 * CLASS leaderboard: join with a teacher's code, then compare with classmates
 * by class nickname. Only that class's attempts count, under its conditions.
 */
export function LeaderboardClass({
  classroomId,
  mission,
  difficulty,
  onFilter,
  canLoad,
}: {
  classroomId?: string;
  mission: string | null;
  difficulty: Difficulty | null;
  onFilter: (next: {
    classroom?: string | null;
    classMission?: string | null;
    classDifficulty?: Difficulty | null;
  }) => void;
  canLoad: boolean;
}) {
  const [classes, setClasses] = useState<MyClass[] | null>(null);
  const [ranking, setRanking] = useState<{
    key: string;
    rows?: Ranking[];
    error?: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [requested, setRequested] = useState(false);
  const ready = canLoad || requested;

  const loadClasses = useCallback(async () => {
    try {
      setClasses(await api<MyClass[]>("myClasses"));
      setError("");
    } catch (e) {
      setClasses([]);
      setError(e instanceof Error ? e.message : "Could not load your classes.");
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void loadClasses();
    });
    const changed = () => void loadClasses();
    if (isMockMode) window.addEventListener(demoUpdateEvent, changed);
    return () => {
      active = false;
      window.removeEventListener(demoUpdateEvent, changed);
    };
  }, [ready, loadClasses]);

  const visible = useMemo(
    () =>
      (classes ?? []).filter(
        (c) =>
          (!mission || c.mission_slug === mission) &&
          (!difficulty || classDifficulty(c) === difficulty),
      ),
    [classes, mission, difficulty],
  );
  const selected = visible.find((c) => c.id === classroomId) ?? visible[0];
  const missing =
    !!classroomId && !!classes && !classes.some((c) => c.id === classroomId);

  const selectedId = selected?.id;
  const selectedSlug = selected?.mission_slug;
  const rankKey = `${selectedId ?? ""}|${selectedSlug ?? ""}`;
  const rows = ranking?.key === rankKey ? (ranking.rows ?? null) : null;
  const rankingError = ranking?.key === rankKey ? ranking.error : "";
  useEffect(() => {
    if (!selectedId || !selectedSlug) return;
    let active = true;
    let generation = 0;
    const load = async () => {
      const request = ++generation;
      try {
        const rows = await api<Ranking[]>("ranking", {
          missionSlug: selectedSlug,
          classroomId: selectedId,
        });
        if (active && request === generation)
          setRanking({ key: rankKey, rows });
      } catch (e) {
        if (active && request === generation)
          setRanking({
            key: rankKey,
            error:
              e instanceof Error ? e.message : "Could not load class ranking.",
          });
      }
    };
    void load();
    const changed = () => void load();
    if (isMockMode) window.addEventListener(demoUpdateEvent, changed);
    return () => {
      active = false;
      window.removeEventListener(demoUpdateEvent, changed);
    };
  }, [selectedId, selectedSlug, rankKey]);

  const missions = [...new Set((classes ?? []).map((c) => c.mission_slug))];
  const rankLine = rows ? myRankLine(rows) : null;

  return (
    <div>
      <div className="section-heading">
        <h2 className="mt-0">Class leaderboard</h2>
        <span className="chip">🎒 CLASS · classmates only</span>
      </div>
      <p className="muted">
        Your teacher shares a class code. Classmates appear by class nickname
        only, never by real name. Only attempts made in the class count, under
        the class budget and mass limits.
      </p>

      {!ready ? (
        <button
          type="button"
          className="primary"
          onClick={() => setRequested(true)}
        >
          Load my classes
        </button>
      ) : classes === null ? (
        <p aria-live="polite">Loading your classes…</p>
      ) : (
        <>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {classes.length > 0 && (
            <>
              <h3>My classes</h3>
              <div className="flex flex-wrap gap-4">
                <label className="field">
                  Mission
                  <select
                    value={mission ?? ""}
                    onChange={(e) =>
                      onFilter({ classMission: e.target.value || null })
                    }
                  >
                    <option value="">All my class missions</option>
                    {missions.map((slug) => (
                      <option key={slug} value={slug}>
                        {city(slug)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Difficulty
                  <select
                    value={difficulty ?? ""}
                    onChange={(e) =>
                      onFilter({
                        classDifficulty: (e.target.value ||
                          null) as Difficulty | null,
                      })
                    }
                  >
                    <option value="">Any difficulty</option>
                    {difficulties.map((d) => (
                      <option key={d} value={d}>
                        {difficultyLabels[d]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {visible.length ? (
                <ul className="m-0 grid list-none gap-3 p-0">
                  {visible.map((c) => {
                    const current = c.id === selected?.id;
                    return (
                      <li
                        key={c.id}
                        className="panel"
                        style={
                          current
                            ? { outline: "2px solid var(--pop-yellow)" }
                            : undefined
                        }
                      >
                        <strong className="font-display">{c.name}</strong>
                        {current && <span className="ml-2">(showing)</span>}
                        <br />
                        {city(c.mission_slug)} ·{" "}
                        {difficultyLabels[classDifficulty(c)]} · Budget $
                        {c.budget_m}M · Mass {c.mass_kg} kg
                        {c.is_active ? "" : " · Archived"}
                        <br />
                        {c.role === "teacher"
                          ? `You teach this class${c.join_code ? ` · Join code ${c.join_code}` : ""}`
                          : `Your class nickname: ${c.nickname ?? "—"}`}
                        <div className="actions mt-2">
                          {!current && (
                            <button
                              type="button"
                              className="btn-pop btn-pop--sm"
                              onClick={() => onFilter({ classroom: c.id })}
                            >
                              Show ranking
                            </button>
                          )}
                          <Link href={"/classroom/" + c.id}>
                            Open class mission ↗
                          </Link>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p role="status">
                  None of your classes match this mission and difficulty.
                </p>
              )}
            </>
          )}

          {rankingError && (
            <p className="error" role="alert">
              {rankingError}
            </p>
          )}
          {selected && (
            <section className="mt-4" aria-labelledby="class-ranking-heading">
              <h3 id="class-ranking-heading">{selected.name} ranking</h3>
              {rankLine && <p className="font-display text-lg">{rankLine}</p>}
              {rows ? (
                <LeaderboardTable
                  rows={rows}
                  mission={city(selected.mission_slug)}
                  difficulty={difficultyLabels[classDifficulty(selected)]}
                  caption={`Class · ${selected.name} · ${city(selected.mission_slug)} · best simulated score per classmate`}
                  emptyText="No class attempts yet. Be the first to launch the class mission!"
                />
              ) : (
                <p aria-live="polite">Loading class ranking…</p>
              )}
            </section>
          )}
          {missing && (
            <p role="status">
              The class in this link is not in your list. Join it with its code
              below.
            </p>
          )}

          <h3>Join a class</h3>
          <JoinClassForm
            onJoined={(c) => {
              onFilter({
                classroom: c.id,
                classMission: null,
                classDifficulty: null,
              });
              void loadClasses();
            }}
          />
          <p>
            Teacher? <Link href="/teacher">Create a class ↗</Link> and share its
            join code with your students.
          </p>
        </>
      )}
    </div>
  );
}
