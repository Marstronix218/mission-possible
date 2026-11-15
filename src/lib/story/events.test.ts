import { describe, expect, it } from "vitest";
import { getMission, defaultDesign } from "@/components/results/missions";
import { runSimulation, summarizeResources } from "@/lib/sim";
import type { Mission, SatelliteDesign } from "@/types/game";
import {
  buildMissionStory,
  describeDesignChanges,
  diagnoseMission,
  outcomeHeadline,
  suggestNextStep,
} from "./events";

function play(mission: Mission, design: SatelliteDesign) {
  const resources = summarizeResources(design, mission.defaultConstraints);
  const result = runSimulation(mission, design, mission.defaultConstraints);
  return {
    resources,
    result,
    events: buildMissionStory(mission, design, resources, result),
    diagnosis: diagnoseMission(mission, design, resources, result),
  };
}

const phoenix = getMission("phoenix")!;
const losAngeles = getMission("los-angeles")!;
const weakComms: SatelliteDesign = { ...defaultDesign, comm: "uhf", groundStations: 1 };

describe("buildMissionStory", () => {
  it("narrates a strong design that meets the deadline", () => {
    const { result, events, diagnosis } = play(phoenix, defaultDesign);
    expect(result.firstDeliveryHours).not.toBeNull();
    expect(result.firstDeliveryHours!).toBeLessThanOrEqual(phoenix.targetResponseHours);
    expect(diagnosis.met).toBe(true);
    expect(diagnosis.lateCause).toBeUndefined();

    const downlink = events.find((e) => e.kind === "downlink")!;
    expect(downlink.tone).toBe("good");
    expect(downlink.hour).toBe(result.firstDeliveryHours);
    expect(downlink.timing).toBe("engine");
    expect(events.find((e) => e.kind === "deadline")!.tone).toBe("good");

    const detect = events.find((e) => e.kind === "detect")!;
    expect(detect.timing).toBe("derived");
    expect(detect.hour).toBeLessThanOrEqual(downlink.hour);

    expect(events[0].kind).toBe("launch");
    expect(events[events.length - 1].kind).toBe("outcome");
    expect(outcomeHeadline(phoenix, diagnosis).tone).toBe("good");
    expect(outcomeHeadline(phoenix, diagnosis).sentence).toContain(`hour ${result.firstDeliveryHours}`);
  });

  it("blames the slow radio when weak comms make the data late", () => {
    for (const mission of [phoenix, losAngeles]) {
      const { resources, result, events, diagnosis } = play(mission, weakComms);
      expect(resources.violations).toEqual([]);
      expect(result.firstDeliveryHours!).toBeGreaterThan(mission.targetResponseHours);
      expect(diagnosis.met).toBe(false);
      expect(diagnosis.lateCause).toBe("comm");
      // Same formula the engine uses for downlink latency.
      expect(diagnosis.radioDelayHours).toBeCloseTo((resources.dataGBPerDay / resources.downlinkGBPerDay) * 24, 5);

      const downlink = events.find((e) => e.kind === "downlink")!;
      expect(downlink.tone).toBe("bad");
      expect(downlink.causeSlot).toBe("comm");
      expect(downlink.causePartId).toBe("uhf");
      expect(downlink.detail).toContain("UHF radio");

      const deadline = events.find((e) => e.kind === "deadline")!;
      expect(deadline.tone).toBe("bad");
      expect(deadline.hour).toBe(mission.targetResponseHours);

      const launchProblem = events.find((e) => e.id === "downlink-tight")!;
      expect(launchProblem.launchStage).toBe("contact");
      expect(launchProblem.causeSlot).toBe("comm");

      expect(outcomeHeadline(mission, diagnosis).sentence).toMatch(/hours late/);
      const next = suggestNextStep(mission, weakComms, result, diagnosis);
      expect(next.metric).toBe("responseTime");
      expect(next.slot).toBe("comm");
      expect(next.suggestedPartId).toBe("s_band");
    }
  });

  it("orders events by time and keeps whole-mission summaries last", () => {
    const { events } = play(losAngeles, weakComms);
    const timed = events.filter((e) => e.timing !== "mission");
    for (let i = 1; i < timed.length; i += 1) expect(timed[i].hour).toBeGreaterThanOrEqual(timed[i - 1].hour);
    const firstSummary = events.findIndex((e) => e.timing === "mission");
    expect(events.slice(firstSummary).every((e) => e.timing === "mission")).toBe(true);
    for (const e of events.filter((e) => e.tone === "bad" && e.kind !== "outcome")) expect(e.causeSlot).toBeDefined();
  });

  it("is deterministic", () => {
    expect(play(losAngeles, weakComms).events).toEqual(play(losAngeles, weakComms).events);
  });

  it("flags a sensor that cannot see the hazard", () => {
    const { events, diagnosis } = play(losAngeles, { ...defaultDesign, instruments: ["msi"] });
    expect(diagnosis.bestFit).toBeLessThan(0.5);
    expect(events.find((e) => e.id === "sensor-blind")?.causeSlot).toBe("instruments");
  });
});

describe("describeDesignChanges", () => {
  it("lists changed parts with readable names", () => {
    expect(describeDesignChanges(weakComms, defaultDesign)).toEqual([
      "Radio: UHF radio → X-band radio",
      "Ground stations: 1 ground station → 3 ground stations",
    ]);
  });
});
