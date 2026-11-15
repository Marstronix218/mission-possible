// Component performance profiles for the satellite designer's radar charts,
// resource dashboard and trade-off notes. Pure and deterministic: every value
// is a documented transformation of data/parts.json, data/categories.json or a
// formula already used by src/lib/sim (resources.ts / engine.ts). No React.
//
// Normalisation rules (0–100, higher = more favourable):
//  • ratio-to-best for raw specs with units: 100 × value / max for "more is
//    better" specs, 100 × min / value for demands (power, data). The best part
//    in its catalog category scores 100 and proportions are preserved, so a
//    part never collapses to 0 just for being the smallest.
//  • ×100 for quantities that are already 0–1 model factors (categoryFit,
//    eclipseContinuity, reliabilityFactor, engine margins), so they keep their
//    absolute meaning.
// Axes describe relative component characteristics, not the mission score.
import { categoryRules, findPart, partsCatalog } from "@/lib/sim/catalog";
import { summarizeResources } from "@/lib/sim/resources";
import type {
  Category,
  Constraints,
  ResourceSummary,
  SatelliteDesign,
} from "@/types/game";

export type PerfCategory =
  | "instruments"
  | "orbits"
  | "solar"
  | "batteries"
  | "communications"
  | "storage"
  | "groundStations";

export interface PerfAxis {
  id: string;
  label: string;
  /** 0–100, higher = more favourable for this characteristic. */
  value: number;
  /** The underlying spec in real units. */
  actual: string;
  /** Short plain-language explanation of the term. */
  meaning: string;
  /** Spec field(s) and formula the value is derived from. */
  formula: string;
}

export interface PerfContext {
  category: Category;
  design: SatelliteDesign;
  constraints: Constraints;
}

export interface PerfOption {
  id: string;
  name: string;
}

type DesignSlot = Exclude<keyof SatelliteDesign, "decisions">;

export const slotOf: Record<PerfCategory, DesignSlot> = {
  instruments: "instruments",
  orbits: "orbit",
  solar: "solar",
  batteries: "battery",
  communications: "comm",
  storage: "storage",
  groundStations: "groundStations",
};

export const categoryLabel: Record<PerfCategory, string> = {
  instruments: "Sensors",
  orbits: "Orbits",
  solar: "Solar arrays",
  batteries: "Batteries",
  communications: "Communications",
  storage: "Storage",
  groundStations: "Ground stations",
};

export const hazardWord: Record<Category, string> = {
  wildfire: "wildfire",
  heat: "urban heat",
  flood: "flooding",
  snow: "snow cover",
  drought: "drought",
  storm: "storm",
  glacier: "glacier change",
  volcano: "volcanic activity",
};

const stationIds = ["1", "3", "5"] as const;
type StationId = (typeof stationIds)[number];
const station = (id: string) => partsCatalog.groundStations[id as StationId];

const round1 = (value: number) => Math.round(value * 10) / 10;
const clamp100 = (value: number) => Math.max(0, Math.min(100, value));
/** 100 × value / max (more is better). */
export const ratioHigher = (value: number, all: number[]) => {
  const max = Math.max(...all);
  return max > 0 ? round1(clamp100((100 * value) / max)) : 0;
};
/** 100 × min / value (less is better). */
export const ratioLower = (value: number, all: number[]) => {
  const min = Math.min(...all);
  return value > 0 ? round1(clamp100((100 * min) / value)) : 100;
};
const factor = (value: number) => round1(clamp100(value * 100));
const num = (value: number) => Number(value.toFixed(3));

/** Same rule as the engine: a sensor without a listed fit uses 0.08. */
export const instrumentFit = (id: string, category: Category) =>
  findPart(partsCatalog.instruments, id)?.categoryFit[category] ?? 0.08;

/** Engine downlink formula (resources.ts): rate × 0.125 GB/Gb × minutes × 60 s. */
export const downlinkGB = (rateGbps: number, minutesPerDay: number) =>
  rateGbps * 0.125 * minutesPerDay * 60;

/** Daily data of the installed sensors (resources.ts dataGBPerDay). */
const dataOf = (design: SatelliteDesign) =>
  design.instruments.reduce(
    (sum, id) =>
      sum + (findPart(partsCatalog.instruments, id)?.dataGBPerDay ?? 0),
    0,
  );

/** Share of daily sensor data a downlink can send, capped at 100. */
const dataShare = (downlink: number, data: number) =>
  data > 0 ? round1(clamp100((100 * downlink) / data)) : 100;

