import type { PartSlot } from "@/lib/story/parts";
import type { SatelliteDesign } from "@/types/game";
import { slotFilled, type StageId } from "./builder-model";
export const workshopDecisions: {
  slot: PartSlot | "review";
  stage: StageId;
  title: string;
  label: string;
  task: string;
  concepts: string[];
}[] = [
  {
    slot: "instruments",
    label: "Sensors",
    stage: "eyes",
    title: "Choose what you can see",
    task: "Choose sensors that can observe the mission’s target.",
    concepts: ["Detection", "Clouds & smoke", "Observation detail"],
  },
  {
    slot: "orbit",
    label: "Orbit",
    stage: "orbit",
    title: "Choose where you fly",
    task: "Choose an orbit to balance detail, coverage and return visits.",
    concepts: ["Altitude", "Target visibility", "Return visits"],
  },
  {
    slot: "solar",
    label: "Solar panels",
    stage: "power",
    title: "Give your spacecraft power",
    task: "Choose solar panels to supply electricity for your installed equipment.",
    concepts: ["Sunlight → electricity", "Power in W", "Mass & budget"],
  },
  {
    slot: "battery",
    label: "Battery",
    stage: "power",
    title: "Keep working in shadow",
    task: "Choose a battery to maintain operations when Earth blocks sunlight.",
    concepts: ["Sunlit charging", "Eclipse operation", "Continuity"],
  },
  {
    slot: "storage",
    label: "Storage",
    stage: "power",
    title: "Keep observations onboard",
    task: "Choose memory to hold data between opportunities to transmit it.",
    concepts: ["Data collected", "Storage in GB", "Downlink later"],
  },
  {
    slot: "comm",
    label: "Radio",
    stage: "radio",
    title: "Send observations to Earth",
    task: "Choose a radio to transmit your observations during ground contact.",
    concepts: ["Data rate", "Power demand", "Delivered data"],
  },
  {
    slot: "groundStations",
    label: "Ground stations",
    stage: "radio",
    title: "Make contact with the ground",
    task: "Choose a ground-station network to change daily contact time.",
    concepts: ["Contact windows", "Network cost", "Daily capacity"],
  },
  {
    slot: "review",
    label: "Review",
    stage: "review",
    title: "Review your mission design",
    task: "Check your spacecraft and prepare for launch.",
    concepts: ["Resource limits", "Mission risks", "Launch readiness"],
  },
];
export function decisionComplete(
  design: SatelliteDesign,
  index: number,
): boolean {
  const d = workshopDecisions[index];
  return d?.slot === "review"
    ? workshopDecisions
        .slice(0, -1)
        .every((_, i) => decisionComplete(design, i))
    : !!d && slotFilled(design, d.slot);
}
export function decisionForSlot(slot: PartSlot) {
  return Math.max(
    0,
    workshopDecisions.findIndex((d) => d.slot === slot),
  );
}
export function firstUnfinishedDecision(design: SatelliteDesign) {
  const i = workshopDecisions.findIndex((_, i) => !decisionComplete(design, i));
  return i < 0 ? workshopDecisions.length - 1 : i;
}
