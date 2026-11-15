"use client";
import { useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { backendAvailable, isMockMode } from "@/components/results/cloud";
import { playableMissions } from "@/components/results/missions";
import { loadAttempts } from "@/components/results/session";
import { isDifficulty, type Difficulty } from "@/lib/leaderboard/difficulty";
import { usePlayerName } from "./player-name";
import { LeaderboardMine } from "./LeaderboardMine";
import { LeaderboardClass } from "./LeaderboardClass";
import { LeaderboardGlobal } from "./LeaderboardGlobal";

export const leaderboardTabs = ["me", "class", "global"] as const;
export type LeaderboardTab = (typeof leaderboardTabs)[number];
const tabLabels: Record<LeaderboardTab, string> = {
  me: "My performance",
  class: "Class",
  global: "Global",
};
const tabIcons: Record<LeaderboardTab, string> = {
  me: "📈",
  class: "🎒",
  global: "🌍",
};

export function isLeaderboardTab(value: unknown): value is LeaderboardTab {
  return leaderboardTabs.includes(value as LeaderboardTab);
}

/**
 * Tab shown without `?tab=`: a class link opens the class tab, players with
 * saved attempts start on their own progress, everyone else on global.
 */
export function defaultLeaderboardTab(
  hasAttempts: boolean,
  classroomId?: string,
): LeaderboardTab {
  if (classroomId) return "class";
  return hasAttempts ? "me" : "global";
}

const noop = () => () => {};

type Filters = {
  mission: string;
  conditions: { budgetM: number; massKg: number } | null;
  difficulty: Difficulty;
  classroom: string | null;
  classMission: string | null;
  classDifficulty: Difficulty | null;
};

/**
 * Leaderboards with three distinct categories: the player's own progress,
 * their class, and the global board. Completed missions are posted
 * automatically from the results screen, so there is no publish form.
 */
export function LeaderboardView({
  initialTab,
  initialMission,
  initialDifficulty,
  initialConditions,
  classroomId,
}: {
  initialTab?: string;
  initialMission?: string;
  initialDifficulty?: string;
  initialConditions?: { budgetM: number; massKg: number };
  classroomId?: string;
}) {
  const name = usePlayerName();
  // null during the server render; the device's saved attempts pick the tab.
  const hasAttempts = useSyncExternalStore(
    noop,
    () => loadAttempts().length > 0,
    () => null,
  );
  const [chosenTab, setChosenTab] = useState<LeaderboardTab | null>(
    isLeaderboardTab(initialTab) ? initialTab : null,
  );
  const [filters, setFilters] = useState<Filters>({
    mission: playableMissions.some((m) => m.slug === initialMission)
      ? initialMission!
      : "los-angeles",
    conditions: initialConditions ?? null,
    difficulty: isDifficulty(initialDifficulty)
      ? initialDifficulty
      : "standard",
    classroom: classroomId ?? null,
    classMission: null,
    classDifficulty: null,
  });
  const [activated, setActivated] = useState(false);
  const tabRefs = useRef<Record<LeaderboardTab, HTMLButtonElement | null>>({
    me: null,
    class: null,
    global: null,
  });

  const tab =
    chosenTab ??
    (hasAttempts === null
      ? null
      : defaultLeaderboardTab(hasAttempts, classroomId));
  // Live mode signs in anonymously to read rankings; only do that unprompted
  // for players who already chose a pilot name or followed a class link.
  const canLoad = isMockMode || !!name || !!classroomId || activated;

  function syncUrl(nextTab: LeaderboardTab, next: Filters) {
    const q = new URLSearchParams({ tab: nextTab });
    if (nextTab === "global") {
      q.set("mission", next.mission);
      q.set("difficulty", next.difficulty);
      if (next.conditions) {
        q.set("budget", String(next.conditions.budgetM));
        q.set("mass", String(next.conditions.massKg));
      }
    }
    if (nextTab === "class" && next.classroom)
      q.set("classroom", next.classroom);
    // Native history updates keep Next's router in sync without a server round trip.
    window.history.replaceState(null, "", "/leaderboard?" + q.toString());
  }

  function select(next: LeaderboardTab, focus = false) {
    setChosenTab(next);
    setActivated(true);
    syncUrl(next, filters);
    if (focus) tabRefs.current[next]?.focus();
  }

  function filter(patch: Partial<Filters>) {
    const next = { ...filters, ...patch };
    if (
      (patch.mission && patch.mission !== filters.mission) ||
      (patch.difficulty && patch.difficulty !== filters.difficulty)
    )
      next.conditions = null;
    setFilters(next);
    if (tab) syncUrl(tab, next);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!tab) return;
    const i = leaderboardTabs.indexOf(tab);
    const last = leaderboardTabs.length - 1;
    const target =
      e.key === "ArrowRight"
        ? leaderboardTabs[i === last ? 0 : i + 1]
        : e.key === "ArrowLeft"
          ? leaderboardTabs[i === 0 ? last : i - 1]
          : e.key === "Home"
            ? leaderboardTabs[0]
            : e.key === "End"
              ? leaderboardTabs[last]
              : null;
    if (!target) return;
    e.preventDefault();
    select(target, true);
  }

  return (
    <main id="main-content" tabIndex={-1}>
      <div className="eyebrow">LEADERBOARDS</div>
      <h1>
        Better designs.
        <br />
        <em>Shared discoveries.</em>
      </h1>
      <p>
        Scores are simulated by the server. Rankings only compare the same
        mission, exact budget/mass limits, difficulty and simulator version.
      </p>
      {!backendAvailable && (
        <p className="notice">
          Class and global rankings need the live service, which is not
          configured in this environment. Your own progress below uses attempts
          saved on this device.
        </p>
      )}
      <div
        role="tablist"
        aria-label="Leaderboard categories"
        className="mb-4 flex flex-wrap gap-2"
        onKeyDown={onKeyDown}
      >
        {leaderboardTabs.map((t) => {
          const selected = t === tab;
          return (
            <button
              key={t}
              ref={(el) => {
                tabRefs.current[t] = el;
              }}
              type="button"
              role="tab"
              id={`leaderboard-tab-${t}`}
              aria-selected={selected}
              aria-controls={`leaderboard-panel-${t}`}
              tabIndex={selected || (!tab && t === "global") ? 0 : -1}
              className={
                "btn-pop btn-pop--sm" + (selected ? "" : " btn-pop--ghost")
              }
              onClick={() => select(t)}
            >
              <span aria-hidden="true">{tabIcons[t]}</span> {tabLabels[t]}
            </button>
          );
        })}
      </div>
      {leaderboardTabs.map((t) => (
        <section
          key={t}
          role="tabpanel"
          id={`leaderboard-panel-${t}`}
          aria-labelledby={`leaderboard-tab-${t}`}
          hidden={t !== tab}
          className="panel"
        >
          {t !== tab ? null : t === "me" ? (
            <LeaderboardMine canLoad={canLoad} />
          ) : !backendAvailable ? (
            <>
              <h2 className="mt-0">{tabLabels[t]} leaderboard unavailable</h2>
              <p>
                Rankings need the live service. Solo missions remain playable
                and saved on this device.
              </p>
              <Link className="primary" href="/map">
                Explore solo missions ↗
              </Link>
            </>
          ) : t === "class" ? (
            <LeaderboardClass
              classroomId={filters.classroom ?? undefined}
              mission={filters.classMission}
              difficulty={filters.classDifficulty}
              onFilter={filter}
              canLoad={canLoad}
            />
          ) : (
            <LeaderboardGlobal
              mission={filters.mission}
              difficulty={filters.difficulty}
              conditions={filters.conditions}
              onFilter={filter}
              canLoad={canLoad}
              name={name}
            />
          )}
        </section>
      ))}
      {!tab && <p aria-live="polite">Loading leaderboards…</p>}
    </main>
  );
}
