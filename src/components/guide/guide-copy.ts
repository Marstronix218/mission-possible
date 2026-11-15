// Single home for the mission guide's voice: the tutorial screens and the
// one-line instruction shown at every step. Tone: a real person beside you —
// warm, short sentences, never robotic or childish. Pure data, no React.

export type GuideStage =
  | "map"
  | "brief"
  | "workshop"
  | "sensor"
  | "orbit"
  | "power"
  | "comm"
  | "resources"
  | "launch"
  | "blocked"
  | "observe"
  | "results";

/** One short instruction per screen. */
export const stageLines: Record<GuideStage, string> = {
  map: "Hi, I'm Nova! Look around the world map and pick a place that needs your help.",
  brief:
    "Here's the situation. Read what's happening, then let's build a satellite that can help.",
  workshop:
    "Alright, let's build your satellite! First, we need to give it eyes. Pick a sensor that can help you observe your mission location.",
  sensor:
    "Want to see heat from space? A thermal sensor can do that! Every sensor sees something different, and some need more power than others.",
  orbit:
    "Now let's decide where your satellite will fly! Your orbit affects how often you can observe your target.",
  power:
    "Nice! Now your satellite needs energy. Choose solar panels and a battery to keep everything running.",
  comm: "Your satellite can collect information, but how will it send it back to Earth? Let's choose an antenna and radio.",
  resources:
    "Watch your budget, weight, and power! Every upgrade comes with a trade-off.",
  launch:
    "Your satellite is ready! Let's send it into space and see how your design performs.",
  blocked:
    "Hold on! Your design still breaks one of the limits. Head back to the workshop and fix it before launch.",
  observe:
    "Here comes your target! Watch as your satellite collects information about the area.",
  results:
    "Mission complete! Let's see what worked, what didn't, and what you can improve next time.",
};

export const guideName = "Nova";
export const guideRole = "Mission guide";

export interface TutorialStep {
  id: "choose" | "build" | "plan" | "launch" | "learn";
  title: string;
  text: string;
}

export const tutorialIntro = {
  title: "WELCOME TO MISSION: POSSIBLE!",
  text: "You're about to become a space mission designer!",
  start: "Show me how",
};

export const tutorialSteps: TutorialStep[] = [
  {
    id: "choose",
    title: "Choose Your Mission",
    text: "Explore the world map and choose a place that needs your help.",
  },
  {
    id: "build",
    title: "Build Your Satellite",
    text: "Pick up different parts and build a satellite that can collect the information your mission needs.",
  },
  {
    id: "plan",
    title: "Plan Your Mission",
    text: "Choose your orbit, manage your budget, and make sure your satellite has enough power.",
  },
  {
    id: "launch",
    title: "Launch and Observe",
    text: "Launch your satellite and see what it can discover about Earth.",
  },
  {
    id: "learn",
    title: "Learn and Improve",
    text: "Check your mission results, discover what worked, and improve your satellite to earn a higher score!",
  },
];

export const tutorialFinish = "Let's go!";
