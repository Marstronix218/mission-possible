// Landing-page view of the playable missions. Scoring numbers come from
// data/missions/*.json (via the registry); narrative copy comes from
// src/lib/story/missions.ts, with category-based fallbacks until a story exists.
import type { Category, Mission } from "@/types/game";
import { categoryLabel, getMissionStory } from "@/lib/story/missions";

export type MapMission = {
  slug: string;
  city: string;
  category: Category;
  coordinates: [number, number];
  deadlineHours: number;
  alert: string;
  headline: string;
};

export type BestRecord = { score: number; success: boolean };

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

export function toMapMission(m: Mission): MapMission {
  const story = getMissionStory(m.slug);
  const [west, south, east, north] = m.bbox;
  return {
    slug: m.slug,
    city: m.city,
    category: m.category,
    coordinates: [(west + east) / 2, (south + north) / 2],
    deadlineHours: m.targetResponseHours,
    alert: story?.alert ?? `${categoryLabel[m.category]} alert: ${m.city}`,
    headline: story?.headline ?? fallbackHeadline[m.category](m.city),
  };
}

/** Build the home selection from metadata, without loading hazard grids in the browser. */
export function selectMissions(missions: MapMission[]) {
  const featuredSlugs = ["los-angeles", "houston", "phoenix"];
  const featuredMissions = featuredSlugs
    .map((slug) => missions.find((m) => m.slug === slug))
    .filter((m): m is MapMission => Boolean(m));
  const moreMissions = missions.filter((m) => !featuredSlugs.includes(m.slug));
  const categories = categoryOrder.filter((c) => missions.some((m) => m.category === c));
  return { featuredMission: featuredMissions[0] ?? missions[0], featuredMissions, moreMissions, categories };
}

/** Hazard colors come from the design tokens in globals.css. */
export const categoryColors: Record<Category, string> = {
  wildfire: "var(--hazard-wildfire)",
  heat: "var(--hazard-heat)",
  flood: "var(--hazard-flood)",
  snow: "var(--hazard-snow)",
  drought: "var(--hazard-drought)",
  storm: "var(--hazard-storm)",
  glacier: "var(--hazard-glacier)",
  volcano: "var(--hazard-volcano)",
};

/** Mission paths. */
export const briefHref = (slug: string) => `/mission/${slug}/brief`;

/**
 * Star display for a personal best (presentation only — the score itself is
 * the real simulation result): completed = 1 star, 70+ = 2, 90+ = 3.
 */
export function starsFor(record: BestRecord | undefined): number {
  if (!record || !record.success) return 0;
  if (record.score >= 90) return 3;
  if (record.score >= 70) return 2;
  return 1;
}

export function progressLabel(record: BestRecord | undefined): string {
  if (!record) return "Not played yet";
  const stars = starsFor(record);
  return `${record.success ? "Completed" : "Tried, not completed"}, best score ${record.score.toFixed(0)} of 100, ${stars} of 3 stars`;
}
