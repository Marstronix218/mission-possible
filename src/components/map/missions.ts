// Landing-page view of the playable missions. Scoring numbers come from
// data/missions/*.json (via the registry); narrative copy comes from
// src/lib/story/missions.ts, with category-based fallbacks until a story exists.
import type { Category, Mission } from "@/types/game";
import { allMissions } from "@/lib/missions/registry";
import { categoryLabel, getMissionStory } from "@/lib/story/missions";

export type MapMission = {
  slug: string;
  city: string;
  category: Category;
  coordinates: [number, number];
  deadlineHours: number;
  alert: string;
  headline: string;
  situation: string[];
  goal: string;
  dependents: string;
  deadlineReason: string;
};

/** Canonical hazard order used for filters and grouping. */
const categoryOrder: Category[] = [
  "wildfire",
  "heat",
  "flood",
  "snow",
  "drought",
  "storm",
  "glacier",
  "volcano",
];

const fallbackHeadline: Record<Category, (city: string) => string> = {
  wildfire: (city) => `A wildfire is spreading near ${city}.`,
  heat: (city) => `A dangerous heat wave is hitting ${city}.`,
  flood: (city) => `Flood water is rising in ${city}.`,
  snow: (city) => `A heavy snowstorm is burying ${city}.`,
  drought: (city) => `Drought is drying out the land around ${city}.`,
  storm: (city) => `A powerful storm is heading for ${city}.`,
  glacier: (city) => `Glaciers near ${city} are changing fast.`,
  volcano: (city) => `The volcano near ${city} is heating up.`,
};

/** One short line about why the satellite matters, per hazard. */
export const categoryTagline: Record<Category, string> = {
  wildfire: "Your satellite is their only eye above the smoke.",
  heat: "Your satellite can show where the heat is deadliest.",
  flood: "Your satellite can see where the water is going.",
  snow: "Your satellite can map the snow before roads close.",
  drought: "Your satellite can track the land drying out.",
  storm: "Your satellite can watch the storm from above.",
  glacier: "Your satellite can measure the ice as it changes.",
  volcano: "Your satellite can spot the heat before it erupts.",
};

function toMapMission(m: Mission): MapMission {
  const story = getMissionStory(m.slug);
  const [west, south, east, north] = m.bbox;
  const label = categoryLabel[m.category];
  return {
    slug: m.slug,
    city: m.city,
    category: m.category,
    coordinates: [(west + east) / 2, (south + north) / 2],
    deadlineHours: m.targetResponseHours,
    alert: story?.alert ?? `${label} alert: ${m.city}`,
    headline: story?.headline ?? fallbackHeadline[m.category](m.city),
    situation: story?.situation ?? [],
    goal: story?.goal ?? m.objective.en,
    dependents: story?.dependents ?? "Emergency teams",
    deadlineReason:
      story?.deadlineReason ??
      `Responders need your data within ${m.targetResponseHours} hours to act in time.`,
  };
}

export const missions: MapMission[] = allMissions.map(toMapMission);

export const featuredMission =
  missions.find((m) => m.slug === "los-angeles") ?? missions[0];

/** Hazard categories that have at least one playable mission, in canonical order. */
export const categories: Category[] = categoryOrder.filter((c) =>
  missions.some((m) => m.category === c),
);

export const categoryColors: Record<Category, string> = {
  wildfire: "#fb986f",
  heat: "#f6d879",
  flood: "#70c6fc",
  snow: "#d6e9f7",
  drought: "#c6ba80",
  storm: "#b6a0ff",
  glacier: "#77dfcf",
  volcano: "#f398bc",
};

/** Text symbol paired with each hazard color so color is never the only cue. */
export const categorySymbols: Record<Category, string> = {
  wildfire: "▲",
  heat: "☀",
  flood: "≈",
  snow: "❄",
  drought: "◌",
  storm: "ϟ",
  glacier: "◆",
  volcano: "⛰",
};
