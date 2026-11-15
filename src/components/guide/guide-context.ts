// Context-aware guide hints. Pure and deterministic: every message is built
// from the design, the engine's resource summary (src/lib/sim summarizeResources)
// and the catalog, so each number in a hint can be traced to the parts chosen.
// One hint at a time, in priority order; null when there is nothing to say.
import { findPart, partsCatalog } from "@/lib/sim/catalog";
import {
  hazardWord,
  instrumentFit,
} from "@/components/planning/component-performance";
import type {
  Category,
  Constraints,
  ResourceSummary,
  SatelliteDesign,
  SimResult,
} from "@/types/game";

export type HintId =
  "mass" | "power" | "budget" | "comm" | "improved" | "storage" | "sensor-fit";

export interface GuideHint {
  id: HintId;
  tone: "fix" | "tip" | "celebrate";
  text: string;
}

export interface HintInput {
  design: SatelliteDesign;
  resources: ResourceSummary;
  constraints: Constraints;
  category: Category;
  previousDesign?: SatelliteDesign | null;
  previousResources?: ResourceSummary | null;
}

/** Below this category fit the engine treats a sensor as a weak match (engine.ts uses 0.5 the same way). */
export const WEAK_FIT = 0.5;

const fmt = (value: number) => String(Math.round(value * 10) / 10);
const pct = (value: number) => `${Math.round(value * 100)}%`;

interface Named {
  name: string;
  massKg: number;
  costM: number;
}

/** Every part the player chose (the supplied bus is fixed, so it is not listed). */
function chosenParts(design: SatelliteDesign): Named[] {
  const parts: (Named | undefined)[] = [
    ...design.instruments.map((id) => findPart(partsCatalog.instruments, id)),
    findPart(partsCatalog.orbits, design.orbit),
    findPart(partsCatalog.solar, design.solar),
    findPart(partsCatalog.batteries, design.battery),
    findPart(partsCatalog.communications, design.comm),
    findPart(partsCatalog.storage, design.storage),
  ];
  return parts.filter((part): part is Named => part !== undefined);
}

const largest = (parts: Named[], key: "massKg" | "costM") =>
  parts.reduce<Named | null>(
    (top, part) => (!top || part[key] > top[key] ? part : top),
    null,
  );

/** The installed sensor that best fits this hazard, using the engine's fit rule. */
export function bestFit(design: SatelliteDesign, category: Category) {
  let best: { id: string; fit: number } | null = null;
  for (const id of design.instruments) {
    if (!findPart(partsCatalog.instruments, id)) continue;
    const fit = instrumentFit(id, category);
    if (!best || fit > best.fit) best = { id, fit };
  }
  return best;
}

function massHint({ design, resources, constraints }: HintInput) {
  if (resources.massKg <= constraints.massKg) return null;
  const heaviest = largest(chosenParts(design), "massKg");
  return {
    id: "mass",
    tone: "fix",
    text:
      `Oops! Your satellite is too heavy for this rocket. It weighs ${fmt(resources.massKg)} kg, but the rocket can lift ${fmt(constraints.massKg)} kg.` +
      (heaviest
        ? ` The heaviest part is the ${heaviest.name} (${fmt(heaviest.massKg)} kg).`
        : "") +
      " Can you make it lighter?",
  } satisfies GuideHint;
}

function powerHint({ design, resources }: HintInput) {
  const solar = findPart(partsCatalog.solar, design.solar);
  if (!solar || resources.powerUseW <= resources.powerGenW) return null;
  const hungriest = design.instruments
    .map((id) => findPart(partsCatalog.instruments, id))
    .filter((part) => part !== undefined)
    .reduce<{ name: string; powerW: number } | null>(
      (top, part) => (!top || part.powerW > top.powerW ? part : top),
      null,
    );
  const bigger = partsCatalog.solar.some(
    (part) => part.generationW >= resources.powerUseW,
  );
  const lead = hungriest
    ? `Looks like the ${hungriest.name} needs more energy (${fmt(hungriest.powerW)} W).`
    : "Looks like your satellite needs more energy.";
  return {
    id: "power",
    tone: "fix",
    text:
      `${lead} Everything together needs ${fmt(resources.powerUseW)} W, but the ${solar.name} makes ${fmt(resources.powerGenW)} W. ` +
      (bigger
        ? "Try upgrading your solar panels!"
        : "Even the biggest solar panels can't keep up, so try a sensor that uses less power."),
  } satisfies GuideHint;
}

function budgetHint({ design, resources, constraints }: HintInput) {
  if (resources.costM <= constraints.budgetM) return null;
  const stations =
    partsCatalog.groundStations[
      String(design.groundStations) as "1" | "3" | "5"
    ];
  const parts = chosenParts(design);
  if (stations)
    parts.push({
      name: `${design.groundStations} ground station${design.groundStations === 1 ? "" : "s"}`,
      massKg: 0,
      costM: stations.costM,
    });
  const priciest = largest(parts, "costM");
  return {
    id: "budget",
    tone: "fix",
    text:
      `This design costs $${fmt(resources.costM)}M, but your budget is $${fmt(constraints.budgetM)}M.` +
      (priciest
        ? ` The ${priciest.name} costs the most ($${fmt(priciest.costM)}M).`
        : "") +
      " Can you find a cheaper option?",
  } satisfies GuideHint;
}

