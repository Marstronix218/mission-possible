import type { Constraints } from "@/types/game";
import { conditionsKey, difficultyOf, type Difficulty } from "./difficulty";

/** Score components shown in the results breakdown, in display order. */
export const scoreComponents = [
  "accuracy",
  "responseTime",
  "coverage",
  "costEfficiency",
  "reliability",
] as const;
export type ScoreComponent = (typeof scoreComponents)[number];
export const scoreComponentLabels: Record<ScoreComponent, string> = {
  accuracy: "Accuracy",
  responseTime: "Response time",
  coverage: "Coverage",
  costEfficiency: "Cost efficiency",
  reliability: "Reliability",
};

/** One of the player's own saved attempts, from the server or this device. */
export type ProgressAttempt = {
  id: string;
  missionSlug: string;
  classroomId: string | null;
  at: string;
  score: number;
  breakdown?: Partial<Record<string, number>> | null;
  constraints?: Constraints | null;
  engineVersion: string;
};

export type ComponentChange = { component: ScoreComponent; delta: number };

export type ProgressPoint = {
  /** 1-based attempt number within its group, oldest first. */
  n: number;
  id: string;
  at: string;
  score: number;
  /** Points versus the previous attempt in the same group; null for the first. */
  delta: number | null;
  /** Component changes versus the previous attempt, largest first. */
  changes: ComponentChange[];
  /** False when either attempt lacks a score breakdown to compare. */
  breakdown: boolean;
  best: boolean;
};

/** Attempts that are fair to compare: same mission, difficulty and engine. */
export type ProgressGroup = {
  key: string;
  missionSlug: string;
  difficulty: Difficulty;
  engineVersion: string;
  constraints: Constraints;
  points: ProgressPoint[];
  best: number;
  latest: number;
  first: number;
  summary: string;
};

export type MissionProgress = {
  missionSlug: string;
  attempts: number;
  best: number;
  latest: number;
  latestAt: string;
  groups: ProgressGroup[];
};

export type ProgressSummary = {
  missionsCompleted: number;
  totalAttempts: number;
  missions: MissionProgress[];
};

/** Changes smaller than this (points) are rounding noise, not a change. */
const noise = 0.05;
const fmt = (n: number) => (n >= 0 ? "+" : "−") + Math.abs(n).toFixed(1);

function componentChanges(
  prev: ProgressAttempt,
  next: ProgressAttempt,
): ComponentChange[] {
  if (!prev.breakdown || !next.breakdown) return [];
  return scoreComponents
    .flatMap((component) => {
      const a = prev.breakdown?.[component];
      const b = next.breakdown?.[component];
      if (typeof a !== "number" || typeof b !== "number") return [];
      const delta = Math.round((b - a) * 10) / 10;
      return Math.abs(delta) >= noise ? [{ component, delta }] : [];
    })
    .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
}

/** Plain-language "what improved" line computed only from the attempts. */
export function describeGroup(
  points: ProgressPoint[],
  missionName: string,
): string {
  if (!points.length) return "";
  if (points.length === 1)
    return `One ${missionName} attempt so far (${points[0].score.toFixed(1)} points). Launch again with one change to see what improves.`;
  const first = points[0].score;
  const best = Math.max(...points.map((p) => p.score));
  const last = points[points.length - 1];
  // Sum each component's change across all consecutive attempts.
  const totals = new Map<ScoreComponent, number>();
  for (const p of points)
    for (const c of p.changes)
      totals.set(c.component, (totals.get(c.component) ?? 0) + c.delta);
  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const gain = ranked.find(([, d]) => d >= noise);
  const drop = [...ranked].reverse().find(([, d]) => d <= -noise);
  const parts: string[] = [];
  if (best - first >= noise)
    parts.push(
      `Your best ${missionName} score rose from ${first.toFixed(1)} to ${best.toFixed(1)} (${fmt(best - first)} points) over ${points.length} attempts.`,
    );
  else
    parts.push(
      `Your first ${missionName} attempt (${first.toFixed(1)}) is still your best after ${points.length} attempts.`,
    );
  if (gain)
    parts.push(
      `Biggest gain: ${scoreComponentLabels[gain[0]]} ${fmt(gain[1])}.`,
    );
  if (last.delta !== null && last.delta <= -noise)
    parts.push(
      `Your latest attempt scored ${Math.abs(last.delta).toFixed(1)} points below the one before` +
        (drop ? `; ${scoreComponentLabels[drop[0]]} fell the most.` : "."),
    );
  return parts.join(" ");
}

/**
 * Personal progress for the "My performance" tab. Attempts are grouped by
 * mission, difficulty tier and engine version so every delta compares like
 * with like; `defaultsFor` supplies each mission's default constraints.
 */
export function buildProgress(
  attempts: ProgressAttempt[],
  defaultsFor: (slug: string) => Constraints | undefined,
  nameFor: (slug: string) => string = (slug) => slug,
): ProgressSummary {
  const sorted = [...attempts]
    .filter((a) => Number.isFinite(a.score) && defaultsFor(a.missionSlug))
    .sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  const bySlug = new Map<string, ProgressAttempt[]>();
  for (const a of sorted)
    bySlug.set(a.missionSlug, [...(bySlug.get(a.missionSlug) ?? []), a]);

  const missions: MissionProgress[] = [...bySlug.entries()].map(
    ([missionSlug, rows]) => {
      const defaults = defaultsFor(missionSlug)!;
      const groupRows = new Map<string, ProgressAttempt[]>();
      const meta = new Map<string, [Difficulty, string, Constraints]>();
      for (const a of rows) {
        const difficulty = difficultyOf(a.constraints, defaults);
        const constraints = a.constraints ?? defaults;
        const key = `${missionSlug}|${difficulty}|${a.engineVersion}|${conditionsKey(constraints)}`;
        groupRows.set(key, [...(groupRows.get(key) ?? []), a]);
        meta.set(key, [difficulty, a.engineVersion, constraints]);
      }
      const groups: ProgressGroup[] = [...groupRows.entries()].map(
        ([key, list]) => {
          const best = Math.max(...list.map((a) => a.score));
          const bestIndex = list.findIndex((a) => a.score === best);
          const points: ProgressPoint[] = list.map((a, i) => ({
            n: i + 1,
            id: a.id,
            at: a.at,
            score: a.score,
            delta:
              i === 0
                ? null
                : Math.round((a.score - list[i - 1].score) * 10) / 10,
            changes: i === 0 ? [] : componentChanges(list[i - 1], a),
            breakdown: !!a.breakdown && (i === 0 || !!list[i - 1].breakdown),
            best: i === bestIndex,
          }));
          const [difficulty, engineVersion, constraints] = meta.get(key)!;
          return {
            key,
            missionSlug,
            difficulty,
            engineVersion,
            constraints,
            points,
            best,
            first: list[0].score,
            latest: list[list.length - 1].score,
            summary: describeGroup(points, nameFor(missionSlug)),
          };
        },
      );
      // Most recently played scope first.
      groups.sort((a, b) =>
        b.points[b.points.length - 1].at.localeCompare(
          a.points[a.points.length - 1].at,
        ),
      );
      const last = rows[rows.length - 1];
      return {
        missionSlug,
        attempts: rows.length,
        best: Math.max(...rows.map((a) => a.score)),
        latest: last.score,
        latestAt: last.at,
        groups,
      };
    },
  );
  missions.sort((a, b) => b.latestAt.localeCompare(a.latestAt));
  return {
    missionsCompleted: missions.length,
    totalAttempts: sorted.length,
    missions,
  };
}