export function optionsFor(category: PerfCategory): PerfOption[] {
  if (category === "groundStations")
    return stationIds.map((id) => ({
      id,
      name: `${id} ground station${id === "1" ? "" : "s"}`,
    }));
  return partsCatalog[category].map((part) => ({
    id: part.id,
    name: part.name,
  }));
}

export function optionName(category: PerfCategory, id: string): string {
  return optionsFor(category).find((option) => option.id === id)?.name ?? id;
}

/** The current choice(s) for a category, as option ids. */
export function installedIds(
  category: PerfCategory,
  design: SatelliteDesign,
): string[] {
  if (category === "instruments") return design.instruments;
  if (category === "groundStations") return [String(design.groundStations)];
  const value = design[slotOf[category]] as string;
  return value ? [value] : [];
}

/**
 * Axes per category. Only attributes that exist in the catalog are used; a
 * category with fewer meaningful attributes gets fewer axes (3–5).
 */
export function performanceAxes(
  category: PerfCategory,
  id: string,
  ctx: PerfContext,
): PerfAxis[] {
  const cat = partsCatalog;
  if (category === "instruments") {
    const part = findPart(cat.instruments, id);
    if (!part) return [];
    const all = cat.instruments;
    const fit = instrumentFit(id, ctx.category);
    return [
      {
        id: "detail",
        label: "Observation detail",
        // resolutionScore (catalog detail factor) → 100 × value / category max.
        value: ratioHigher(
          part.resolutionScore,
          all.map((p) => p.resolutionScore),
        ),
        actual: `detail factor ${part.resolutionScore}`,
        meaning: "How finely it can resolve features on the ground.",
        formula: "100 × resolutionScore / highest resolutionScore",
      },
      {
        id: "allWeather",
        label: "All-weather viewing",
        // cloudPenetrating (boolean) → 100 or 0. The engine cuts cloud/smoke
        // blocking to 8% for penetrating sensors that fit the hazard (≥ 0.5).
        value: part.cloudPenetrating ? 100 : 0,
        actual: part.cloudPenetrating
          ? "sees through cloud"
          : "blocked by cloud",
        meaning: "Whether clouds and smoke block its view.",
        formula: "cloudPenetrating ? 100 : 0",
      },
      {
        id: "detection",
        label: "Detection capability",
        // categoryFit[mission category] (0–1; engine default 0.08) × 100.
        value: factor(fit),
        actual: `fit ${fit} for ${hazardWord[ctx.category]}`,
        meaning: `How strongly its measurement responds to ${hazardWord[ctx.category]} in the model.`,
        formula: "100 × categoryFit[mission category] (engine default 0.08)",
      },
      {
        id: "power",
        label: "Power efficiency",
        // powerW is a demand → 100 × lowest powerW / powerW.
        value: ratioLower(
          part.powerW,
          all.map((p) => p.powerW),
        ),
        actual: `${part.powerW} W`,
        meaning: "Less electrical power needed to run it.",
        formula: "100 × lowest powerW / powerW",
      },
      {
        id: "data",
        label: "Data efficiency",
        // dataGBPerDay is a demand on downlink/storage → 100 × lowest / value.
        value: ratioLower(
          part.dataGBPerDay,
          all.map((p) => p.dataGBPerDay),
        ),
        actual: `${part.dataGBPerDay} GB/day`,
        meaning: "Less data to store and send to Earth each day.",
        formula: "100 × lowest dataGBPerDay / dataGBPerDay",
      },
    ];
  }
  if (category === "orbits") {
    const part = findPart(cat.orbits, id);
    if (!part) return [];
    const all = cat.orbits;
    // coverageEstimate comes straight from summarizeResources (orbit-only term).
    const coverage = summarizeResources(
      { ...ctx.design, orbit: id },
      ctx.constraints,
    ).coverageEstimate;
    return [
      {
        id: "detail",
        label: "Observation detail",
        // resolutionFactor multiplies detection probability in the engine.
        value: ratioHigher(
          part.resolutionFactor,
          all.map((p) => p.resolutionFactor),
        ),
        actual: `×${part.resolutionFactor} detail`,
        meaning: "Closer orbits see smaller features.",
        formula: "100 × resolutionFactor / highest resolutionFactor",
      },
      {
        id: "coverage",
        label: "Coverage",
        // resources.ts: min(100, 28 × swathFactor / max(0.35, revisitFactor)).
        value: round1(clamp100(coverage)),
        actual: `~${Math.round(coverage)}% of the area`,
        meaning: "Estimated share of the mission area it can watch.",
        formula: "min(100, 28 × swathFactor / max(0.35, revisitFactor))",
      },
      {
        id: "revisit",
        label: "Revisit",
        // revisitFactor is an interval (smaller = more often) → 100 × min / value.
        value: ratioLower(
          part.revisitFactor,
          all.map((p) => p.revisitFactor),
        ),
        actual: `interval ×${part.revisitFactor}`,
        meaning: "How often it comes back over the same place.",
        formula: "100 × lowest revisitFactor / revisitFactor",
      },
      {
        id: "consistency",
        label: "Observation consistency",
        // reliabilityFactor (0–1) multiplies engine reliability → × 100.
        value: factor(part.reliabilityFactor),
        actual: `reliability ×${part.reliabilityFactor}`,
        meaning:
          "How steadily the orbit supports operations (drag, stability).",
        formula: "100 × reliabilityFactor",
      },
    ];
  }
  if (category === "solar") {
    const part = findPart(cat.solar, id);
    if (!part) return [];
    const all = cat.solar;
    return [
      {
        id: "output",
        label: "Power output",
        value: ratioHigher(
          part.generationW,
          all.map((p) => p.generationW),
        ),
        actual: `${part.generationW} W`,
        meaning: "Electrical power generated in sunlight.",
        formula: "100 × generationW / highest generationW",
      },
      {
        id: "perKg",
        label: "Output per kg",
        value: ratioHigher(
          part.generationW / part.massKg,
          all.map((p) => p.generationW / p.massKg),
        ),
        actual: `${num(part.generationW / part.massKg)} W/kg`,
        meaning: "Power generated for each kilogram launched.",
        formula: "100 × (generationW / massKg) / highest ratio",
      },
      {
        id: "perCost",
        label: "Output per $M",
        value: ratioHigher(
          part.generationW / part.costM,
          all.map((p) => p.generationW / p.costM),
        ),
        actual: `${num(part.generationW / part.costM)} W/$M`,
        meaning: "Power generated for each million dollars.",
        formula: "100 × (generationW / costM) / highest ratio",
      },
    ];
  }
  if (category === "batteries") {
    const part = findPart(cat.batteries, id);
    if (!part) return [];
    const all = cat.batteries;
    return [
      {
        id: "shadow",
        label: "Shadow operation",
        // eclipseContinuity (0–1) multiplies the engine's operation factor.
        value: factor(part.eclipseContinuity),
        actual: `${Math.round(part.eclipseContinuity * 100)}% in shadow`,
        meaning: "Share of work it keeps running in Earth's shadow.",
        formula: "100 × eclipseContinuity",
      },
      {
        id: "perKg",
        label: "Continuity per kg",
        value: ratioHigher(
          part.eclipseContinuity / part.massKg,
          all.map((p) => p.eclipseContinuity / p.massKg),
        ),
        actual: `${num(part.eclipseContinuity / part.massKg)} per kg`,
        meaning: "Shadow continuity for each kilogram launched.",
        formula: "100 × (eclipseContinuity / massKg) / highest ratio",
      },
      {
        id: "perCost",
        label: "Continuity per $M",
        value: ratioHigher(
          part.eclipseContinuity / part.costM,
          all.map((p) => p.eclipseContinuity / p.costM),
        ),
        actual: `${num(part.eclipseContinuity / part.costM)} per $M`,
        meaning: "Shadow continuity for each million dollars.",
        formula: "100 × (eclipseContinuity / costM) / highest ratio",
      },
    ];
  }
  if (category === "communications") {
    const part = findPart(cat.communications, id);
    if (!part) return [];
    const all = cat.communications;
    const minutes =
      station(String(ctx.design.groundStations))?.accessMinutesPerDay ?? 0;
    const downlink = downlinkGB(part.rateGbps, minutes);
    const data = dataOf(ctx.design);
    return [
      {
        id: "speed",
        label: "Transmission speed",
        value: ratioHigher(
          part.rateGbps,
          all.map((p) => p.rateGbps),
        ),
        actual: `${part.rateGbps} Gbps`,
        meaning: "How fast data flows during a ground contact.",
        formula: "100 × rateGbps / highest rateGbps",
      },
      {
        id: "capacity",
        label: "Data capacity",
        // resources.ts downlink with your ground stations ÷ your sensors' data.
        value: dataShare(downlink, data),
        actual: `${round1(downlink)} GB/day vs ${round1(data)} GB/day made`,
        meaning: "Share of your sensors' daily data it can send home.",
        formula:
          "min(100, 100 × rateGbps × 0.125 × contact min × 60 / sensor GB/day)",
      },
      {
        id: "power",
        label: "Power efficiency",
        value: ratioLower(
          part.powerW,
          all.map((p) => p.powerW),
        ),
        actual: `${part.powerW} W`,
        meaning: "Less electrical power needed to transmit.",
        formula: "100 × lowest powerW / powerW",
      },
      {
        id: "perWatt",
        label: "Speed per watt",
        value: ratioHigher(
          part.rateGbps / part.powerW,
          all.map((p) => p.rateGbps / p.powerW),
        ),
        actual: `${num(part.rateGbps / part.powerW)} Gbps/W`,
        meaning: "Data rate delivered for each watt of radio power.",
        formula: "100 × (rateGbps / powerW) / highest ratio",
      },
    ];
  }
  if (category === "storage") {
    const part = findPart(cat.storage, id);
    if (!part) return [];
    const all = cat.storage;
    const data = dataOf(ctx.design);
    // engine.ts storageMargin = clamp01(storageGB / max(1, dataGBPerDay)).
    const margin = Math.min(1, part.capacityGB / Math.max(1, data));
    return [
      {
        id: "capacity",
        label: "Capacity",
        value: ratioHigher(
          part.capacityGB,
          all.map((p) => p.capacityGB),
        ),
        actual: `${part.capacityGB} GB`,
        meaning: "How much data it can hold between contacts.",
        formula: "100 × capacityGB / highest capacityGB",
      },
      {
        id: "buffer",
        label: "Data buffer",
        value: factor(margin),
        actual:
          data > 0
            ? `${num(part.capacityGB / data)} days of data`
            : "no sensor data yet",
        meaning:
          "Whether one day of your sensors' data fits (engine storage margin).",
        formula: "100 × min(1, capacityGB / max(1, sensor GB/day))",
      },
      {
        id: "perKg",
        label: "Capacity per kg",
        value: ratioHigher(
          part.capacityGB / part.massKg,
          all.map((p) => p.capacityGB / p.massKg),
        ),
        actual: `${num(part.capacityGB / part.massKg)} GB/kg`,
        meaning: "Storage for each kilogram launched.",
        formula: "100 × (capacityGB / massKg) / highest ratio",
      },
      {
        id: "perCost",
        label: "Capacity per $M",
        value: ratioHigher(
          part.capacityGB / part.costM,
          all.map((p) => p.capacityGB / p.costM),
        ),
        actual: `${num(part.capacityGB / part.costM)} GB/$M`,
        meaning: "Storage for each million dollars.",
        formula: "100 × (capacityGB / costM) / highest ratio",
      },
    ];
  }
  // Ground stations
  const part = station(id);
  if (!part) return [];
  const all = stationIds.map(station);
  const comm = findPart(cat.communications, ctx.design.comm);
  const downlink = comm
    ? downlinkGB(comm.rateGbps, part.accessMinutesPerDay)
    : 0;
  const data = dataOf(ctx.design);
  return [
    {
      id: "contact",
      label: "Communication opportunities",
      value: ratioHigher(
        part.accessMinutesPerDay,
        all.map((s) => s.accessMinutesPerDay),
      ),
      actual: `${part.accessMinutesPerDay} min/day`,
      meaning: "Daily minutes a dish on Earth can hear the satellite.",
      formula: "100 × accessMinutesPerDay / highest accessMinutesPerDay",
    },
    {
      id: "capacity",
      label: "Data capacity",
      value: comm ? dataShare(downlink, data) : 0,
      actual: comm
        ? `${round1(downlink)} GB/day vs ${round1(data)} GB/day made`
        : "choose a radio first",
      meaning:
        "Share of your sensors' daily data your radio can send with these stations.",
      formula:
        "min(100, 100 × radio rateGbps × 0.125 × minutes × 60 / sensor GB/day)",
    },
    {
      id: "perCost",
      label: "Contact per $M",
      value: ratioHigher(
        part.accessMinutesPerDay / part.costM,
        all.map((s) => s.accessMinutesPerDay / s.costM),
      ),
      actual: `${num(part.accessMinutesPerDay / part.costM)} min/$M`,
      meaning: "Contact minutes for each million dollars.",
      formula: "100 × (accessMinutesPerDay / costM) / highest ratio",
    },
  ];
}