function commHint({ design }: HintInput) {
  const comm = findPart(partsCatalog.communications, design.comm);
  const stations =
    partsCatalog.groundStations[
      String(design.groundStations) as "1" | "3" | "5"
    ];
  if (comm && stations) return null;
  // Only once every other system is on board, so it reads as the last step.
  const rest =
    design.instruments.length > 0 &&
    findPart(partsCatalog.orbits, design.orbit) &&
    findPart(partsCatalog.solar, design.solar) &&
    findPart(partsCatalog.batteries, design.battery) &&
    findPart(partsCatalog.storage, design.storage);
  if (!rest) return null;
  return {
    id: "comm",
    tone: "tip",
    text: "Almost there! We still need a way to send your data back to Earth. Pick a radio and some ground stations.",
  } satisfies GuideHint;
}

function storageHint({ design, resources }: HintInput) {
  const storage = findPart(partsCatalog.storage, design.storage);
  if (!storage || resources.dataGBPerDay <= resources.storageGB) return null;
  return {
    id: "storage",
    tone: "tip",
    text: `Your sensors make ${fmt(resources.dataGBPerDay)} GB of data a day, but the ${storage.name} only holds ${fmt(resources.storageGB)} GB. More memory holds more observations between downlinks.`,
  } satisfies GuideHint;
}

function fitHint({ design, category }: HintInput) {
  const best = bestFit(design, category);
  if (!best || best.fit >= WEAK_FIT) return null;
  const name = findPart(partsCatalog.instruments, best.id)?.name ?? best.id;
  return {
    id: "sensor-fit",
    tone: "tip",
    text: `Hmm, the ${name} isn't great at spotting ${hazardWord[category]} (match ${pct(best.fit)}). Another sensor might see it more clearly.`,
  } satisfies GuideHint;
}

/**
 * Lower power use without reducing the best hazard fit or orbit coverage.
 * These factors do not prove equal overall observation quality or mission score.
 */
function improvedHint({
  design,
  resources,
  category,
  previousDesign,
  previousResources,
}: HintInput) {
  if (!previousDesign || !previousResources) return null;
  const now = bestFit(design, category);
  const before = bestFit(previousDesign, category);
  if (!now || !before) return null;
  if (resources.powerUseW >= previousResources.powerUseW) return null;
  if (now.fit < before.fit) return null;
  if (resources.coverageEstimate < previousResources.coverageEstimate)
    return null;
  return {
    id: "improved",
    tone: "celebrate",
    text: `Great thinking! Your new design uses less power (${fmt(resources.powerUseW)} W instead of ${fmt(previousResources.powerUseW)} W) without lowering its hazard match or orbit coverage.`,
  } satisfies GuideHint;
}

type Rule = (input: HintInput) => GuideHint | null;

const order: Rule[] = [
  massHint,
  powerHint,
  budgetHint,
  commHint,
  improvedHint,
  storageHint,
  fitHint,
];

/** The single most useful hint for this design, or null. */
export function designHint(input: HintInput): GuideHint | null {
  for (const rule of order) {
    const hint = rule(input);
    if (hint) return hint;
  }
  return null;
}

/** Every hint that applies, in priority order (for tests and debugging). */
export function allHints(input: HintInput): GuideHint[] {
  return order
    .map((rule) => rule(input))
    .filter((hint): hint is GuideHint => hint !== null);
}

const missReasons = [
  [
    "hazardNeverInView",
    (n: number, of: number) =>
      `${n} of ${of} hazard areas were never in view of your orbit.`,
  ],
  [
    "hazardCloudBlocked",
    (n: number, of: number) =>
      `Clouds blocked the view of ${n} of ${of} hazard areas.`,
  ],
  [
    "hazardNotRecognised",
    (n: number, of: number) =>
      `Your sensor looked at ${n} of ${of} hazard areas but couldn't recognise the hazard.`,
  ],
  [
    "hazardBeforeEvent",
    (n: number, of: number) =>
      `${n} of ${of} hazard areas were only seen before the event started.`,
  ],
] as const;

/**
 * The results line, built only from the engine's result: score, coverage and
 * the biggest miss reason in `diagnostics`. Without diagnostics no reason is given.
 */
export function resultLine(result: SimResult): string {
  const score = Math.round(result.score.total);
  const d = result.diagnostics;
  const coverage =
    d && d.totalCells > 0
      ? Math.round((100 * d.observedCells) / d.totalCells)
      : null;
  if (result.success)
    return (
      `Mission complete! Your satellite scored ${score}` +
      (coverage !== null ? ` and watched ${coverage}% of the area` : "") +
      ". Let's see what worked, and what you can improve next time."
    );
  let reason = "";
  if (d && d.hazardCells > 0) {
    const top = missReasons
      .map(([key, say]) => ({ n: d[key], say }))
      .filter((item) => item.n > 0)
      .sort((a, b) => b.n - a.n)[0];
    if (top) reason = ` ${top.say(top.n, d.hazardCells)}`;
  }
  return `Mission complete! This run scored ${score}.${reason} That's how engineers learn. Let's see what to improve next time.`;
}
