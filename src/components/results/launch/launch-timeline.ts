// Pure timing and scene-state logic for the launch cinematic. Presentational only:
// nothing here reads or changes the simulation, its score, or saved attempts.
import { partCopy } from "@/components/designer/builder-copy";
import { findPart, partsCatalog } from "@/lib/sim/catalog";

export type LaunchPhaseId = "integrate" | "launch" | "deploy" | "observe";

export const LAUNCH_PHASES: { id: LaunchPhaseId; label: string }[] = [
  { id: "integrate", label: "Satellite integration" },
  { id: "launch", label: "Launch" },
  { id: "deploy", label: "Deployment" },
  { id: "observe", label: "Begin observation" },
];

export type LaunchStepId =
  | "load"
  | "encapsulate"
  | "pad"
  | "t3"
  | "t2"
  | "t1"
  | "ignition"
  | "liftoff"
  | "ascent"
  | "space"
  | "fairing-sep"
  | "sat-sep"
  | "panels"
  | "orbit"
  | "target";

export interface LaunchStep {
  id: LaunchStepId;
  phase: LaunchPhaseId;
  title: string;
  caption: string;
  /** How long the step holds before advancing when motion is allowed. */
  durationMs: number;
  /** Countdown digit shown on screen, if any. */
  countdown?: 3 | 2 | 1;
}

/** Plain-language name of the player's orbit, e.g. "Sun-synchronous orbit (about 700 km up)". */
export function orbitLabel(orbitId: string): string {
  const copy = partCopy[orbitId]?.science;
  if (copy) return copy;
  const part = findPart(partsCatalog.orbits, orbitId);
  return part ? `${part.name} orbit` : "its planned orbit";
}

export function buildLaunchSteps({
  orbit,
  city,
}: {
  orbit: string;
  city: string;
}): LaunchStep[] {
  const orbitName = orbitLabel(orbit);
  const lowerOrbit = orbitName.charAt(0).toLowerCase() + orbitName.slice(1);
  return [
    {
      id: "load",
      phase: "integrate",
      title: "Payload loaded",
      caption:
        "Your finished satellite is lowered onto the rocket, solar wings folded tight.",
      durationMs: 1700,
    },
    {
      id: "encapsulate",
      phase: "integrate",
      title: "Fairing closed",
      caption:
        "The nose-cone fairing closes around it to shield it from wind and heat.",
      durationMs: 1400,
    },
    {
      id: "pad",
      phase: "integrate",
      title: "Rocket on the pad",
      caption: "Fuelled and upright. The launch team clears the pad.",
      durationMs: 1100,
    },
    {
      id: "t3",
      phase: "launch",
      title: "T-minus 3",
      caption: "Countdown: 3",
      durationMs: 900,
      countdown: 3,
    },
    {
      id: "t2",
      phase: "launch",
      title: "T-minus 2",
      caption: "Countdown: 2",
      durationMs: 900,
      countdown: 2,
    },
    {
      id: "t1",
      phase: "launch",
      title: "T-minus 1",
      caption: "Countdown: 1",
      durationMs: 900,
      countdown: 1,
    },
    {
      id: "ignition",
      phase: "launch",
      title: "Engine ignition",
      caption:
        "The engines light. Thrust builds until it is stronger than the rocket's weight.",
      durationMs: 1200,
    },
    {
      id: "liftoff",
      phase: "launch",
      title: "Liftoff",
      caption: "The clamps let go and the rocket climbs off the pad.",
      durationMs: 1400,
    },
    {
      id: "ascent",
      phase: "launch",
      title: "Climbing through the atmosphere",
      caption:
        "The air thins with height, so the sky darkens from blue toward black.",
      durationMs: 2000,
    },
    {
      id: "space",
      phase: "launch",
      title: "Reaching space",
      caption:
        "Above almost all of the air, the sky is black and Earth's curve appears.",
      durationMs: 1400,
    },
    {
      id: "fairing-sep",
      phase: "deploy",
      title: "Fairing separation",
      caption:
        "No air is left to push against, so the fairing halves split away.",
      durationMs: 1400,
    },
    {
      id: "sat-sep",
      phase: "deploy",
      title: "Satellite separation",
      caption:
        "Springs push your satellite gently away from the rocket's upper stage.",
      durationMs: 1400,
    },
    {
      id: "panels",
      phase: "deploy",
      title: "Solar panels deployed",
      caption: "The solar wings unfold and start turning sunlight into power.",
      durationMs: 1500,
    },
    {
      id: "orbit",
      phase: "deploy",
      title: "Operational orbit",
      caption: `Your satellite settles into ${lowerOrbit}.`,
      durationMs: 1800,
    },
    {
      id: "target",
      phase: "observe",
      title: `Turning toward ${city}`,
      caption: `Its first pass heads for ${city}. Observation begins.`,
      durationMs: 1700,
    },
  ];
}

export function phaseIndexOf(phase: LaunchPhaseId): number {
  return LAUNCH_PHASES.findIndex((p) => p.id === phase);
}

/** Total autoplay length, for tests and copy ("about 20 seconds"). */
export function totalDurationMs(steps: LaunchStep[]): number {
  return steps.reduce((sum, step) => sum + step.durationMs, 0);
}

/**
 * Delay before the step at `index` advances, or null when nothing should
 * advance on its own (reduced motion is a manual step-through).
 */
export function autoAdvanceDelay(
  steps: LaunchStep[],
  index: number,
  reducedMotion: boolean,
): number | null {
  if (reducedMotion) return null;
  const step = steps[index];
  return step ? step.durationMs : null;
}

export type PhaseState = "done" | "current" | "upcoming";

export function phaseStates(
  steps: LaunchStep[],
  index: number,
): PhaseState[] {
  const current = index < 0 ? -1 : phaseIndexOf(steps[index].phase);
  return LAUNCH_PHASES.map((_, i) =>
    current < 0 || i > current ? "upcoming" : i < current ? "done" : "current",
  );
}

/** What the scene shows at a step. `index` -1 is the "ready for launch" frame. */
export interface SceneState {
  satelliteLoaded: boolean;
  fairingClosed: boolean;
  engines: "off" | "ignite" | "burn";
  /** Vertical offset of the rocket in scene units (negative = up). */
  rocketY: number;
  /** 0 = ground level sky, 1 = black space. */
  altitude: number;
  groundGone: boolean;
  fairingSeparated: boolean;
  satelliteFree: boolean;
  panelsOpen: boolean;
  inOrbit: boolean;
  onTarget: boolean;
}

export function sceneState(steps: LaunchStep[], index: number): SceneState {
  const at = (id: LaunchStepId) =>
    index >= steps.findIndex((s) => s.id === id);
  const reached = (id: LaunchStepId) => index >= 0 && at(id);
  const lifted = reached("liftoff");
  const ascending = reached("ascent");
  return {
    satelliteLoaded: reached("load"),
    fairingClosed: reached("encapsulate") && !reached("fairing-sep"),
    engines: reached("fairing-sep")
      ? "off"
      : lifted
        ? "burn"
        : reached("ignition")
          ? "ignite"
          : "off",
    rocketY: ascending ? -84 : lifted ? -60 : 0,
    altitude: reached("space") ? 1 : ascending ? 0.6 : 0,
    groundGone: ascending,
    fairingSeparated: reached("fairing-sep"),
    satelliteFree: reached("sat-sep"),
    panelsOpen: reached("panels"),
    inOrbit: reached("orbit"),
    onTarget: reached("target"),
  };
}
