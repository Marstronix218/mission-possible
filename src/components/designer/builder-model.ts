// Pure logic for the visual satellite builder: stages, retry highlights and the
// at-a-glance gauges. No React, so it is easy to test.
import { partsCatalog } from "@/lib/sim/catalog";
import type { PartSlot } from "@/lib/story/parts";
import type { Constraints, ResourceSummary, SatelliteDesign } from "@/types/game";

export const MAX_INSTRUMENTS = 3;
export const COVERAGE_TARGET = 50;
export const stationCounts = [1, 3, 5] as const;

export type StageId = "eyes" | "orbit" | "radio" | "power";

export interface Stage {
  id: StageId;
  /** Short tab label. */
  label: string;
  icon: string;
  /** One-line question shown above the parts. */
  prompt: string;
  slots: PartSlot[];
}

/** Most meaningful choice first; engineering details come later. */
export const stages: Stage[] = [
  { id: "eyes", label: "Eyes", icon: "👁️", prompt: "What should it look with?", slots: ["instruments"] },
  { id: "orbit", label: "Orbit", icon: "🪐", prompt: "Where should it fly?", slots: ["orbit"] },
  { id: "radio", label: "Radio", icon: "📡", prompt: "How does data get home?", slots: ["comm", "groundStations"] },
  { id: "power", label: "Power", icon: "⚡", prompt: "Keep it powered and remembering.", slots: ["solar", "battery", "storage"] },
];

const allSlots: PartSlot[] = ["instruments", "orbit", "solar", "battery", "comm", "groundStations", "storage"];

export function stageOfSlot(slot: PartSlot): StageId {
  return stages.find((stage) => stage.slots.includes(slot))?.id ?? "eyes";
}

export function slotFilled(design: SatelliteDesign, slot: PartSlot): boolean {
  if (slot === "instruments") return design.instruments.length > 0;
  if (slot === "groundStations") return stationCounts.includes(design.groundStations);
  return Boolean(design[slot]);
}

export function stageComplete(design: SatelliteDesign, stage: StageId): boolean {
  return (stages.find((item) => item.id === stage)?.slots ?? []).every((slot) => slotFilled(design, slot));
}

/** A stage is open once every earlier stage is complete (or it already has parts). */
export function stageUnlocked(design: SatelliteDesign, stage: StageId): boolean {
  const index = stages.findIndex((item) => item.id === stage);
  return stages.slice(0, index).every((item) => stageComplete(design, item.id)) || stageComplete(design, stage);
}

/**
 * Slots the debrief asked the player to re-check, from `?fix=orbit,comm` and/or
 * `#slot-comm`. Unknown names are ignored; order follows the build order.
 */
export function parseFixSlots(fix?: string | string[] | null, hash?: string | null): PartSlot[] {
  const raw = [
    ...(Array.isArray(fix) ? fix : fix ? [fix] : []).flatMap((value) => value.split(",")),
    ...(hash?.startsWith("#slot-") ? [hash.slice("#slot-".length)] : []),
  ].map((value) => value.trim());
  return allSlots.filter((slot) => raw.includes(slot));
}

export type GaugeStatus = "ok" | "risky" | "over" | "waiting";
export type GaugeKey = "budget" | "weight" | "power" | "data";

export interface Gauge {
  key: GaugeKey;
  label: string;
  icon: string;
  status: GaugeStatus;
  /** 0..1 bar fill. */
  fill: number;
  /** Exact numbers, shown only on demand. */
  numbers: string;
  /** Short line for "waiting" gauges. */
  hint?: string;
}

const clamp = (value: number) => Math.min(1, Math.max(0, value));

export function ratioStatus(value: number, limit: number, riskyAt: number): GaugeStatus {
  if (limit <= 0) return value > 0 ? "over" : "waiting";
  if (value > limit) return "over";
  return value / limit >= riskyAt ? "risky" : "ok";
}

/**
 * Budget and weight always show. Power appears once something draws power beyond
 * the bare satellite; data appears once a sensor makes data. Thresholds match the
 * engine's warnings (85% power, 80% downlink).
 */