/**
 * The design with `id` swapped into this category. Instruments toggle: an
 * installed sensor previews its removal; a new one is added. Returns null when
 * the sensor bus is already full.
 */
export function candidateDesign(
  category: PerfCategory,
  id: string,
  design: SatelliteDesign,
): SatelliteDesign | null {
  if (category === "instruments") {
    if (design.instruments.includes(id))
      return {
        ...design,
        instruments: design.instruments.filter((item) => item !== id),
      };
    if (design.instruments.length >= 3) return null;
    return { ...design, instruments: [...design.instruments, id] };
  }
  if (category === "groundStations")
    return {
      ...design,
      groundStations: Number(id) as SatelliteDesign["groundStations"],
    };
  return { ...design, [slotOf[category]]: id };
}

/**
 * Engine downlink delay (engine.ts baseLatencyHours, standard downlink):
 * max(0.25, dataGBPerDay / max(0.1, downlinkGBPerDay) × 24) hours.
 */
export function deliveryDelayHours(resources: ResourceSummary): number {
  return round1(
    Math.max(
      0.25,
      (resources.dataGBPerDay / Math.max(0.1, resources.downlinkGBPerDay)) * 24,
    ),
  );
}

export const COVERAGE_GOAL = 50;

/**
 * Short, mission-specific trade-off notes for one option, chosen from computed
 * facts (resource totals before/after, engine fit rules). Never ranks options.
 */
