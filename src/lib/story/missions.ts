// Narrative layer for the playable missions. Pure data: no React, no I/O.
// Numbers that affect scoring (budget, mass, deadline, duration) live in
// data/missions/*.json; this module only explains them in plain language.
import type { Category } from "@/types/game";
import { groupAStories } from "./missions-group-a";
import { groupBStories } from "./missions-group-b";

export interface MissionStory {
  slug: string;
  /** One-line alarm shown first, e.g. on the home page and briefing. */
  alert: string;
  /** Short punchy headline. */
  headline: string;
  /** 2–3 short sentences that set the scene. */
  situation: string[];
  /** The single goal the player must achieve, in one sentence. */
  goal: string;
  /** What the hazard is called on maps (e.g. "fire front"). */
  hazardNoun: string;
  /** Who depends on the satellite's data. */
  dependents: string;
  /** Why the response deadline is what it is. */
  deadlineReason: string;
  /** Why the budget/mass/duration are set the way they are for this mission. */
  constraintReasons: { budget: string; mass: string; duration: string };
  /** What the environment does to observations (smoke, clouds...). */
  obstacle: string;
  /** Plain-language hint about what kind of sensor works. */
  hint: string;
}

export const missionStories: Record<string, MissionStory> = {
  "los-angeles": {
    slug: "los-angeles",
    alert: "Wildfire alert: Los Angeles",
    headline: "Fire is moving toward homes in Los Angeles.",
    situation: [
      "Strong Santa Ana winds are pushing fire through the hills above Los Angeles.",
      "Smoke hides the fire front, so ground crews can't tell which way it will spread next.",
      "Your satellite has to find the active fire and get that data to the ground before evacuation decisions are made.",
    ],
    goal: "Find the active fire and get that data to emergency managers within 8 hours.",
    hazardNoun: "active fire",
    dependents: "Evacuation planners and fire crews",
    deadlineReason:
      "Evacuation orders are planned in a few-hour cycle. Data that arrives after 8 hours is too late to protect most homes.",
    constraintReasons: {
      budget: "The emergency fund is tight. Every dollar spent on the satellite is a dollar not spent on fire crews.",
      mass: "A small rocket is available on short notice, so the satellite has to stay light.",
      duration: "Wind-driven fires change direction within days, so the mission is short.",
    },
    obstacle: "Thick smoke and some clouds hide the fire from ordinary cameras.",
    hint: "Heat sensors can locate hot areas. Clouds and dense smoke can still block observations.",
  },
  houston: {
    slug: "houston",
    alert: "Flood alert: Houston",
    headline: "Houston neighborhoods are flooding under storm clouds.",
    situation: [
      "A slow-moving storm has dropped days of rain on Houston.",
      "Thick clouds block the view from space, and rescue teams don't know which streets are under water.",
      "Your satellite has to map the flooding through the clouds so rescuers can reach people.",
    ],
    goal: "Map the flooded areas through the clouds and deliver the map to rescuers within 12 hours.",
    hazardNoun: "flood water",
    dependents: "Rescue boat teams and shelter coordinators",
    deadlineReason:
      "Rescue boats are sent out in 12-hour shifts. A map that arrives within 12 hours guides the next shift.",
    constraintReasons: {
      budget: "Federal disaster funding makes a bigger budget available, but cloud-piercing sensors are expensive.",
      mass: "A larger rocket is available, because sensors that see through clouds are heavy.",
      duration: "Flood water drains slowly, so the mission lasts a full week.",
    },
    obstacle: "Storm clouds cover the city most of the time.",
    hint: "Ordinary cameras can't see through clouds. Radar can.",
  },
  phoenix: {
    slug: "phoenix",
    alert: "Extreme heat alert: Phoenix",
    headline: "A deadly heat wave is hitting Phoenix.",
    situation: [
      "Phoenix is in a heat wave, and some neighborhoods are far hotter than others.",
      "The city has only a limited number of cooling centers and water stations to send out.",
      "Your satellite has to find the hottest neighborhoods so help goes where people need it most.",
    ],
    goal: "Find the hottest neighborhoods accurately and report them within 24 hours.",
    hazardNoun: "extreme heat",
    dependents: "City cooling-center and water-station teams",
    deadlineReason:
      "Heat builds over days, so there is time to measure carefully. Accuracy matters more than raw speed.",
    constraintReasons: {
      budget: "This is a city program, so the budget is the smallest of the three missions.",
      mass: "A shared rideshare launch is used, so the satellite must be small.",
      duration: "The heat wave is forecast to last over a week, so the mission runs longer.",
    },
    obstacle: "Skies are mostly clear, but some neighborhoods are only slightly hotter than others.",
    hint: "Heat sensors measure surface temperature. Sharp detail separates one block from the next.",
  },
};

Object.assign(missionStories, groupAStories, groupBStories);

export function getMissionStory(slug: string): MissionStory | undefined {
  return missionStories[slug];
}

export const categoryLabel: Record<Category, string> = {
  wildfire: "Wildfire",
  heat: "Extreme heat",
  flood: "Flood",
  snow: "Snow",
  drought: "Drought",
  storm: "Storm",
  glacier: "Glacier",
  volcano: "Volcano",
};