export function buildGauges(design: SatelliteDesign, resources: ResourceSummary, constraints: Constraints): Gauge[] {
  const gauges: Gauge[] = [
    {
      key: "budget", label: "Budget", icon: "💰",
      status: ratioStatus(resources.costM, constraints.budgetM, 0.9),
      fill: clamp(resources.costM / constraints.budgetM),
      numbers: `$${resources.costM}M of $${constraints.budgetM}M`,
    },
    {
      key: "weight", label: "Weight", icon: "🚀",
      status: ratioStatus(resources.massKg, constraints.massKg, 0.9),
      fill: clamp(resources.massKg / constraints.massKg),
      numbers: `${resources.massKg} kg of ${constraints.massKg} kg`,
    },
  ];

  if (resources.powerUseW > partsCatalog.bus.powerW) {
    gauges.push(design.solar
      ? {
          key: "power", label: "Power", icon: "⚡",
          status: ratioStatus(resources.powerUseW, resources.powerGenW, 0.85),
          fill: clamp(resources.powerUseW / resources.powerGenW),
          numbers: `Needs ${resources.powerUseW} W · panels make ${resources.powerGenW} W`,
        }
      : {
          key: "power", label: "Power", icon: "⚡", status: "waiting", fill: 0,
          numbers: `Needs ${resources.powerUseW} W`, hint: "Add solar wings",
        });
  }

  if (resources.dataGBPerDay > 0) {
    if (!design.comm) {
      gauges.push({
        key: "data", label: "Data", icon: "📡", status: "waiting", fill: 0,
        numbers: `Makes ${resources.dataGBPerDay} GB/day`, hint: "Add a radio",
      });
    } else {
      const capacity = resources.downlinkGBPerDay + resources.storageGB;
      const utilisation = resources.downlinkGBPerDay > 0 ? resources.dataGBPerDay / resources.downlinkGBPerDay : 1;
      const status: GaugeStatus = resources.dataGBPerDay > capacity ? "over"
        : utilisation >= 0.8 || (resources.storageGB > 0 && resources.dataGBPerDay > resources.storageGB) ? "risky" : "ok";
      gauges.push({
        key: "data", label: "Data", icon: "📡", status, fill: clamp(utilisation),
        numbers: `Makes ${resources.dataGBPerDay} GB/day · sends ${resources.downlinkGBPerDay} GB/day` +
          (resources.storageGB ? ` · holds ${resources.storageGB} GB` : ""),
      });
    }
  }
  return gauges;
}

/** Short, plain reasons the satellite can't launch yet (engine violations translated). */
export function blockerMessages(violations: string[]): string[] {
  const map: Record<string, string> = {
    "Select at least one instrument.": "Pick at least one sensor",
    "Select a valid orbit.": "Pick an orbit",
    "Select a valid solar array.": "Add solar wings",
    "Select a valid battery.": "Add a battery",
    "Select a valid communication system.": "Pick a radio",
    "Select a valid storage system.": "Add memory",
    "Budget limit exceeded.": "Too expensive: swap in cheaper parts",
    "Mass limit exceeded.": "Too heavy for the rocket",
    "Power demand exceeds solar generation.": "Panels can't power everything",
    "Daily data exceeds downlink and storage capacity.": "More data than the radio and memory can handle",
  };
  return violations.map((message) => map[message] ?? message);
}

/** Relative 1–3 level of a value among the catalog options of one slot. */
export function level(value: number, options: number[]): 1 | 2 | 3 {
  const low = Math.min(...options);
  const high = Math.max(...options);
  if (high === low) return 2;
  const ratio = (value - low) / (high - low);
  return ratio < 0.34 ? 1 : ratio < 0.67 ? 2 : 3;
}

/** Plain words for the orbit trade-offs, from the catalog factors. */
export function orbitTraits(orbit: { revisitFactor: number; swathFactor: number; resolutionFactor: number }) {
  return {
    detail: orbit.resolutionFactor > 1.1 ? 4 : orbit.resolutionFactor >= 0.9 ? 3 : orbit.resolutionFactor >= 0.5 ? 2 : 1,
    width: orbit.swathFactor >= 2 ? 4 : orbit.swathFactor > 1 ? 3 : orbit.swathFactor === 1 ? 2 : 1,
    visits: orbit.revisitFactor <= 0.2 ? 4 : orbit.revisitFactor < 1 ? 3 : orbit.revisitFactor === 1 ? 2 : 1,
    visitsWord: orbit.revisitFactor <= 0.2 ? "Never leaves" : orbit.revisitFactor < 1 ? "Often" : orbit.revisitFactor === 1 ? "Regularly" : "Less often",
  };
}