export function tradeOffNotes(
  category: PerfCategory,
  id: string,
  ctx: PerfContext,
): string[] {
  const { design, constraints } = ctx;
  const next = candidateDesign(category, id, design);
  if (!next)
    return [
      "The sensor bus already holds three sensors; remove one to try this.",
    ];
  const before = summarizeResources(design, constraints);
  const after = summarizeResources(next, constraints);
  const notes: string[] = [];
  const hazard = hazardWord[ctx.category];
  const removing =
    category === "instruments" && design.instruments.includes(id);
  const maxSolar = Math.max(...partsCatalog.solar.map((p) => p.generationW));
  const powerShort = after.powerGenW > 0 && after.powerUseW > after.powerGenW;

  if (category === "instruments" && !removing) {
    const part = findPart(partsCatalog.instruments, id)!;
    const fit = instrumentFit(id, ctx.category);
    if (powerShort) {
      notes.push(
        (part.resolutionScore >= 0.9
          ? "This sensor has excellent observation detail, but its power requirements may make it unsuitable for your current mission: "
          : "Its power requirements may not suit your current design: ") +
          `the satellite would need ${after.powerUseW} W while your solar array makes ${after.powerGenW} W.` +
          (after.powerUseW > maxSolar
            ? ` Even the largest array (${maxSolar} W) could not supply that.`
            : " A larger array would help, at extra mass and cost."),
      );
    }
    if (fit < 0.5)
      notes.push(
        `In this model its measurement type responds weakly to ${hazard}, so it may miss or misread the signal.`,
      );
    else if (
      part.cloudPenetrating &&
      categoryRules[ctx.category].cloudImpact >= 0.5
    )
      notes.push(
        `It keeps seeing through cloud and smoke, which often hide ${hazard} in this mission.`,
      );
    else if (
      !part.cloudPenetrating &&
      categoryRules[ctx.category].cloudImpact >= 0.5
    )
      notes.push("Clouds and smoke can block it on some passes.");
    const medianCost = [...partsCatalog.instruments.map((p) => p.costM)].sort(
      (a, b) => a - b,
    )[4];
    if (fit >= 0.5 && part.costM < medianCost && !powerShort)
      notes.push(
        "This less expensive sensor may be sufficient for your mission, leaving more resources for communications and power.",
      );
  } else if (category === "instruments" && removing) {
    notes.push(
      `Removing it saves $${round1(before.costM - after.costM)}M, ${round1(before.massKg - after.massKg)} kg and ${round1(before.powerUseW - after.powerUseW)} W.`,
    );
  }

  if (category === "orbits") {
    const orbit = findPart(partsCatalog.orbits, id)!;
    if (after.coverageEstimate < COVERAGE_GOAL)
      notes.push(
        `It watches about ${Math.round(after.coverageEstimate)}% of the area; a mission needs at least ${COVERAGE_GOAL}% coverage to count as a success.`,
      );
    if (orbit.resolutionFactor < 0.5)
      notes.push(
        "It keeps the area in view almost constantly, but from far away: small features may be missed.",
      );
    else if (orbit.revisitFactor > 1)
      notes.push(
        "It returns less often, so the first useful look may come later.",
      );
    if (orbit.reliabilityFactor < 0.9)
      notes.push(
        "Its low altitude gives sharp detail but less steady operation.",
      );
  }

  if (category === "solar" && before.powerUseW > 0) {
    const part = findPart(partsCatalog.solar, id)!;
    if (part.generationW < after.powerUseW)
      notes.push(
        `It makes ${part.generationW} W, but your current parts need ${after.powerUseW} W.`,
      );
    else if (after.powerUseW / part.generationW >= 0.85)
      notes.push(
        "It covers your power needs with less than 15% to spare; operations may pause in shadow.",
      );
    else {
      const smaller = partsCatalog.solar.find(
        (p) =>
          p.generationW < part.generationW && p.generationW >= after.powerUseW,
      );
      if (smaller)
        notes.push(
          `It makes much more power than your current parts need (${after.powerUseW} W); that spare capacity costs mass and budget.`,
        );
    }
  }

  if (category === "batteries") {
    const part = findPart(partsCatalog.batteries, id)!;
    notes.push(
      `In the model about ${Math.round((1 - part.eclipseContinuity) * 100)}% of observing time is lost in Earth's shadow with this battery.`,
    );
  }

  if (category === "storage" && after.dataGBPerDay > 0) {
    const part = findPart(partsCatalog.storage, id)!;
    if (part.capacityGB < after.dataGBPerDay)
      notes.push(
        `It cannot hold one day of your sensors' data (${after.dataGBPerDay} GB/day).`,
      );
  }

  if (
    (category === "communications" ||
      category === "groundStations" ||
      category === "instruments") &&
    after.dataGBPerDay > 0 &&
    after.downlinkGBPerDay > 0 &&
    after.dataGBPerDay > after.downlinkGBPerDay
  )
    notes.push(
      `Your communication system may not be able to downlink all data each day (${after.dataGBPerDay} GB/day made vs ${after.downlinkGBPerDay} GB/day sent).`,
    );
  if (
    category === "communications" &&
    after.dataGBPerDay > 0 &&
    after.downlinkGBPerDay >= after.dataGBPerDay * 10
  )
    notes.push(
      `It can send far more than your sensors produce (${after.dataGBPerDay} GB/day); a slower radio could leave power and budget for other parts.`,
    );

  if (after.costM > constraints.budgetM && before.costM <= constraints.budgetM)
    notes.push(
      `It would take the cost to $${after.costM}M, over the $${constraints.budgetM}M budget.`,
    );
  if (after.massKg > constraints.massKg && before.massKg <= constraints.massKg)
    notes.push(
      `It would take the mass to ${after.massKg} kg, over the ${constraints.massKg} kg launch limit.`,
    );
  if (
    category !== "instruments" &&
    powerShort &&
    before.powerUseW <= before.powerGenW &&
    category !== "solar"
  )
    notes.push(
      `The satellite would need ${after.powerUseW} W, more than the ${after.powerGenW} W generated.`,
    );

  return notes.slice(0, 3);
}

