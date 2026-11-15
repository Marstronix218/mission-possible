import { partsCatalog } from "@/lib/sim";
import type { SimResult } from "@/types/game";
export interface RadarAxis {
  id: string;
  label: string;
  value: number;
  actual: string;
  meaning: string;
}
export type PartCategory =
  | "instruments"
  | "solar"
  | "batteries"
  | "communications"
  | "storage"
  | "orbits";
interface Trait {
  label: string;
  read: (p: Record<string, unknown>) => number;
  unit: string;
  lower?: boolean;
  meaning: string;
}
const n = (p: Record<string, unknown>, key: string) => Number(p[key]);
const cost: Trait = {
  label: "Affordability",
  read: (p) => n(p, "costM"),
  unit: "$M",
  lower: true,
  meaning: "Less money needed for this part.",
};
const mass: Trait = {
  label: "Lightness",
  read: (p) => n(p, "massKg"),
  unit: "kg",
  lower: true,
  meaning: "Less mass for the rocket to lift.",
};
const power: Trait = {
  label: "Low power use",
  read: (p) => n(p, "powerW"),
  unit: "W",
  lower: true,
  meaning: "Less electrical power required.",
};
const traits: Record<PartCategory, Trait[]> = {
  instruments: [
    {
      label: "Detail",
      read: (p) => n(p, "resolutionScore"),
      unit: "model factor",
      meaning: "Higher catalog detail factor; not a resolution in metres.",
    },
    {
      label: "Low data load",
      read: (p) => n(p, "dataGBPerDay"),
      unit: "GB/day",
      lower: true,
      meaning: "Less data to store and transmit; not geographic coverage.",
    },
    power,
    mass,
    cost,
  ],
  solar: [
    {
      label: "Power output",
      read: (p) => n(p, "generationW"),
      unit: "W",
      meaning: "More electrical power generated.",
    },
    {
      label: "Output / mass",
      read: (p) => n(p, "generationW") / n(p, "massKg"),
      unit: "W/kg",
      meaning: "More power generated per kilogram.",
    },
    {
      label: "Output / cost",
      read: (p) => n(p, "generationW") / n(p, "costM"),
      unit: "W/$M",
      meaning: "More power generated per million dollars.",
    },
    mass,
    cost,
  ],
  batteries: [
    {
      label: "Shadow duty",
      read: (p) => n(p, "eclipseContinuity"),
      unit: "fraction",
      meaning:
        "Higher modeled continuity while in Earth's shadow; this is not a Wh capacity.",
    },
    {
      label: "Duty / mass",
      read: (p) => n(p, "eclipseContinuity") / n(p, "massKg"),
      unit: "fraction/kg",
      meaning: "Modeled shadow continuity per kilogram.",
    },
    {
      label: "Duty / cost",
      read: (p) => n(p, "eclipseContinuity") / n(p, "costM"),
      unit: "fraction/$M",
      meaning: "Modeled shadow continuity per million dollars.",
    },
    mass,
    cost,
  ],
  communications: [
    {
      label: "Data rate",
      read: (p) => n(p, "rateGbps"),
      unit: "Gbps",
      meaning: "Higher radio data rate during a contact.",
    },
    {
      label: "Rate / power",
      read: (p) => n(p, "rateGbps") / n(p, "powerW"),
      unit: "Gbps/W",
      meaning: "More data rate per watt of radio power.",
    },
    power,
    mass,
    cost,
  ],
  storage: [
    {
      label: "Capacity",
      read: (p) => n(p, "capacityGB"),
      unit: "GB",
      meaning: "More observations fit in memory.",
    },
    {
      label: "Capacity / mass",
      read: (p) => n(p, "capacityGB") / n(p, "massKg"),
      unit: "GB/kg",
      meaning: "More storage per kilogram.",
    },
    {
      label: "Capacity / cost",
      read: (p) => n(p, "capacityGB") / n(p, "costM"),
      unit: "GB/$M",
      meaning: "More storage per million dollars.",
    },
    mass,
    cost,
  ],
  orbits: [
    {
      label: "Detail factor",
      read: (p) => n(p, "resolutionFactor"),
      unit: "×",
      meaning: "Higher modeled spatial-detail multiplier.",
    },
    {
      label: "Swath factor",
      read: (p) => n(p, "swathFactor"),
      unit: "×",
      meaning: "Wider modeled observation swath.",
    },
    {
      label: "Revisit rate",
      read: (p) => n(p, "revisitFactor"),
      unit: "interval factor",
      lower: true,
      meaning: "A smaller modeled revisit interval gives more opportunities.",
    },
    {
      label: "Reliability",
      read: (p) => n(p, "reliabilityFactor"),
      unit: "×",
      meaning: "Higher orbit reliability factor in the engine.",
    },
    cost,
  ],
};
export function comparisonParts(category: PartCategory) {
  return partsCatalog[category];
}
export function componentAxes(category: PartCategory, id: string): RadarAxis[] {
  const options = comparisonParts(category) as unknown as Record<
    string,
    unknown
  >[];
  const part = options.find((p) => p.id === id);
  if (!part) return [];
  return traits[category].map((t, i) => {
    const values = options.map(t.read);
    const low = Math.min(...values),
      high = Math.max(...values);
    const raw = t.read(part);
    const normalized =
      high === low
        ? 50
        : 100 *
          (t.lower ? (high - raw) / (high - low) : (raw - low) / (high - low));
    return {
      id: String(i),
      label: t.label,
      value: Math.round(normalized * 10) / 10,
      actual: `${Number(raw.toFixed(4))} ${t.unit}`,
      meaning: t.meaning,
    };
  });
}
export const scoreAxes = (r: SimResult): RadarAxis[] => [
  {
    id: "accuracy",
    label: "Observation",
    value: r.score.accuracy,
    actual: `${r.score.accuracy}/100`,
    meaning: "Correct hazard detections, misses and false alarms.",
  },
  {
    id: "coverage",
    label: "Coverage",
    value: r.score.coverage,
    actual: `${r.score.coverage}/100`,
    meaning: "Share of the mission area observed clearly.",
  },
  {
    id: "responseTime",
    label: "Timing",
    value: r.score.responseTime,
    actual: `${r.score.responseTime}/100`,
    meaning: "How quickly the first useful observation reached Earth.",
  },
  {
    id: "reliability",
    label: "Reliability",
    value: r.score.reliability,
    actual: `${r.score.reliability}/100`,
    meaning: "The engine's power, battery, data and orbit reliability.",
  },
];
export function radarPoint(
  index: number,
  value: number,
  radius = 104,
  count = 5,
) {
  const a = -Math.PI / 2 + (index * 2 * Math.PI) / count;
  return {
    x: 180 + (Math.cos(a) * radius * value) / 100,
    y: 150 + (Math.sin(a) * radius * value) / 100,
  };
}
export function radarPolygon(values: number[], radius = 104) {
  return values
    .map((v, i) => {
      const p = radarPoint(
        i,
        Math.max(0, Math.min(100, v)),
        radius,
        values.length,
      );
      return `${p.x},${p.y}`;
    })
    .join(" ");
}
