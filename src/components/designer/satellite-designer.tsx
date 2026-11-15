"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type ReactNode } from "react";
import { useStore } from "zustand";
import { Button } from "@/components/ui/button";
import { MissionSteps } from "@/components/story/MissionSteps";
import { partsCatalog } from "@/lib/sim/catalog";
import { summarizeResources } from "@/lib/sim/resources";
import { groundStationExplainers, instrumentFit, partExplainers, slotExplainers, type PartSlot } from "@/lib/story/parts";
import { createDesignStore } from "@/stores/design";
import { draftKey } from "@/components/results/session";
import type { InstrumentPart, Mission, OrbitPart, SatelliteDesign } from "@/types/game";
import { hazardCopy } from "./hazard-copy";
import { PartCard } from "./PartCard";
import { SatelliteVisual } from "./SatelliteVisual";
import { SensorViewPreview } from "./SensorViewPreview";
import { storyFor } from "./story-fallback";

const MAX_INSTRUMENTS = 3;
const COVERAGE_TARGET = 50;
const stationCounts = [1, 3, 5] as const;

const money = (value: number) => `$${value}M`;

function detailWords(score: number) {
  if (score >= 0.9) return "Sharp detail";
  if (score >= 0.7) return "Good detail";
  if (score >= 0.45) return "Medium detail";
  return "Blurry";
}

function orbitWords(orbit: OrbitPart) {
  const revisit = orbit.revisitFactor <= 0.2 ? "Stays over the city" : orbit.revisitFactor < 1 ? "Passes often"
    : orbit.revisitFactor === 1 ? "Passes regularly" : "Passes less often";
  const swath = orbit.swathFactor >= 2 ? "Huge view" : orbit.swathFactor > 1 ? "Wide strip"
    : orbit.swathFactor === 1 ? "Medium strip" : "Narrow strip";
  const detail = orbit.resolutionFactor > 1.1 ? "Sharpest detail" : orbit.resolutionFactor >= 0.9 ? "Good detail"
    : orbit.resolutionFactor >= 0.5 ? "Less detail" : "Very blurry";
  return [revisit, swath, detail];
}

function downlinkGB(rateGbps: number, stations: SatelliteDesign["groundStations"]) {
  return Math.round(rateGbps * 0.125 * partsCatalog.groundStations[stations].accessMinutesPerDay * 60);
}