export type ResourceKey = "budget" | "mass" | "power" | "data";

export interface ViolationExplanation {
  key: ResourceKey | "incomplete";
  resource: string;
  why: string;
  meaning: string;
  fixes: string[];
}

const violationKey: Record<string, ResourceKey> = {
  "Budget limit exceeded.": "budget",
  "Mass limit exceeded.": "mass",
  "Power demand exceeds solar generation.": "power",
  "Daily data exceeds downlink and storage capacity.": "data",
};

const missingStep: Record<string, string> = {
  "Select at least one instrument.": "Choose at least one sensor in step 1.",
  "Select a valid orbit.": "Choose an orbit in step 2.",
  "Select a valid solar array.": "Choose a solar array in step 3.",
  "Select a valid battery.": "Choose a battery in step 3.",
  "Select a valid storage system.": "Choose storage in step 3.",
  "Select a valid communication system.": "Choose a radio in step 4.",
};

const swapCategories: PerfCategory[] = [
  "instruments",
  "orbits",
  "solar",
  "batteries",
  "storage",
  "communications",
  "groundStations",
];

/** Single changes that remove this violation without adding a new resource violation. */
export function fixesFor(
  key: ResourceKey,
  design: SatelliteDesign,
  constraints: Constraints,
  limit = 3,
): string[] {
  const now = summarizeResources(design, constraints);
  const nowKeys = new Set(
    now.violations.map((v) => violationKey[v]).filter(Boolean),
  );
  const unit = {
    budget: "costM",
    mass: "massKg",
    power: "powerUseW",
    data: "dataGBPerDay",
  } as const;
  const found: { text: string; remaining: number; change: number }[] = [];
  for (const category of swapCategories) {
    const current = installedIds(category, design);
    const ids =
      category === "instruments"
        ? design.instruments.length > 1
          ? design.instruments
          : []
        : optionsFor(category)
            .map((o) => o.id)
            .filter((id) => !current.includes(id));
    for (const id of ids) {
      const next = candidateDesign(category, id, design);
      if (!next) continue;
      const after = summarizeResources(next, constraints);
      const keys = after.violations.map((v) => violationKey[v]).filter(Boolean);
      if (keys.includes(key) || keys.some((k) => !nowKeys.has(k))) continue;
      const change =
        key === "power"
          ? after.powerGenW - after.powerUseW - (now.powerGenW - now.powerUseW)
          : key === "data"
            ? after.downlinkGBPerDay + after.storageGB - after.dataGBPerDay
            : after[unit[key]] - now[unit[key]];
      const detail = {
        budget: `${change > 0 ? "+" : "−"}$${Math.abs(round1(change))}M`,
        mass: `${change > 0 ? "+" : "−"}${Math.abs(round1(change))} kg`,
        power: `${round1(after.powerUseW)} W needed / ${round1(after.powerGenW)} W made`,
        data: `${round1(after.downlinkGBPerDay)} GB/day sent + ${round1(after.storageGB)} GB stored`,
      }[key];
      const text =
        category === "instruments"
          ? `Remove ${optionName(category, id)} (${detail})`
          : `${categoryLabel[category]}: switch ${current[0] ? `${optionName(category, current[0])} → ` : "to "}${optionName(category, id)} (${detail})`;
      found.push({ text, remaining: keys.length, change: Math.abs(change) });
    }
  }
  return found
    .sort(
      (a, b) =>
        a.remaining - b.remaining ||
        a.change - b.change ||
        a.text.localeCompare(b.text),
    )
    .slice(0, limit)
    .map((item) => item.text);
}

