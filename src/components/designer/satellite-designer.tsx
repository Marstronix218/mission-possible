"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";
import { useStore } from "zustand";
import { MissionSteps } from "@/components/story/MissionSteps";
import { draftKey } from "@/components/results/session";
import { findPart, partsCatalog } from "@/lib/sim/catalog";
import { summarizeResources } from "@/lib/sim/resources";
import type { PartSlot } from "@/lib/story/parts";
import { createDesignStore } from "@/stores/design";
import type { Mission, SatelliteDesign } from "@/types/game";
import { BuildCard, DRAG_TYPE, type CardStat } from "./BuildCard";
import { hazardEmoji, partCopy, stationCopy } from "./builder-copy";
import {
  blockerMessages,
  COVERAGE_TARGET,
  level,
  MAX_INSTRUMENTS,
  parseFixSlots,
  stageComplete,
  stages,
  stationCounts,
} from "./builder-model";
import { OrbitIcon, OrbitPreview } from "./OrbitPreview";
import {
  AntennaArt,
  BatteryArt,
  DishArt,
  kindColor,
  MemoryArt,
  SensorArt,
  SolarWingArt,
} from "./parts-art";
import { SatelliteWorkbench } from "@/components/gameplay/SatelliteWorkbench";
import {
  installedIds,
  performanceAxes,
  type PerfCategory,
  type PerfContext,
} from "@/components/planning/component-performance";
import { ComponentRadar } from "@/components/planning/ComponentRadar";
import { PerformancePanel } from "@/components/planning/PerformancePanel";
import { ResourceDashboard } from "@/components/planning/ResourceDashboard";
import planning from "@/components/planning/planning.module.css";
import { MissionGuide } from "@/components/guide/MissionGuide";
import { designHint } from "@/components/guide/guide-context";
import type { GuideStage } from "@/components/guide/guide-copy";
import { storyFor } from "./story-fallback";
import { useReducedMotion } from "./useReducedMotion";
import styles from "./designer.module.css";
import { WorkshopInstruction } from "./WorkshopInstruction";
import {
  workshopDecisions,
  decisionComplete,
  decisionForSlot,
  firstUnfinishedDecision,
} from "./workshop-flow";
import tutorialStyles from "./workshop-instruction.module.css";

type SingleSlot = "orbit" | "solar" | "battery" | "comm" | "storage";

const cat = partsCatalog;
const values = <T,>(items: T[], pick: (item: T) => number) => items.map(pick);
const log = (value: number) => Math.log10(value);

const starfield = {
  backgroundImage: [
    "radial-gradient(1.5px 1.5px at 12% 18%, #fff 50%, transparent 51%)",
    "radial-gradient(1px 1px at 78% 12%, #fff 50%, transparent 51%)",
    "radial-gradient(1.5px 1.5px at 88% 46%, #ffd23f 50%, transparent 51%)",
    "radial-gradient(1px 1px at 24% 62%, #fff 50%, transparent 51%)",
    "radial-gradient(1px 1px at 56% 8%, #2de2e6 50%, transparent 51%)",
    "radial-gradient(1.5px 1.5px at 6% 84%, #fff 50%, transparent 51%)",
    "radial-gradient(ellipse at 50% 30%, var(--space-700), var(--space-950) 75%)",
  ].join(", "),
};

/** Tight viewBox per sensor so narrow sensors fill their card tile. */
function sensorViewBox(id: string, kind: string) {
  const width =
    id === "sar" ? 66 : kind === "radar" || kind === "gravimetry" ? 48 : 34;
  return `${-width / 2 - 3} -4 ${width + 6} 42`;
}

/** Scroll a `#slot-<slot>` anchor into view once its step panel is shown. */
function scrollToSlot(slot: PartSlot) {
  requestAnimationFrame(() =>
    document.getElementById(`slot-${slot}`)?.scrollIntoView({ block: "start" }),
  );
}

