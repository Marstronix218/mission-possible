// Replayability layer: stars, per-mission challenges and personal bests.
// Pure functions (plus a small localStorage wrapper at the bottom). Every
// target is derived from the mission's own numbers or the parts catalog, and
// every check reads a real engine result or resource summary.
import { z } from "zod";
import type { Mission, ResourceSummary, SimResult } from "@/types/game";
import { partsCatalog } from "@/lib/sim";

export type StarId = "success" | "score70" | "score90";

export interface StarCriterion {
  id: StarId;
  label: string;
  earned: boolean;
}

/** The same success-gated thresholds shown on the mission selector. */
export function missionStars(
  _mission: Mission,
  result: SimResult,
): StarCriterion[] {
  return [
    {
      id: "success",
      label: "Mission success (score 60+ and coverage 50%+)",
      earned: result.success,
    },
    {
      id: "score70",
      label: "Mission success and score 70 or more",
      earned: result.success && result.score.total >= 70,
    },
    {
      id: "score90",
      label: "Mission success and score 90 or more",
      earned: result.success && result.score.total >= 90,
    },
  ];
}

export const starCount = (stars: StarCriterion[]) =>
  stars.filter((s) => s.earned).length;

export type ChallengeId = "speed" | "budget" | "power";

export interface Challenge {
  id: ChallengeId;
  icon: string;
  label: string;
  /** The threshold in the challenge's unit (h, $M or W). */
  target: number;
  /** The attempt's own value, or null when nothing was delivered. */
  value: number | null;
  done: boolean;
}

const ceilTo = (value: number, step: number) => Math.ceil(value / step) * step;

/** The catalog instrument that best matches the hazard (ties: cheapest). */
function bestFitInstrument(mission: Mission) {
  return [...partsCatalog.instruments].sort(
    (a, b) =>
      (b.categoryFit[mission.category] ?? 0) -
        (a.categoryFit[mission.category] ?? 0) || a.costM - b.costM,
  )[0];
}

/** Cheapest possible build that still carries the best-matched sensor. */
function cheapestSensibleCostM(mission: Mission) {
  const min = (list: { costM: number }[]) =>
    Math.min(...list.map((p) => p.costM));
  return (
    partsCatalog.bus.costM +
    bestFitInstrument(mission).costM +
    min(partsCatalog.orbits) +
    min(partsCatalog.solar) +
    min(partsCatalog.batteries) +
    min(partsCatalog.communications) +
    min(partsCatalog.storage) +
    partsCatalog.groundStations["1"].costM
  );
}

/** Mission-specific challenge thresholds. Deterministic per mission. */
export function challengeTargets(
  mission: Mission,
): Record<ChallengeId, number> {
  const instrument = bestFitInstrument(mission);
  const midComm =
    partsCatalog.communications.find((c) => c.id === "x_band") ??
    partsCatalog.communications[0];
  const floor = cheapestSensibleCostM(mission);
  const budget = mission.defaultConstraints.budgetM;
  return {
    speed: Math.max(1, Math.round(mission.targetResponseHours / 2)),
    budget: Math.min(
      budget,
      ceilTo(floor + Math.max(0, budget - floor) * 0.35, 5),
    ),
    power: ceilTo(
      partsCatalog.bus.powerW + instrument.powerW + midComm.powerW,
      10,
    ),
  };
}

export function missionChallenges(
  mission: Mission,
  result: SimResult,
  resources: ResourceSummary,
): Challenge[] {
  const t = challengeTargets(mission);
  const delivered = result.firstDeliveryHours;
  return [
    {
      id: "speed",
      icon: "⚡",
      label: `Deliver data in ${t.speed} h or less`,
      target: t.speed,
      value: delivered,
      done: delivered !== null && delivered <= t.speed,
    },
    {
      id: "budget",
      icon: "💰",
      label: `Succeed for $${t.budget}M or less`,
      target: t.budget,
      value: resources.costM,
      done: result.success && resources.costM <= t.budget,
    },
    {
      id: "power",
      icon: "🔋",
      label: `Succeed with a build rated at ${t.power} W or less`,
      target: t.power,
      value: resources.powerUseW,
      done: result.success && resources.powerUseW <= t.power,
    },
  ];
}