/** Which resource, why, what it means, and computed changes that would fix it. */
export function explainViolations(
  design: SatelliteDesign,
  constraints: Constraints,
): ViolationExplanation[] {
  const r = summarizeResources(design, constraints);
  const missing = r.violations.filter((v) => missingStep[v]);
  const out: ViolationExplanation[] = [];
  if (missing.length)
    out.push({
      key: "incomplete",
      resource: "Design incomplete",
      why: "Some required parts are not chosen yet.",
      meaning: "The satellite cannot launch without every system.",
      fixes: missing.map((v) => missingStep[v]),
    });
  // Fixes need a complete design to evaluate meaningfully.
  const canSuggest = missing.length === 0;
  for (const message of r.violations) {
    const key = violationKey[message];
    if (!key) continue;
    // Without a solar array or radio these totals are only a missing part,
    // already reported above as an incomplete design.
    if ((key === "power" && !design.solar) || (key === "data" && !design.comm))
      continue;
    const fixes = canSuggest ? fixesFor(key, design, constraints) : [];
    if (key === "budget")
      out.push({
        key,
        resource: "Budget",
        why: `The parts cost $${r.costM}M, $${round1(r.costM - constraints.budgetM)}M over the $${constraints.budgetM}M budget.`,
        meaning: "The mission cannot be funded, so launch is blocked.",
        fixes,
      });
    if (key === "mass")
      out.push({
        key,
        resource: "Mass",
        why: `The satellite weighs ${r.massKg} kg, ${round1(r.massKg - constraints.massKg)} kg over the ${constraints.massKg} kg launch limit.`,
        meaning: "The rocket cannot lift it, so launch is blocked.",
        fixes,
      });
    if (key === "power")
      out.push({
        key,
        resource: "Power",
        why: `The parts need ${r.powerUseW} W but the solar array makes ${r.powerGenW} W.`,
        meaning: "Sensors and radio could not all run, so launch is blocked.",
        fixes,
      });
    if (key === "data")
      out.push({
        key,
        resource: "Data",
        why: `Sensors make ${r.dataGBPerDay} GB/day, but the radio sends ${r.downlinkGBPerDay} GB/day and storage holds ${r.storageGB} GB.`,
        meaning: "Observations would be lost every day, so launch is blocked.",
        fixes,
      });
  }
  return out;
}

