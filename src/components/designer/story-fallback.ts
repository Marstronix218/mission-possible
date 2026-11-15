import { getMissionStory, type MissionStory } from "@/lib/story/missions";
import type { Mission } from "@/types/game";
import { hazardCopy } from "./hazard-copy";

/**
 * Keep the goal sentence in step with the mission's real deadline: rewrite any
 * "within N hours" phrase to targetResponseHours, or append the deadline.
 */
export function goalWithDeadline(goal: string, hours: number): string {
  const phrase = /within\s+\d+(?:\.\d+)?\s*(?:-\s*)?hours?/i;
  if (phrase.test(goal)) return goal.replace(phrase, `within ${hours} hours`);
  const sentence = goal.trim().replace(/[.!]$/, "");
  return `${sentence}. Deliver the first data within ${hours} hours.`;
}

/** The mission's story (with a deadline-safe goal), or a neutral version built from mission data. */
export function storyFor(mission: Mission): MissionStory {
  const hours = mission.targetResponseHours;
  const copy = hazardCopy[mission.category];
  const story = getMissionStory(mission.slug) ?? {
    slug: mission.slug,
    alert: `${copy ? copy.label[0].toUpperCase() + copy.label.slice(1) : "Hazard"} alert: ${mission.city}`,
    headline: `${mission.city} needs eyes in space.`,
    situation: [mission.objective.en],
    goal: mission.objective.en,
    hazardNoun: copy?.noun ?? "hazard",
    dependents: "Emergency teams",
    deadlineReason: `Data that arrives after ${hours} hours is too late to help.`,
    constraintReasons: {
      budget: "This is the money available for this mission.",
      mass: "This is the most the available rocket can lift.",
      duration: "This is how long the satellite watches the area.",
    },
    obstacle: copy ? `${copy.veil[0].toUpperCase() + copy.veil.slice(1)} can block the view.` : "",
    hint: "Choose a sensor that can see this kind of hazard.",
  };
  return { ...story, goal: goalWithDeadline(story.goal, hours) };
}