function BuildStep({ number, slot, done, children, extraSlot }: {
  number: number; slot: PartSlot; done: boolean; children: ReactNode; extraSlot?: PartSlot;
}) {
  const headingId = useId();
  const slots = extraSlot ? [slot, extraSlot] : [slot];
  return (
    <section id={`slot-${slot}`} aria-labelledby={headingId} className="scroll-mt-24 rounded-xl border border-border bg-background/40 p-4 sm:p-5">
      {extraSlot && <span id={`slot-${extraSlot}`} className="block scroll-mt-24" aria-hidden="true" />}
      <header className="flex items-start gap-3">
        <span aria-hidden="true"
          className={"flex size-9 shrink-0 items-center justify-center rounded-full border-2 font-bold " +
            (done ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
          {done ? "✓" : number}
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={headingId} className="text-xl font-bold">
            <span className="sr-only">Step {number}: </span>
            {slots.map((item) => slotExplainers[item].title).join(" + ")}
            <span className={"ml-2 align-middle text-xs font-semibold " + (done ? "text-primary" : "text-muted-foreground")}>
              {done ? "✓ Done" : "To do"}
            </span>
          </h2>
          <p className="mt-1 font-medium">{slotExplainers[slot].question}</p>
          <p className="mt-1 text-sm text-muted-foreground">{slots.map((item) => slotExplainers[item].why).join(" ")}</p>
        </div>
      </header>
      <div className="mt-4 space-y-5">{children}</div>
    </section>
  );
}

function CardGroup({ legend, children }: { legend?: string; children: ReactNode }) {
  return (
    <fieldset className="min-w-0">
      {legend && <legend className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{legend}</legend>}
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

type Status = "ok" | "tight" | "over" | "missing";

const statusLabel: Record<Status, { icon: string; text: string; bar: string }> = {
  ok: { icon: "✓", text: "OK", bar: "bg-emerald-400" },
  tight: { icon: "⚠", text: "Tight", bar: "bg-amber-300" },
  over: { icon: "✕", text: "Over limit", bar: "bg-destructive" },
  missing: { icon: "○", text: "Not set", bar: "bg-muted-foreground" },
};

function CheckRow({ label, status, fill, text }: { label: string; status: Status; fill: number; text: string }) {
  const style = statusLabel[status];
  return (
    <li className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-semibold">{label}</span>
        <span className="text-xs font-semibold"><span aria-hidden="true">{style.icon}</span> {style.text}</span>
      </div>
      <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={"h-full rounded-full " + style.bar} style={{ width: `${Math.round(Math.min(1, Math.max(0, fill)) * 100)}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">{text}</p>
    </li>
  );
}

export function SatelliteDesigner({ mission }: { mission: Mission }) {
  const router = useRouter();
  const groupId = useId();
  const blockersId = useId();
  const [store] = useState(() => createDesignStore(mission.slug));
  const [ready, setReady] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState("");
  const { design, update } = useStore(store);
  const story = storyFor(mission);
  const constraints = mission.defaultConstraints;
  const hours = mission.targetResponseHours;
  const resources = summarizeResources(design, constraints);

  useEffect(() => {
    async function restoreDraft() {
      try {
        await store.persist?.rehydrate();
      } catch {
        setError("The saved draft could not be loaded.");
      } finally {
        setReady(true);
      }
    }
    void restoreDraft();
  }, [store]);

  // Debrief "Change the radio →" links arrive with #slot-<slot>; scroll there once parts render.
  useEffect(() => {
    if (!ready || !window.location.hash.startsWith("#slot-")) return;
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [ready]);

  function select(field: "orbit" | "solar" | "battery" | "comm" | "storage") {
    return (id: string) => update({ [field]: id });
  }

  function toggleInstrument(id: string) {
    update({
      instruments: design.instruments.includes(id)
        ? design.instruments.filter((instrument) => instrument !== id)
        : [...design.instruments, id],
    });
  }

  function launch() {
    if (launching || !ready || resources.violations.length) return;
    setLaunching(true);
    setError("");
    try {
      localStorage.setItem(draftKey(mission.slug), JSON.stringify(design));
      router.push(`/mission/${mission.slug}/run`);
    } catch {
      setError("Your draft could not be prepared for launch. Enable browser storage and try again.");
      setLaunching(false);
    }
  }

  const fitLabel = (part: InstrumentPart) => {
    const fit = instrumentFit(part, mission.category);
    const copy = hazardCopy[mission.category];
    const base = (fit.verdict === "great" ? copy?.greatByKind?.[part.kind] : undefined) ?? copy?.fit[fit.verdict] ?? fit.label;
    const label = fit.verdict !== "blind" && part.cloudPenetrating ? `${base}, even through clouds` : base;
    return { verdict: fit.verdict, label };
  };
  const installedInstruments = partsCatalog.instruments.filter((part) => design.instruments.includes(part.id));
  const seesHazard = installedInstruments.some((part) => instrumentFit(part, mission.category).verdict !== "blind");

  // Translate the resource summary into consequences the player understands.
  const missingSlots: Record<string, string> = {
    "Select at least one instrument.": "Install at least one sensor (step 1).",
    "Select a valid orbit.": "Choose an orbit (step 2).",
    "Select a valid solar array.": "Choose a solar array (step 3).",
    "Select a valid battery.": "Choose a battery (step 3).",
    "Select a valid communication system.": "Choose a radio (step 4).",
    "Select a valid storage system.": "Choose storage (step 5).",
  };
  const consequenceOf = (message: string): string => {
    if (missingSlots[message]) return missingSlots[message];
    switch (message) {
      case "Budget limit exceeded.":
        return `Over budget by ${money(Math.round((resources.costM - constraints.budgetM) * 10) / 10)} → the mission can't pay for this satellite. Swap in cheaper parts.`;
      case "Mass limit exceeded.":
        return `Too heavy by ${Math.round((resources.massKg - constraints.massKg) * 10) / 10} kg → the rocket can't lift it. Swap in lighter parts.`;
      case "Power demand exceeds solar generation.":
        return `Parts need ${resources.powerUseW} W but panels make only ${resources.powerGenW} W → ${slotExplainers.solar.ifWeak}`;
      case "Daily data exceeds downlink and storage capacity.":
        return `Sensors make more data than the radio can send or memory can hold → ${slotExplainers.storage.ifWeak}`;
      case "Power margin is below 15%; observations may pause during eclipse.":
        return `Power is nearly maxed out → ${slotExplainers.battery.ifWeak}`;
      case "Downlink utilization is above 80%; delivery delays are likely.":
        return `Downlink is slow → ${story.hazardNoun} data may arrive after the ${hours}-hour deadline.`;
      case "One day of observations does not fit in onboard storage.":
        return `Memory is too small for a day of data → ${slotExplainers.storage.ifWeak}`;
      default:
        return message;
    }
  };
  const blockers = resources.violations.map(consequenceOf);
  const warnings = resources.warnings.map(consequenceOf);
  if (installedInstruments.length > 0 && !seesHazard) {
    warnings.unshift(`None of your sensors can detect the ${story.hazardNoun} → ${slotExplainers.instruments.ifWeak}`);
  }
  if (design.orbit && resources.coverageEstimate < COVERAGE_TARGET) {
    warnings.push(`Coverage estimate is ${resources.coverageEstimate}%, below the ${COVERAGE_TARGET}% needed → ${slotExplainers.orbit.ifWeak}`);
  }

  const ratioStatus = (value: number, limit: number, tightAt: number): Status =>
    limit <= 0 ? "missing" : value > limit ? "over" : value / limit >= tightAt ? "tight" : "ok";
  const dataCapacity = resources.downlinkGBPerDay + resources.storageGB;
  const steps = {
    instruments: design.instruments.length > 0,
    orbit: Boolean(design.orbit),
    power: Boolean(design.solar && design.battery),
    comm: Boolean(design.comm),
    storage: Boolean(design.storage),
  };
  const stepsDone = Object.values(steps).filter(Boolean).length;
  const canLaunch = ready && !launching && blockers.length === 0;

  return (
    <div className="space-y-6">
      <MissionSteps slug={mission.slug} current="build" />
      <header className="space-y-3">
        <Link className="text-sm text-primary underline" href={`/mission/${mission.slug}/brief`}>← Back to the emergency briefing</Link>
        <h1 className="text-3xl font-bold sm:text-4xl">Build your satellite</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full border border-destructive/70 px-3 py-1 font-semibold">⏱ Deliver data within {hours} h</span>
          <span className="rounded-full border border-border px-3 py-1">💰 {money(constraints.budgetM)} budget</span>
          <span className="rounded-full border border-border px-3 py-1">🚀 {constraints.massKg} kg max</span>
          <span className="rounded-full border border-border px-3 py-1">📅 {mission.durationDays}-day mission</span>
        </div>
        <p className="max-w-2xl text-lg"><b>Goal:</b> {story.goal}</p>
        <p className="text-sm text-muted-foreground" aria-live="polite">{stepsDone} of 5 steps done</p>
      </header>

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start">
        <fieldset disabled={!ready || launching} className="order-2 min-w-0 space-y-6 lg:order-none">
          <legend className="sr-only">Satellite parts</legend>

          <BuildStep number={1} slot="instruments" done={steps.instruments}>
            <p className="text-sm">
              <span aria-hidden="true">💡 </span>{story.hint} You can install up to {MAX_INSTRUMENTS} sensors
              ({design.instruments.length}/{MAX_INSTRUMENTS} installed).
            </p>
            <CardGroup>
              {partsCatalog.instruments.map((part) => {
                const checked = design.instruments.includes(part.id);
                const full = !checked && design.instruments.length >= MAX_INSTRUMENTS;
                return (
                  <PartCard key={part.id} type="checkbox" name={part.name} checked={checked} disabled={full}
                    disabledReason={`Only ${MAX_INSTRUMENTS} sensors fit. Remove one first.`}
                    onChange={() => toggleInstrument(part.id)} fit={fitLabel(part)} {...partExplainers[part.id]}
                    specs={[money(part.costM), `${part.massKg} kg`, `${part.powerW} W`, `${part.dataGBPerDay} GB/day`,
                      detailWords(part.resolutionScore), ...(part.cloudPenetrating ? ["Sees through clouds"] : [])]} />
                );
              })}
            </CardGroup>
          </BuildStep>

          <BuildStep number={2} slot="orbit" done={steps.orbit}>
            <CardGroup>
              {partsCatalog.orbits.map((part) => (
                <PartCard key={part.id} type="radio" group={`${groupId}-orbit`} name={part.name} checked={design.orbit === part.id}
                  onChange={() => select("orbit")(part.id)} {...partExplainers[part.id]}
                  specs={[money(part.costM), `${part.massKg} kg`, ...orbitWords(part)]} />
              ))}
            </CardGroup>
          </BuildStep>

          <BuildStep number={3} slot="solar" extraSlot="battery" done={steps.power}>
            <p className="text-sm">
              Your sensors and radio currently need <b>{resources.powerUseW} W</b> (including {partsCatalog.bus.powerW} W for the satellite itself).
            </p>
            <CardGroup legend="Solar array">
              {partsCatalog.solar.map((part) => (
                <PartCard key={part.id} type="radio" group={`${groupId}-solar`} name={part.name} checked={design.solar === part.id}
                  onChange={() => select("solar")(part.id)} {...partExplainers[part.id]}
                  specs={[money(part.costM), `${part.massKg} kg`, `Makes ${part.generationW} W`,
                    part.generationW >= resources.powerUseW ? "✓ Enough for current parts" : "✕ Too little for current parts"]} />
              ))}
            </CardGroup>
            <CardGroup legend="Battery">
              {partsCatalog.batteries.map((part) => (
                <PartCard key={part.id} type="radio" group={`${groupId}-battery`} name={part.name} checked={design.battery === part.id}
                  onChange={() => select("battery")(part.id)} {...partExplainers[part.id]}
                  specs={[money(part.costM), `${part.massKg} kg`, `${Math.round(part.eclipseContinuity * 100)}% working in shadow`]} />
              ))}
            </CardGroup>
          </BuildStep>

          <BuildStep number={4} slot="comm" extraSlot="groundStations" done={steps.comm}>
            <p className="text-sm">
              Your sensors make <b>{resources.dataGBPerDay} GB</b> of data per day. Radio speed × station contact time decides how much gets home.
            </p>
            <CardGroup legend="Radio">
              {partsCatalog.communications.map((part) => (
                <PartCard key={part.id} type="radio" group={`${groupId}-comm`} name={part.name} checked={design.comm === part.id}
                  onChange={() => select("comm")(part.id)} {...partExplainers[part.id]}
                  specs={[money(part.costM), `${part.massKg} kg`, `${part.powerW} W`, `${part.rateGbps} Gbps`,
                    `≈${downlinkGB(part.rateGbps, design.groundStations)} GB/day with ${design.groundStations} station${design.groundStations > 1 ? "s" : ""}`]} />
              ))}
            </CardGroup>
            <CardGroup legend="Ground stations">
              {stationCounts.map((count) => (
                <PartCard key={count} type="radio" group={`${groupId}-stations`} name={`${count} ground station${count > 1 ? "s" : ""}`}
                  checked={design.groundStations === count} onChange={() => update({ groundStations: count })}
                  {...groundStationExplainers[count]}
                  specs={[money(partsCatalog.groundStations[count].costM), `${partsCatalog.groundStations[count].accessMinutesPerDay} min contact/day`]} />
              ))}
            </CardGroup>
          </BuildStep>

          <BuildStep number={5} slot="storage" done={steps.storage}>
            <CardGroup>
              {partsCatalog.storage.map((part) => (
                <PartCard key={part.id} type="radio" group={`${groupId}-storage`} name={part.name} checked={design.storage === part.id}
                  onChange={() => select("storage")(part.id)} {...partExplainers[part.id]}
                  specs={[money(part.costM), `${part.massKg} kg`, `Holds ${part.capacityGB} GB`,
                    resources.dataGBPerDay > 0 ? `≈${Math.round((part.capacityGB / resources.dataGBPerDay) * 10) / 10} days of your data` : "No sensor data yet"]} />
              ))}
            </CardGroup>
          </BuildStep>
        </fieldset>

        <div className="contents lg:sticky lg:top-4 lg:block lg:max-h-[calc(100vh-2rem)] lg:space-y-4 lg:overflow-y-auto lg:pr-1">
          <section aria-label="Your satellite" className="order-1 space-y-4 rounded-xl border border-border bg-card p-4">
            <h2 className="text-lg font-bold">Your satellite</h2>
            <SatelliteVisual design={design} />
            <SensorViewPreview mission={mission} design={design} hazardNoun={story.hazardNoun} obstacle={story.obstacle} />
          </section>

          <section aria-labelledby={`${groupId}-checklist`} className="order-3 space-y-4 rounded-xl border border-border bg-card p-4">
            <h2 id={`${groupId}-checklist`} className="text-lg font-bold">Pre-launch checklist</h2>
            <ul className="space-y-3">
              <CheckRow label="💰 Budget" status={ratioStatus(resources.costM, constraints.budgetM, 0.9)}
                fill={resources.costM / constraints.budgetM}
                text={`Parts cost ${money(resources.costM)} of your ${money(constraints.budgetM)} budget.`} />
              <CheckRow label="🚀 Mass" status={ratioStatus(resources.massKg, constraints.massKg, 0.9)}
                fill={resources.massKg / constraints.massKg}
                text={`Satellite weighs ${resources.massKg} kg; the rocket lifts ${constraints.massKg} kg.`} />
              <CheckRow label="⚡ Power" status={design.solar ? ratioStatus(resources.powerUseW, resources.powerGenW, 0.85) : "missing"}
                fill={resources.powerGenW ? resources.powerUseW / resources.powerGenW : 0}
                text={design.solar
                  ? `Parts need ${resources.powerUseW} W, panels make ${resources.powerGenW} W.`
                  : `Parts need ${resources.powerUseW} W, but no solar array is installed.`} />
              <CheckRow label="📡 Data link"
                status={design.comm && design.storage ? ratioStatus(resources.dataGBPerDay, dataCapacity, 0.8) : "missing"}
                fill={dataCapacity ? resources.dataGBPerDay / dataCapacity : 0}
                text={`Sensors make ${resources.dataGBPerDay} GB/day; radio sends ${resources.downlinkGBPerDay} GB/day and memory holds ${resources.storageGB} GB.`} />
              <CheckRow label="🗺 Coverage estimate"
                status={!design.orbit ? "missing" : resources.coverageEstimate >= COVERAGE_TARGET ? "ok" : "tight"}
                fill={resources.coverageEstimate / 100}
                text={`About ${resources.coverageEstimate}% of the area; success needs ${COVERAGE_TARGET}%.`} />
            </ul>

            {ready && warnings.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold">⚠ Risks to your mission</h3>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                  {warnings.map((message) => <li key={message}>{message}</li>)}
                </ul>
              </div>
            )}

            {error && <p role="alert" className="text-destructive">{error}</p>}
            <Button className="w-full text-lg" onClick={launch} disabled={!canLaunch}
              aria-describedby={blockers.length ? blockersId : undefined}>
              {launching ? "Launching…" : "Launch satellite 🚀"}
            </Button>
            <div id={blockersId} aria-live="polite">
              {ready && blockers.length > 0 && (
                <>
                  <p className="text-sm font-semibold text-destructive">✕ Can&apos;t launch yet:</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                    {blockers.map((message) => <li key={message}>{message}</li>)}
                  </ul>
                </>
              )}
              {ready && blockers.length === 0 && (
                <p className="text-sm">✓ Ready for launch. Watch whether your satellite finds the {story.hazardNoun} in time.</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