export interface DesignChange {
  deltas: { label: string; delta: number; unit: string; better: boolean }[];
  benefits: string[];
  costs: string[];
}

const deltaRows = [
  ["costM", "Budget used", "$M", false],
  ["massKg", "Mass", "kg", false],
  ["powerUseW", "Power needed", "W", false],
  ["powerGenW", "Power generated", "W", true],
  ["dataGBPerDay", "Data made", "GB/day", false],
  ["downlinkGBPerDay", "Downlink", "GB/day", true],
  ["storageGB", "Storage", "GB", true],
  ["coverageEstimate", "Coverage estimate", "%", true],
] as const;

/** Resource deltas (actual numbers) plus benefits/costs from radar axis changes. */
export function describeChange(
  before: SatelliteDesign,
  after: SatelliteDesign,
  ctx: Omit<PerfContext, "design">,
): DesignChange {
  const r0 = summarizeResources(before, ctx.constraints);
  const r1 = summarizeResources(after, ctx.constraints);
  const deltas = deltaRows.flatMap(([key, label, unit, higher]) => {
    const delta = round1(r1[key] - r0[key]);
    return delta === 0
      ? []
      : [{ label, delta, unit, better: higher ? delta > 0 : delta < 0 }];
  });
  const benefits: string[] = [];
  const costs: string[] = [];
  for (const category of swapCategories) {
    const was = installedIds(category, before);
    const now = installedIds(category, after);
    if (category === "instruments") {
      for (const id of now.filter((i) => !was.includes(i))) {
        const top = performanceAxes(category, id, { ...ctx, design: after })
          .filter((a) => a.value >= 70)
          .map((a) => a.label.toLowerCase());
        benefits.push(
          `Added ${optionName(category, id)}` +
            (top.length ? ` (strong ${top.join(", ")})` : ""),
        );
      }
      for (const id of was.filter((i) => !now.includes(i)))
        costs.push(`Removed ${optionName(category, id)}`);
      continue;
    }
    if (was[0] === now[0] || !now[0]) continue;
    if (!was[0]) {
      benefits.push(`Installed ${optionName(category, now[0])}`);
      continue;
    }
    const a0 = performanceAxes(category, was[0], { ...ctx, design: before });
    const a1 = performanceAxes(category, now[0], { ...ctx, design: after });
    a1.forEach((axis, i) => {
      const d = Math.round(axis.value - (a0[i]?.value ?? 0));
      if (d >= 5) benefits.push(`${axis.label} +${d}`);
      if (d <= -5) costs.push(`${axis.label} −${Math.abs(d)}`);
    });
  }
  for (const d of deltas)
    (d.better ? benefits : costs).push(
      `${d.label} ${d.delta > 0 ? "+" : "−"}${Math.abs(d.delta)} ${d.unit}`,
    );
  return { deltas, benefits, costs };
}

