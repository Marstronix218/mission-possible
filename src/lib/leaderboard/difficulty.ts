import type { Constraints } from "@/types/game";

/**
 * Difficulty tiers for leaderboards. The game has no difficulty setting, so a
 * tier is derived from the real conditions of an attempt: its budget and mass
 * limits compared with the mission's `defaultConstraints` (data/missions).
 *
 * Each limit becomes a percentage of its default (100 = default):
 * - standard: both limits within 95–105 %.
 * - tight:    at least one limit below 90 % and neither above 105 %.
 * - relaxed:  at least one limit at or above 115 % and neither below 95 %.
 * - custom:   anything else (one limit tighter and the other looser, or a
 *             change too small to be tight/relaxed but outside standard).
 *
 * Comparisons multiply instead of divide (`value * 100 < default * 90`) so the
 * result matches `public.mission_difficulty` in
 * supabase/migrations/20261115000000_leaderboard_difficulty.sql exactly.
 * Keep the two in sync.
 */
export const difficulties = ["standard", "relaxed", "tight", "custom"] as const;
export type Difficulty = (typeof difficulties)[number];

export const difficultyLabels: Record<Difficulty, string> = {
  standard: "Standard",
  relaxed: "Relaxed",
  tight: "Tight",
  custom: "Custom",
};

export const difficultyDescriptions: Record<Difficulty, string> = {
  standard: "Mission default budget and mass (within 5%).",
  relaxed:
    "At least one limit 15% or more above the default; neither more than 5% below it.",
  tight:
    "At least one limit more than 10% below the default; neither more than 5% above it.",
  custom: "Other class conditions, such as a lower budget with a higher mass.",
};

/** Percent bands; see the module comment. */
export const difficultyThresholds = {
  standardLow: 95,
  standardHigh: 105,
  tightBelow: 90,
  relaxedAtLeast: 115,
} as const;

export function difficultyOf(
  constraints: Constraints | null | undefined,
  defaults: Constraints,
): Difficulty {
  // Attempts saved before constraints were stored always used the defaults.
  const c = constraints ?? defaults;
  const { standardLow, standardHigh, tightBelow, relaxedAtLeast } =
    difficultyThresholds;
  // JSON sends the number's decimal string to Postgres numeric. Preserve that
  // exact decimal (including exponent notation) rather than rounding a tier edge.
  const decimal = (value: number): [bigint, bigint] => {
    const [coefficient, exponent = "0"] = String(value)
      .toLowerCase()
      .split("e");
    const fraction = coefficient.split(".")[1]?.length ?? 0;
    const scale = fraction - Number(exponent);
    const digits = BigInt(coefficient.replace(".", ""));
    return scale >= 0
      ? [digits, 10n ** BigInt(scale)]
      : [digits * 10n ** BigInt(-scale), 1n];
  };
  const pairs = [
    [c.budgetM, defaults.budgetM],
    [c.massKg, defaults.massKg],
  ].map(([value, base]) => {
    const [v, vs] = decimal(value);
    const [d, ds] = decimal(base);
    return [v * ds, d * vs] as const;
  });
  const all = (test: (v: bigint, d: bigint) => boolean) =>
    pairs.every(([v, d]) => test(v, d));
  const any = (test: (v: bigint, d: bigint) => boolean) =>
    pairs.some(([v, d]) => test(v, d));
  if (
    all(
      (v, d) =>
        v * 100n >= d * BigInt(standardLow) &&
        v * 100n <= d * BigInt(standardHigh),
    )
  )
    return "standard";
  if (
    any((v, d) => v * 100n < d * BigInt(tightBelow)) &&
    all((v, d) => v * 100n <= d * BigInt(standardHigh))
  )
    return "tight";
  if (
    any((v, d) => v * 100n >= d * BigInt(relaxedAtLeast)) &&
    all((v, d) => v * 100n >= d * BigInt(standardLow))
  )
    return "relaxed";
  return "custom";
}

export function isDifficulty(value: unknown): value is Difficulty {
  return difficulties.includes(value as Difficulty);
}

/**
 * Tier a ranking shows when the caller does not pick one: a class ranks under
 * its own (locked) class conditions, the global board under standard ones.
 */
export function defaultRankingDifficulty(
  defaults: Constraints,
  classroom?: { budget_m: number; mass_kg: number } | null,
): Difficulty {
  return classroom
    ? difficultyOf(
        {
          budgetM: Number(classroom.budget_m),
          massKg: Number(classroom.mass_kg),
        },
        defaults,
      )
    : "standard";
}

/** Exact engineering conditions also partition every ranked comparison. */
export const conditionsKey = (c: Constraints) => `${c.budgetM}|${c.massKg}`;
export const conditionsLabel = (c: Constraints) =>
  `Budget $${c.budgetM}M · Mass ${c.massKg} kg`;
export const sameConditions = (a: Constraints, b: Constraints) =>
  a.budgetM === b.budgetM && a.massKg === b.massKg;