function SlotGroup({
  slot,
  title,
  aside,
  fixed,
  changed,
  children,
  hidden,
}: {
  hidden?: boolean;
  slot: PartSlot;
  title: string;
  aside?: ReactNode;
  fixed: boolean;
  changed: boolean;
  children: ReactNode;
}) {
  return (
    <fieldset
      hidden={hidden}
      id={`slot-${slot}`}
      className={
        "m-0 min-w-0 scroll-mt-80 lg:scroll-mt-6 " +
        (fixed
          ? "rounded-[var(--radius)] border-[3px] border-dashed border-pop-pink p-3"
          : "border-0 p-0")
      }
    >
      <legend className="flex w-full flex-wrap items-center gap-2 px-1 pb-2 font-display text-lg font-bold">
        {title}
        {fixed && (
          <span
            className={
              (changed ? "" : styles.wiggle + " ") +
              "inline-block rounded-full border-2 border-space-950 bg-pop-pink px-2.5 py-0.5 text-xs font-black tracking-wider text-space-950"
            }
          >
            {changed ? "✓ CHANGED" : "! CHECK THIS"}
          </span>
        )}
        {aside && (
          <span className="ml-auto text-sm font-bold text-muted-foreground">
            {aside}
          </span>
        )}
      </legend>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

/** Hover or keyboard focus previews this option against what is installed. */
function Previewable({
  category,
  id,
  onPreview,
  children,
}: {
  category: PerfCategory;
  id: string;
  onPreview: (category: PerfCategory, id: string | null) => void;
  children: ReactNode;
}) {
  return (
    <div
      className="min-w-0"
      onMouseEnter={() => onPreview(category, id)}
      onMouseLeave={() => onPreview(category, null)}
      onFocus={() => onPreview(category, id)}
      onBlur={() => onPreview(category, null)}
    >
      {children}
    </div>
  );
}

/** Compact card radar: this option (solid if installed, dashed if not) over the installed one. */
function MiniRadar({
  category,
  id,
  ctx,
}: {
  category: PerfCategory;
  id: string;
  ctx: PerfContext;
}) {
  const installed = installedIds(category, ctx.design);
  const mine = installed.includes(id);
  const reference = mine ? undefined : installed[0];
  const series = [
    ...(reference
      ? [
          {
            name: reference,
            kind: "installed" as const,
            axes: performanceAxes(category, reference, ctx),
          },
        ]
      : []),
    {
      name: id,
      kind: mine ? ("installed" as const) : ("alternative" as const),
      axes: performanceAxes(category, id, ctx),
    },
  ];
  return (
    <span
      aria-hidden="true"
      className="flex flex-wrap items-start gap-x-2 text-[11px] leading-snug text-muted-foreground"
    >
      <ComponentRadar series={series} label={id} size="mini" decorative />
      <span className="min-w-0 flex-1 basis-28">
        {series[series.length - 1].axes
          .map((axis, index) => (
            <span key={axis.id}>
              {index > 0 && " · "}
              {axis.label}{" "}
              <b className="text-foreground">{Math.round(axis.value)}</b>
            </span>
          ))
          .reduce<ReactNode[]>((all, item) => [...all, item, " "], [])}
      </span>
    </span>
  );
}

export function SatelliteDesigner({
  mission,
  fix,
}: {
  mission: Mission;
  fix?: string | string[];
}) {
  const router = useRouter();
  const groupId = useId();
  const reduced = useReducedMotion();
  const [store] = useState(() => createDesignStore(mission.slug));
  const [ready, setReady] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState("");
  const [decisionIndex, setDecisionIndex] = useState(0);
  const [instruction, setInstruction] = useState(true);
  const decision = workshopDecisions[decisionIndex];
  const stage = decision.stage;

  const [showNumbers, setShowNumbers] = useState(false);
  const [previousDesign, setPreviousDesign] = useState<SatelliteDesign | null>(
    null,
  );
  const [fixSlots, setFixSlots] = useState<PartSlot[]>(() =>
    parseFixSlots(fix),
  );
  const [changedSlots, setChangedSlots] = useState<PartSlot[]>([]);
  const [toast, setToast] = useState<{ key: number; text: string } | null>(
    null,
  );
  const [dropReady, setDropReady] = useState(false);
  const [preview, setPreview] = useState<Partial<Record<PerfCategory, string>>>(
    {},
  );
  const bumpRef = useRef<HTMLDivElement>(null);
  const trayRef = useRef<HTMLDivElement>(null);
  const toastCount = useRef(0);
  const { design, update } = useStore(store);

  const story = storyFor(mission);
  const constraints = mission.defaultConstraints;
  const hours = mission.targetResponseHours;
  const hazardColor = `var(--hazard-${mission.category})`;
  const resources = summarizeResources(design, constraints);
  const perf: PerfContext = { category: mission.category, design, constraints };
  const guideHint = designHint({
    design,
    resources,
    constraints,
    category: mission.category,
    previousDesign,
    previousResources: previousDesign
      ? summarizeResources(previousDesign, constraints)
      : null,
  });
  const guideStage: GuideStage = stages.every((item) =>
    stageComplete(design, item.id),
  )
    ? "resources"
    : stage === "eyes"
      ? design.instruments.length
        ? "sensor"
        : "workshop"
      : stage === "radio"
        ? "comm"
        : stage === "review"
          ? "resources"
          : stage;
  const onPreview = (category: PerfCategory, id: string | null) =>
    setPreview((current) =>
      (current[category] ?? null) === id
        ? current
        : { ...current, [category]: id ?? undefined },
    );
  const panel = (category: PerfCategory) => (
    <details className="my-3 rounded-xl border border-border p-3">
      <summary>Compare installed parts & alternatives</summary>
      <PerformancePanel
        category={category}
        preview={preview[category] ?? null}
        ctx={perf}
      />
    </details>
  );
  const mini = (category: PerfCategory, id: string) =>
    showNumbers ? <MiniRadar category={category} id={id} ctx={perf} /> : null;

  useEffect(() => {
    async function restoreDraft() {
      try {
        await store.persist?.rehydrate();
      } catch {
        setError("The saved draft could not be loaded.");
      }
      const saved = store.getState().design;
      const targets = parseFixSlots(fix, window.location.hash);
      setFixSlots(targets);
      if (targets.length) {
        setDecisionIndex(decisionForSlot(targets[0]));
        setInstruction(false);
        scrollToSlot(targets[0]);
      } else setDecisionIndex(firstUnfinishedDecision(saved));
      setReady(true);
    }
    void restoreDraft();
    // Debrief links can also change the hash while the page is open.
    function onHash() {
      const targets = parseFixSlots(null, window.location.hash);
      if (!targets.length) return;
      setFixSlots((current) => [...new Set([...current, ...targets])]);
      setDecisionIndex(decisionForSlot(targets[0]));
      setInstruction(false);
      scrollToSlot(targets[0]);
    }
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [store, fix]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 1800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function react(text: string, slot: PartSlot) {
    setPreviousDesign(design);
    toastCount.current += 1;
    setToast({ key: toastCount.current, text });
    setChangedSlots((current) =>
      current.includes(slot) ? current : [...current, slot],
    );
    if (!reduced) {
      bumpRef.current?.animate(
        [
          { transform: "scale(1) rotate(0deg)" },
          { transform: "scale(1.05) rotate(-2deg)" },
          { transform: "scale(1) rotate(0deg)" },
        ],
        { duration: 420, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" },
      );
    }
  }

  function selectPart(slot: SingleSlot, id: string) {
    if (design[slot] === id) return;
    update({ [slot]: id });
    const name = partCopy[id]?.name ?? id;
    react(slot === "orbit" ? `Orbit: ${name}` : `${name} on board!`, slot);
  }

  function toggleInstrument(id: string) {
    const name = partCopy[id]?.name ?? id;
    if (design.instruments.includes(id)) {
      update({ instruments: design.instruments.filter((item) => item !== id) });
      react(`${name} removed`, "instruments");
    } else if (design.instruments.length < MAX_INSTRUMENTS) {
      update({ instruments: [...design.instruments, id] });
      react(`${name} attached!`, "instruments");
    }
  }

  function setStations(count: SatelliteDesign["groundStations"]) {
    if (design.groundStations === count) return;
    update({ groundStations: count });
    react(`${stationCopy[count].name} on Earth`, "groundStations");
  }

  function attachPart(slot: string, id: string) {
    if (slot === "instruments") {
      if (
        cat.instruments.some((p) => p.id === id) &&
        !design.instruments.includes(id)
      )
        toggleInstrument(id);
      return;
    }
    const options = {
      orbit: cat.orbits,
      solar: cat.solar,
      battery: cat.batteries,
      comm: cat.communications,
      storage: cat.storage,
    };
    if (
      Object.hasOwn(options, slot) &&
      options[slot as SingleSlot].some((p) => p.id === id)
    )
      selectPart(slot as SingleSlot, id);
  }
  function removePart(slot: string, id: string) {
    if (slot === "instruments") {
      if (design.instruments.includes(id)) toggleInstrument(id);
      return;
    }
    if (
      ["solar", "battery", "comm", "storage"].includes(slot) &&
      design[slot as SingleSlot] === id
    ) {
      update({ [slot]: "" });
      react(`${partCopy[id]?.name ?? id} removed`, slot as PartSlot);
    }
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    if (!event.dataTransfer.types.includes(DRAG_TYPE)) return;
    event.preventDefault();
    setDropReady(true);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    setDropReady(false);
    const raw = event.dataTransfer.getData(DRAG_TYPE);
    if (!raw) return;
    event.preventDefault();
    try {
      const { slot, id } = JSON.parse(raw) as { slot: string; id: string };
      attachPart(slot, id);
    } catch {
      // Ignore drops that did not come from a part card.
    }
  }

  function launch() {
    if (launching || !ready || resources.violations.length) return;
    setLaunching(true);
    setError("");
    try {
      localStorage.setItem(draftKey(mission.slug), JSON.stringify(design));
      router.push(`/mission/${mission.slug}/run`);
    } catch {
      setError(
        "Your design could not be saved for launch. Turn on browser storage and try again.",
      );
      setLaunching(false);
    }
  }

  const stageIndex = stages.findIndex((item) => item.id === stage);
  const current = stages[stageIndex];
  const allDone = stages.every((item) => stageComplete(design, item.id));
  const blockers = blockerMessages(resources.violations);
  const canLaunch = ready && !launching && blockers.length === 0;
  const orbit = findPart(cat.orbits, design.orbit);
  const fixSet = new Set(fixSlots);
  const changed = new Set(changedSlots);

  const groupProps = (slot: PartSlot) => ({
    slot,
    fixed: fixSet.has(slot),
    changed: changed.has(slot),
    hidden: decision.slot !== slot,
  });
  const money = (value: number) => `$${value}M`;
  const costStat = (costM: number, options: number[]): CardStat => ({
    icon: "💰",
    label: "Cost",
    level: level(costM, options),
    exact: money(costM),
  });
  const massStat = (massKg: number, options: number[]): CardStat => ({
    icon: "🏋️",
    label: "Weight",
    level: level(massKg, options),
    exact: `${massKg} kg`,
  });

  let primary: ReactNode;
  if (decision.slot === "review") {
    primary = (
      <button
        type="button"
        onClick={launch}
        disabled={!canLaunch}
        aria-describedby={`${groupId}-launch-status`}
        className="w-full rounded-full border-[3px] border-space-950 bg-pop-yellow px-6 py-3.5 font-display text-xl font-bold tracking-wide text-space-950 shadow-[var(--shadow-pop)] transition-transform hover:-translate-y-0.5 active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {launching ? "Launching…" : "LAUNCH"} <span aria-hidden="true">🚀</span>
      </button>
    );
  } else {
    primary = (
      <button
        type="button"
        disabled={!ready || !decisionComplete(design, decisionIndex)}
        onClick={() => {
          setDecisionIndex((i) =>
            Math.min(workshopDecisions.length - 1, i + 1),
          );
          setInstruction(true);
        }}
        className="btn-pop"
      >
        CONTINUE →
      </button>
    );
  }
  if (ready && instruction)
    return (
      <WorkshopInstruction
        mission={mission}
        index={decisionIndex}
        onContinue={() => setInstruction(false)}
        onBack={() => {
          if (decisionIndex === 0)
            router.push(`/mission/${mission.slug}/brief`);
          else {
            setDecisionIndex((i) => i - 1);
            setInstruction(false);
          }
        }}
      />
    );

  return (
    <div className="mx-auto max-w-6xl">
      <MissionSteps slug={mission.slug} current="design" />

      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            className="text-sm font-bold text-pop-cyan underline-offset-4 hover:underline"
            href={`/mission/${mission.slug}/brief`}
          >
            <span aria-hidden="true">← </span>Briefing
          </Link>
          <h1 className="!m-0 font-display text-3xl !leading-tight font-bold !tracking-normal sm:text-4xl">
            Build your satellite
          </h1>
        </div>
        <ul className="flex flex-wrap gap-2 text-sm font-bold">
          <li
            className="rounded-full border-2 px-3 py-1"
            style={{ borderColor: hazardColor }}
          >
            <span aria-hidden="true">{hazardEmoji[mission.category]} </span>
            {mission.city}
          </li>
          <li className="rounded-full border-2 border-pop-pink px-3 py-1">
            <span aria-hidden="true">⏱ </span>
            {hours} h response target
          </li>
        </ul>
      </header>

      {ready && <MissionGuide stage={guideStage} hint={guideHint} />}

      <dl
        className={tutorialStyles.resourceHud}
        aria-label="Live spacecraft resources"
      >
        {[
          [
            "Budget",
            `$${resources.costM}M / $${constraints.budgetM}M`,
            resources.costM > constraints.budgetM,
            resources.costM / constraints.budgetM,
          ],
          [
            "Mass",
            `${resources.massKg} / ${constraints.massKg} kg`,
            resources.massKg > constraints.massKg,
            resources.massKg / constraints.massKg,
          ],
          [
            "Power",
            `${resources.powerUseW} / ${resources.powerGenW} W`,
            !!design.solar && resources.powerUseW > resources.powerGenW,
            design.solar
              ? resources.powerUseW / Math.max(1, resources.powerGenW)
              : 0,
          ],
          [
            "Data / downlink",
            `${resources.dataGBPerDay} / ${resources.downlinkGBPerDay} GB/day`,
            !!design.comm &&
              !!design.storage &&
              resources.dataGBPerDay >
                resources.downlinkGBPerDay + resources.storageGB,
          ],
          ["Storage", `${resources.storageGB} GB`, false],
        ].map(([label, value, over, ratio]) => (
          <div key={String(label)} data-over={over || undefined}>
            <dt>{label}</dt>
            <dd>
              {over ? "! " : ""}
              {value}
            </dd>
            {typeof ratio === "number" && (
              <meter
                aria-label={`${label} utilization`}
                min="0"
                max="100"
                value={Math.min(100, ratio * 100)}
                className="w-full"
              />
            )}
          </div>
        ))}
      </dl>
      {resources.violations.filter(
        (v) =>
          !v.startsWith("Select ") &&
          (v !== "Power demand exceeds solar generation." || !!design.solar),
      ).length > 0 && (
        <p
          role="status"
          className="mb-4 rounded-lg border border-amber-300/40 bg-amber-300/10 p-3 text-sm"
        >
          {blockerMessages(
            resources.violations.filter(
              (v) =>
                !v.startsWith("Select ") &&
                (v !== "Power demand exceeds solar generation." ||
                  !!design.solar),
            ),
          ).join(" · ")}
        </p>
      )}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
        {/* ---------- The satellite and its gauges ---------- */}
        <section
          aria-label="Your satellite"
          className="space-y-4 lg:sticky lg:top-48 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:pr-1"
        >
          <div
            onDragOver={onDragOver}
            onDragLeave={() => setDropReady(false)}
            onDrop={onDrop}
            className={
              "relative overflow-hidden rounded-[var(--radius)] border-[3px] shadow-[var(--shadow-pop)] " +
              (dropReady ? "border-pop-yellow" : "border-space-950")
            }
            style={starfield}
          >
            <div ref={bumpRef} className="mx-auto min-h-[220px] max-w-xl">
              {stage === "orbit" ? (
                <div className="h-[300px]">
                  <OrbitPreview
                    orbitId={design.orbit}
                    hazardColor={hazardColor}
                  />
                </div>
              ) : (
                <SatelliteWorkbench
                  design={design}
                  onAttach={attachPart}
                  onRemove={removePart}
                />
              )}
            </div>
            {orbit && stage !== "orbit" && (
              <span className="absolute top-2 left-2 rounded-full bg-space-950/80 px-2.5 py-1 text-xs font-bold">
                <span aria-hidden="true">🪐 </span>
                {partCopy[orbit.id]?.name}
              </span>
            )}
            {stage === "orbit" && orbit && (
              <span className="absolute top-2 left-2 rounded-full bg-space-950/80 px-2.5 py-1 text-xs font-bold">
                <span aria-hidden="true">🗺 </span>Watches ~
                {Math.round(resources.coverageEstimate)}% of the area
                <span
                  className={
                    "ml-1.5 rounded-full px-1.5 text-[11px] font-black text-space-950 " +
                    (resources.coverageEstimate >= COVERAGE_TARGET
                      ? "bg-ok"
                      : "bg-warn")
                  }
                >
                  {resources.coverageEstimate >= COVERAGE_TARGET
                    ? "✓ OK"
                    : "! LOW"}
                </span>
              </span>
            )}
            {dropReady && (
              <span className="pointer-events-none absolute inset-x-0 bottom-2 text-center font-display text-sm font-bold text-pop-yellow">
                Drop to attach
              </span>
            )}
            {toast && (
              <span
                key={toast.key}
                aria-hidden="true"
                className={
                  styles.toast +
                  " pointer-events-none absolute top-3 left-1/2 rounded-full border-[3px] border-space-950 bg-pop-yellow px-4 py-1 font-display text-base font-bold whitespace-nowrap text-space-950 shadow-[var(--shadow-pop)]"
                }
              >
                {toast.text}
              </span>
            )}
          </div>
          <p className="sr-only" aria-live="polite">
            {toast?.text ?? ""}
          </p>

          <p className="text-sm text-muted-foreground">
            Pick up a part and drop it on the highlighted mount. Click an
            installed module to remove it. Open the body to inspect battery and
            memory slots.
          </p>
          <details className="rounded-xl border border-border p-3">
            <summary>
              Detailed resource checks & engineering consequences
            </summary>
            <ResourceDashboard
              mission={mission}
              design={design}
              resources={resources}
              constraints={constraints}
              previousDesign={previousDesign}
            />
          </details>
          <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
            <input
              type="checkbox"
              checked={showNumbers}
              onChange={(event) => setShowNumbers(event.target.checked)}
            />
            Show exact specs on part cards
          </label>
          <details className={planning.plan}>
            <summary>Bus, launch & mission lifetime</summary>
            <dl>
              <div>
                <dt>Supplied spacecraft bus</dt>
                <dd>
                  {cat.bus.massKg} kg · ${cat.bus.costM}M · {cat.bus.powerW} W
                </dd>
              </div>
              <div>
                <dt>Instrument mounts</dt>
                <dd>Up to {MAX_INSTRUMENTS} payloads</dd>
              </div>
              <div>
                <dt>Launch allowance</dt>
                <dd>
                  {constraints.massKg} kg maximum · ${constraints.budgetM}M
                  total budget
                </dd>
              </div>
              <div>
                <dt>Scenario lifetime</dt>
                <dd>
                  {mission.durationDays} days · first useful data within {hours}{" "}
                  h
                </dd>
              </div>
            </dl>
            <p className="text-sm">
              This mission supplies one bus and a fixed launch allowance. Its
              replay duration is fixed so attempts use the same hazard timeline.
              Solar, battery, radio, orbit and storage choices still change the
              actual resource and reliability calculations; no unmodeled bus or
              rocket bonus is added.
            </p>
          </details>
        </section>

        {/* ---------- Steps and parts ---------- */}
        <div
          ref={trayRef}
          className="min-w-0 scroll-mt-72 space-y-4 lg:scroll-mt-4"
        >
          <nav aria-label="Build steps" className="!block">
            <ol className="grid grid-cols-4 gap-2">
              {workshopDecisions.map((item, index) => (
                <li key={item.slot}>
                  <button
                    type="button"
                    disabled={!ready}
                    onClick={() => {
                      setDecisionIndex(index);
                      setInstruction(true);
                    }}
                    aria-current={index === decisionIndex ? "step" : undefined}
                    className="w-full min-h-12 rounded-lg border border-border px-2 py-2 text-sm"
                    style={
                      index === decisionIndex
                        ? { background: "#bddfdc", color: "#122330" }
                        : undefined
                    }
                  >
                    {index + 1}. {item.label}
                    {decisionComplete(design, index) ? " ✓" : ""}
                    {item.slot !== "review" &&
                    fixSet.has(item.slot) &&
                    !changed.has(item.slot)
                      ? " · ! Check"
                      : ""}
                  </button>
                </li>
              ))}
            </ol>
          </nav>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              {decisionIndex + 1}/{workshopDecisions.length} · Choose, inspect,
              then continue.
            </p>
            {primary}
          </div>
          {fixSlots.length > 0 && (
            <p className="rounded-2xl border-[3px] border-dashed border-pop-pink bg-pop-pink/10 px-4 py-2.5 text-sm font-bold">
              <span aria-hidden="true">🔧 </span>Mission control flagged{" "}
              {fixSlots.length === 1 ? "a part" : `${fixSlots.length} parts`}.
              Look for <span className="text-pop-pink">! CHECK THIS</span>.
            </p>
          )}

          <fieldset
            disabled={!ready || launching}
            className="m-0 min-w-0 border-0 p-0"
          >
            <legend className="sr-only">Satellite parts</legend>

            {/* 1. Eyes */}
            <section
              id={`${groupId}-eyes`}
              hidden={stage !== "eyes"}
              aria-labelledby={`${groupId}-eyes-h`}
              className="space-y-3"
            >
              <h2
                id={`${groupId}-eyes-h`}
                className="!m-0 font-display text-2xl font-bold !tracking-normal"
              >
                {decision.title}
              </h2>
              <p className="text-sm text-muted-foreground">
                <span aria-hidden="true">🌫 </span>
                {story.obstacle}
              </p>
              {panel("instruments")}
              <SlotGroup
                {...groupProps("instruments")}
                title="Sensors"
                aside={
                  <span aria-live="polite">
                    {design.instruments.length}/{MAX_INSTRUMENTS} on board
                  </span>
                }
              >
                {cat.instruments.map((part) => {
                  const checked = design.instruments.includes(part.id);
                  const full =
                    !checked && design.instruments.length >= MAX_INSTRUMENTS;
                  return (
                    <Previewable
                      key={part.id}
                      category="instruments"
                      id={part.id}
                      onPreview={onPreview}
                    >
                      <BuildCard
                        type="checkbox"
                        checked={checked}
                        disabled={full}
                        disabledReason="Full: remove one first"
                        onChange={() => toggleInstrument(part.id)}
                        copy={partCopy[part.id]}
                        accent={kindColor[part.kind]}
                        showNumbers={showNumbers}
                        dragId={part.id}
                        dragSlot="instruments"
                        art={
                          <svg
                            viewBox={sensorViewBox(part.id, part.kind)}
                            className="h-full w-full"
                          >
                            <SensorArt id={part.id} kind={part.kind} />
                          </svg>
                        }
                        stats={[
                          costStat(
                            part.costM,
                            values(cat.instruments, (item) => item.costM),
                          ),
                          massStat(
                            part.massKg,
                            values(cat.instruments, (item) => item.massKg),
                          ),
                          {
                            icon: "⚡",
                            label: "Power use",
                            level: level(
                              log(part.powerW),
                              values(cat.instruments, (item) =>
                                log(item.powerW),
                              ),
                            ),
                            exact: `${part.powerW} W`,
                          },
                          {
                            icon: "💾",
                            label: "Data made",
                            level: level(
                              log(part.dataGBPerDay),
                              values(cat.instruments, (item) =>
                                log(item.dataGBPerDay),
                              ),
                            ),
                            exact: `${part.dataGBPerDay} GB/day`,
                          },
                        ]}
                        extra={mini("instruments", part.id)}
                      />
                    </Previewable>
                  );
                })}
              </SlotGroup>
              <details className="rounded-2xl border-2 border-border bg-space-800 px-4 py-2.5 text-sm">
                <summary className="cursor-pointer font-bold">
                  Stuck? Get a hint
                </summary>
                <p className="mt-2">{story.hint}</p>
              </details>
            </section>

            {/* 2. Orbit */}
            <section
              id={`${groupId}-orbit`}
              hidden={stage !== "orbit"}
              aria-labelledby={`${groupId}-orbit-h`}
              className="space-y-3"
            >
              <h2
                id={`${groupId}-orbit-h`}
                className="!m-0 font-display text-2xl font-bold !tracking-normal"
              >
                {decision.title}
              </h2>
              {panel("orbits")}
              <SlotGroup {...groupProps("orbit")} title="Orbit">
                {cat.orbits.map((part) => {
                  return (
                    <Previewable
                      key={part.id}
                      category="orbits"
                      id={part.id}
                      onPreview={onPreview}
                    >
                      <BuildCard
                        type="radio"
                        group={`${groupId}-orbit-r`}
                        checked={design.orbit === part.id}
                        onChange={() => selectPart("orbit", part.id)}
                        copy={partCopy[part.id]}
                        showNumbers={showNumbers}
                        dragId={part.id}
                        dragSlot="orbit"
                        art={<OrbitIcon orbitId={part.id} />}
                        extra={mini("orbits", part.id)}
                        stats={[
                          costStat(
                            part.costM,
                            values(cat.orbits, (item) => item.costM),
                          ),
                          massStat(
                            part.massKg,
                            values(cat.orbits, (item) => item.massKg),
                          ),
                        ]}
                      />
                    </Previewable>
                  );
                })}
              </SlotGroup>
            </section>

            {/* 3. Radio */}
            <section
              id={`${groupId}-radio`}
              hidden={stage !== "radio"}
              aria-labelledby={`${groupId}-radio-h`}
              className="space-y-5"
            >
              <h2
                id={`${groupId}-radio-h`}
                className="!m-0 font-display text-2xl font-bold !tracking-normal"
              >
                {decision.title}
              </h2>
              {decision.slot === "comm" && panel("communications")}
              <SlotGroup {...groupProps("comm")} title="Radio">
                {cat.communications.map((part) => (
                  <Previewable
                    key={part.id}
                    category="communications"
                    id={part.id}
                    onPreview={onPreview}
                  >
                    <BuildCard
                      type="radio"
                      group={`${groupId}-comm-r`}
                      checked={design.comm === part.id}
                      onChange={() => selectPart("comm", part.id)}
                      copy={partCopy[part.id]}
                      showNumbers={showNumbers}
                      dragId={part.id}
                      dragSlot="comm"
                      accent="#ffd23f"
                      art={
                        <svg viewBox="-30 -58 60 64" className="h-full w-full">
                          <AntennaArt id={part.id} />
                        </svg>
                      }
                      stats={[
                        {
                          icon: "🚀",
                          label: "Speed",
                          level: level(
                            log(part.rateGbps),
                            values(cat.communications, (item) =>
                              log(item.rateGbps),
                            ),
                          ),
                          exact: `${part.rateGbps} Gbps`,
                        },
                        costStat(
                          part.costM,
                          values(cat.communications, (item) => item.costM),
                        ),
                        {
                          icon: "⚡",
                          label: "Power use",
                          level: level(
                            part.powerW,
                            values(cat.communications, (item) => item.powerW),
                          ),
                          exact: `${part.powerW} W`,
                        },
                      ]}
                      extra={mini("communications", part.id)}
                    />
                  </Previewable>
                ))}
              </SlotGroup>
              {decision.slot === "groundStations" && panel("groundStations")}
              <SlotGroup
                {...groupProps("groundStations")}
                title="Antennas on Earth"
              >
                {stationCounts.map((count) => {
                  const station =
                    cat.groundStations[String(count) as "1" | "3" | "5"];
                  return (
                    <Previewable
                      key={count}
                      category="groundStations"
                      id={String(count)}
                      onPreview={onPreview}
                    >
                      <BuildCard
                        type="radio"
                        group={`${groupId}-stations-r`}
                        checked={design.groundStations === count}
                        onChange={() => setStations(count)}
                        showNumbers={showNumbers}
                        accent="#8bf05a"
                        copy={{
                          ...stationCopy[count],
                          science: `${count} ground station${count > 1 ? "s" : ""}`,
                          more: `About ${station.accessMinutesPerDay} minutes of contact a day. Data can only come down while a dish can see the satellite.`,
                        }}
                        art={
                          <svg
                            viewBox="-36 -20 72 40"
                            className="h-full w-full"
                          >
                            {Array.from({ length: count }, (_, index) => (
                              <g
                                key={index}
                                transform={`translate(${(index - (count - 1) / 2) * (count === 5 ? 15 : 24)} ${index % 2 ? 4 : 0}) scale(${count === 5 ? 0.6 : 0.85})`}
                              >
                                <DishArt />
                              </g>
                            ))}
                          </svg>
                        }
                        stats={[
                          {
                            icon: "⏱",
                            label: "Contact time",
                            level: level(
                              station.accessMinutesPerDay,
                              [8, 22, 36],
                            ),
                            exact: `${station.accessMinutesPerDay} min/day`,
                          },
                          costStat(station.costM, [2, 8, 15]),
                        ]}
                        extra={mini("groundStations", String(count))}
                      />
                    </Previewable>
                  );
                })}
              </SlotGroup>
            </section>

            {/* 4. Power + memory */}
            <section
              id={`${groupId}-power`}
              hidden={stage !== "power"}
              aria-labelledby={`${groupId}-power-h`}
              className="space-y-5"
            >
              <h2
                id={`${groupId}-power-h`}
                className="!m-0 font-display text-2xl font-bold !tracking-normal"
              >
                {decision.title}
              </h2>
              {decision.slot === "solar" && panel("solar")}
              <SlotGroup {...groupProps("solar")} title="Solar wings">
                {cat.solar.map((part) => {
                  const span =
                    part.id === "solar_s"
                      ? 14
                      : part.id === "solar_m"
                        ? 22
                        : 30;
                  return (
                    <Previewable
                      key={part.id}
                      category="solar"
                      id={part.id}
                      onPreview={onPreview}
                    >
                      <BuildCard
                        type="radio"
                        group={`${groupId}-solar-r`}
                        checked={design.solar === part.id}
                        onChange={() => selectPart("solar", part.id)}
                        copy={partCopy[part.id]}
                        showNumbers={showNumbers}
                        dragId={part.id}
                        dragSlot="solar"
                        accent="#2b3fd6"
                        art={
                          <svg
                            viewBox={`${-span - 18} -16 ${2 * span + 36} 32`}
                            className="h-full w-full"
                          >
                            <g transform="translate(-7 0)">
                              <SolarWingArt side={-1} span={span} height={22} />
                            </g>
                            <g transform="translate(7 0)">
                              <SolarWingArt side={1} span={span} height={22} />
                            </g>
                            <rect
                              x={-8}
                              y={-9}
                              width={16}
                              height={18}
                              rx={3}
                              fill="#e8ecff"
                              stroke="#06123a"
                              strokeWidth={2.5}
                            />
                          </svg>
                        }
                        stats={[
                          {
                            icon: "⚡",
                            label: "Power made",
                            level: level(
                              part.generationW,
                              values(cat.solar, (item) => item.generationW),
                            ),
                            exact: `${part.generationW} W`,
                          },
                          costStat(
                            part.costM,
                            values(cat.solar, (item) => item.costM),
                          ),
                          massStat(
                            part.massKg,
                            values(cat.solar, (item) => item.massKg),
                          ),
                        ]}
                        extra={mini("solar", part.id)}
                      />
                    </Previewable>
                  );
                })}
              </SlotGroup>
              {decision.slot === "battery" && panel("batteries")}
              <SlotGroup {...groupProps("battery")} title="Battery">
                {cat.batteries.map((part) => (
                  <Previewable
                    key={part.id}
                    category="batteries"
                    id={part.id}
                    onPreview={onPreview}
                  >
                    <BuildCard
                      type="radio"
                      group={`${groupId}-battery-r`}
                      checked={design.battery === part.id}
                      onChange={() => selectPart("battery", part.id)}
                      copy={partCopy[part.id]}
                      showNumbers={showNumbers}
                      dragId={part.id}
                      dragSlot="battery"
                      accent="#8bf05a"
                      art={
                        <svg viewBox="-22 -14 44 28" className="h-full w-full">
                          <BatteryArt level={part.eclipseContinuity} />
                        </svg>
                      }
                      stats={[
                        {
                          icon: "🌙",
                          label: "Keeps working in shadow",
                          level: level(
                            part.eclipseContinuity,
                            values(
                              cat.batteries,
                              (item) => item.eclipseContinuity,
                            ),
                          ),
                          exact: `${Math.round(part.eclipseContinuity * 100)}% in shadow`,
                        },
                        costStat(
                          part.costM,
                          values(cat.batteries, (item) => item.costM),
                        ),
                        massStat(
                          part.massKg,
                          values(cat.batteries, (item) => item.massKg),
                        ),
                      ]}
                      extra={mini("batteries", part.id)}
                    />
                  </Previewable>
                ))}
              </SlotGroup>
              {decision.slot === "storage" && panel("storage")}
              <SlotGroup {...groupProps("storage")} title="Memory">
                {cat.storage.map((part, index) => (
                  <Previewable
                    key={part.id}
                    category="storage"
                    id={part.id}
                    onPreview={onPreview}
                  >
                    <BuildCard
                      type="radio"
                      group={`${groupId}-storage-r`}
                      checked={design.storage === part.id}
                      onChange={() => selectPart("storage", part.id)}
                      copy={partCopy[part.id]}
                      showNumbers={showNumbers}
                      dragId={part.id}
                      dragSlot="storage"
                      accent="#a98bff"
                      art={
                        <svg viewBox="-20 -16 40 32" className="h-full w-full">
                          <MemoryArt bars={index + 1} />
                        </svg>
                      }
                      stats={[
                        {
                          icon: "💾",
                          label: "Holds",
                          level: level(
                            log(part.capacityGB),
                            values(cat.storage, (item) => log(item.capacityGB)),
                          ),
                          exact: `${part.capacityGB} GB`,
                        },
                        costStat(
                          part.costM,
                          values(cat.storage, (item) => item.costM),
                        ),
                      ]}
                      extra={mini("storage", part.id)}
                    />
                  </Previewable>
                ))}
              </SlotGroup>
            </section>
            <section
              hidden={stage !== "review"}
              aria-labelledby={`${groupId}-review-title`}
              className="rounded-xl border border-border p-5"
            >
              <h2 id={`${groupId}-review-title`}>Review your spacecraft</h2>
              <p>Check your choices and resource limits before launching.</p>
              <dl>
                {workshopDecisions.slice(0, -1).map((item, index) => (
                  <div key={item.slot}>
                    <dt>
                      {item.label}{" "}
                      <button
                        type="button"
                        onClick={() => {
                          setDecisionIndex(index);
                          setInstruction(true);
                        }}
                      >
                        Edit
                      </button>
                    </dt>
                    <dd>
                      {item.slot === "review"
                        ? ""
                        : item.slot === "instruments"
                          ? design.instruments
                              .map((id) => partCopy[id]?.name ?? id)
                              .join(", ") || "Not installed"
                          : item.slot === "groundStations"
                            ? design.groundStations
                            : (partCopy[design[item.slot]]?.name ??
                              "Not installed")}
                    </dd>
                  </div>
                ))}
              </dl>
              {blockers.length ? (
                <ul>
                  {blockers.map((b) => (
                    <li key={b}>! {b}</li>
                  ))}
                </ul>
              ) : (
                <p>
                  ✓ Resource checks passed. Mission success still depends on
                  your design and observations.
                </p>
              )}
            </section>
          </fieldset>

          {/* ---------- One primary action ---------- */}
          <div className="sticky bottom-0 z-10 -mx-4 border-t-[3px] border-space-950 bg-space-900/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-[var(--radius)] sm:border-[3px] sm:px-4">
            <p className="!m-0 mb-2 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[11px] font-bold lg:hidden">
              <span>
                <span aria-hidden="true">
                  {resources.massKg > constraints.massKg ? "✕" : "✓"}{" "}
                </span>
                {resources.massKg}/{constraints.massKg} kg
              </span>
              <span>
                <span aria-hidden="true">
                  {resources.powerUseW > resources.powerGenW ? "✕" : "✓"}{" "}
                </span>
                {resources.powerUseW}/{resources.powerGenW} W
              </span>
              <span>
                <span aria-hidden="true">
                  {resources.costM > constraints.budgetM ? "✕" : "✓"}{" "}
                </span>
                ${resources.costM}/${constraints.budgetM}M
              </span>
              <span>
                <span aria-hidden="true">
                  {resources.dataGBPerDay > resources.downlinkGBPerDay
                    ? "!"
                    : "✓"}{" "}
                </span>
                {resources.dataGBPerDay}/{resources.downlinkGBPerDay} GB/day
              </span>
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div
                id={`${groupId}-launch-status`}
                aria-live="polite"
                className="text-sm"
              >
                {!ready ? (
                  <span>Loading your saved design…</span>
                ) : allDone && blockers.length > 0 ? (
                  <span>
                    <b className="text-pop-pink">
                      <span aria-hidden="true">✕ </span>Can&apos;t launch:
                    </b>{" "}
                    {blockers.join(" · ")}
                  </span>
                ) : allDone ? (
                  <span>
                    <b className="text-pop-lime">
                      <span aria-hidden="true">✓ </span>Ready!
                    </b>{" "}
                    Watch what it finds.
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    {current.label}:{" "}
                    {stageComplete(design, stage)
                      ? "done"
                      : current.id === "eyes"
                        ? "pick at least one"
                        : current.slots.length > 1
                          ? "pick one of each"
                          : "pick one"}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className="btn-pop btn-pop--ghost"
                  onClick={() => setInstruction(true)}
                >
                  ← Back to instructions
                </button>
                {primary}
              </div>
            </div>
            {error && (
              <p role="alert" className="mt-2 text-sm font-bold text-pop-pink">
                {error}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