/** Consequence hints derived from real resource calculations. */
export function consequenceHints(
  design: SatelliteDesign,
  constraints: Constraints,
  targetResponseHours: number,
): string[] {
  const r = summarizeResources(design, constraints);
  const hints: string[] = [];
  if (r.dataGBPerDay > 0 && design.comm && r.dataGBPerDay > r.downlinkGBPerDay)
    hints.push(
      "Your current communication system may not be able to downlink all data each day.",
    );
  if (r.storageGB > 0 && r.dataGBPerDay > r.storageGB)
    hints.push("One day of observations does not fit in onboard storage.");
  if (
    r.powerGenW > 0 &&
    r.powerUseW <= r.powerGenW &&
    r.powerUseW / r.powerGenW >= 0.85
  )
    hints.push(
      "Power margin is below 15%; observations may pause during eclipse.",
    );
  if (design.orbit && r.coverageEstimate < COVERAGE_GOAL)
    hints.push(
      `This orbit watches about ${Math.round(r.coverageEstimate)}% of the area; success needs ${COVERAGE_GOAL}% coverage.`,
    );
  if (r.dataGBPerDay > 0 && r.downlinkGBPerDay > 0) {
    const delay = deliveryDelayHours(r);
    if (delay > targetResponseHours)
      hints.push(
        `Data would take about ${delay} h to reach Earth after an observation, longer than the ${targetResponseHours} h response target.`,
      );
  }
  return hints;
}
