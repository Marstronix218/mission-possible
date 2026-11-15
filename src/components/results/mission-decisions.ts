// Copy and "what changed" notes for the in-mission decisions. Pure. Effect
// sizes come from the engine's DECISION_EFFECTS; before/after numbers come from
// the two engine results (without and with the decision).
import type { MissionDecisions, SimResult } from "@/types/game";
import { DECISION_EFFECTS } from "@/lib/sim";
import type { DecisionOption } from "./DecisionPrompt";
import { quadrantName, type CheckpointId, type RetaskOffer } from "./mission-playback";

const pct = (n: number) => `${Math.round(n * 100)}%`;
const E = DECISION_EFFECTS;

export interface DecisionCopy {
  alarm?: string;
  title: string;
  subtitle?: string;
  options: DecisionOption[];
}

export function decisionCopy(id: CheckpointId, hazard: string, offer: RetaskOffer | null): DecisionCopy {
  if (id === "focus")
    return {
      title: "Orbit reached! Where do we point?",
      options: [
        { id: "wide", icon: "🌐", title: "Wide scan", text: "Even looks across the whole map" },
        { id: "hazard", icon: "🎯", title: "Hazard focus", text: `More looks at likely ${hazard}, fewer elsewhere` },
      ],
    };
  if (id === "downlink")
    return {
      title: "How do we send data home?",
      options: [
        { id: "fast", icon: "🚀", title: "Fast", text: "Send at every contact — uses more power" },
        { id: "save-power", icon: "🔋", title: "Save power", text: "Batch data — slower, saves battery" },
      ],
    };
  const q = offer ? quadrantName[offer.quadrant] : "";
  return {
    alarm: "📣 NEW OBSERVATION REQUEST",
    title:
      offer?.reason === "new-hazard"
        ? `New ${hazard} reported in the ${q}!`
        : `${offer?.cells ?? 0} danger zones in the ${q} still unconfirmed!`,
    subtitle: "Retask the satellite to that corner from today?",
    options: [
      { id: "retask", icon: "↗️", title: `Retask to ${q}`, text: "More looks there, fewer everywhere else" },
      { id: "stay", icon: "➡️", title: "Stay the course", text: "Keep looking across the map" },
    ],
  };
}

/** Apply one answer to the decisions object. */
export function applyDecision(
  decisions: MissionDecisions,
  id: CheckpointId,
  choice: string,
  offer: RetaskOffer | null,
): MissionDecisions {
  if (id === "focus") return { ...decisions, focus: choice === "hazard" ? "hazard" : "wide" };
  if (id === "downlink") return { ...decisions, downlink: choice === "fast" ? "fast" : "save-power" };
  if (choice === "retask" && offer) return { ...decisions, retask: { day: offer.day, quadrant: offer.quadrant } };
  const { retask: _drop, ...rest } = decisions;
  void _drop;
  return rest;
}

/** One-line note of what the decision changed, using only engine numbers. */
export function describeChange(
  id: CheckpointId,
  choice: string,
  before: SimResult,
  after: SimResult,
  offer: RetaskOffer | null,
): string {
  if (id === "focus")
    return choice === "hazard"
      ? `Danger zones get ×${E.hazardFocusTargetBoost} look chance, the rest of the map ×${E.hazardFocusBackgroundFactor}.`
      : "Looks stay spread evenly across the map.";
  if (id === "downlink") {
    const b = before.diagnostics;
    const a = after.diagnostics;
    if (!b || !a) return choice === "fast" ? "Data is sent at every contact." : "Data is batched to save power.";
    const parts = [`Radio delay ${b.downlinkLatencyHours} h → ${a.downlinkLatencyHours} h`];
    if (a.powerMargin !== b.powerMargin) parts.push(`power margin ${pct(b.powerMargin)} → ${pct(a.powerMargin)}`);
    if (a.batteryContinuity !== b.batteryContinuity)
      parts.push(`work in Earth's shadow ${pct(b.batteryContinuity)} → ${pct(a.batteryContinuity)}`);
    return parts.join(" · ") + ".";
  }
  if (choice === "retask" && offer)
    return `From day ${offer.day + 1}: ${quadrantName[offer.quadrant]} gets ×${E.retaskInsideBoost} look chance (cleared cells rechecked), elsewhere ×${E.retaskOutsideFactor}.`;
  return "Plan unchanged — looks stay spread across the map.";
}