// ── Local progress (personal bests) ─────────────────────────────────────

export const progressKey = "mission-possible:progress-v1";

const entrySchema = z.object({
  bestScore: z.number().finite(),
  bestAttemptId: z.string(),
  bestStars: z.number().int().min(0).max(3),
  bestDeliveryHours: z.number().finite().nullable(),
  challenges: z.array(z.enum(["speed", "budget", "power"])),
  seen: z.array(z.string()).max(200),
});
const progressSchema = z.record(z.string(), entrySchema);

export type ProgressEntry = z.infer<typeof entrySchema>;
export type ProgressBook = z.infer<typeof progressSchema>;

export const progressSlot = (slug: string, classroomId?: string) =>
  slug + ":" + (classroomId ?? "solo");

export function parseProgress(raw: string | null): ProgressBook {
  try {
    const parsed = progressSchema.safeParse(JSON.parse(raw ?? "{}"));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

export interface RecordOutcome {
  entry: ProgressEntry;
  /** First time this attempt was recorded. */
  firstView: boolean;
  /** This attempt beat the previous best score (only on first view). */
  newBest: boolean;
  /** Stars above the previous best (only on first view). */
  newStars: boolean;
  /** Challenges completed for the first time by this attempt. */
  newChallenges: ChallengeId[];
  /** Entry before this attempt was recorded (null if none). */
  before: ProgressEntry | null;
}

/** Pure: fold one attempt into the progress entry. Idempotent per attempt id. */
export function recordAttempt(
  previous: ProgressEntry | undefined,
  attempt: {
    id: string;
    score: number;
    stars: number;
    deliveryHours: number | null;
    challenges: ChallengeId[];
  },
): RecordOutcome {
  if (previous?.seen.includes(attempt.id))
    return {
      entry: previous,
      firstView: false,
      newBest: false,
      newStars: false,
      newChallenges: [],
      before: previous,
    };
  const before = previous ?? null;
  const bestDelivery =
    attempt.deliveryHours === null
      ? (before?.bestDeliveryHours ?? null)
      : before?.bestDeliveryHours == null
        ? attempt.deliveryHours
        : Math.min(before.bestDeliveryHours, attempt.deliveryHours);
  const newBest = !before || attempt.score > before.bestScore;
  const newChallenges = attempt.challenges.filter(
    (c) => !before?.challenges.includes(c),
  );
  const entry: ProgressEntry = {
    bestScore: newBest ? attempt.score : before!.bestScore,
    bestAttemptId: newBest ? attempt.id : before!.bestAttemptId,
    bestStars: Math.max(before?.bestStars ?? 0, attempt.stars),
    bestDeliveryHours: bestDelivery,
    challenges: [...(before?.challenges ?? []), ...newChallenges],
    seen: [...(before?.seen ?? []), attempt.id].slice(-200),
  };
  return {
    entry,
    firstView: true,
    newBest: newBest && !!before,
    newStars: attempt.stars > (before?.bestStars ?? 0),
    newChallenges,
    before,
  };
}

/** Browser wrapper. Returns null when storage is unavailable. */
export function recordProgress(
  slot: string,
  attempt: Parameters<typeof recordAttempt>[1],
): RecordOutcome | null {
  try {
    const book = parseProgress(localStorage.getItem(progressKey));
    const outcome = recordAttempt(book[slot], attempt);
    if (outcome.firstView)
      localStorage.setItem(
        progressKey,
        JSON.stringify({ ...book, [slot]: outcome.entry }),
      );
    return outcome;
  } catch {
    return null;
  }
}
