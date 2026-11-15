"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { Mission, SatelliteDesign } from "@/types/game";
import { summarizeResources, partsCatalog } from "@/lib/sim";
import { designSchema } from "@/components/results/contracts";
import {
  draftKey,
  designerDraftKey,
  loadAttempts,
} from "@/components/results/session";
import { causeLines } from "@/components/results/mission-debrief";
import {
  beginnerSensors,
  constraintChecks,
  modeKey,
  neutralObstacle,
  sensorNames,
  starterDesign,
} from "./beginner-model";
import { SatelliteWorkbench, SensorArt } from "./SatelliteWorkbench";
import { MissionGuide } from "@/components/guide/MissionGuide";
import { designHint } from "@/components/guide/guide-context";
import styles from "./gameplay.module.css";

type UpgradeSlot =
  "comm" | "solar" | "battery" | "storage" | "orbit" | "groundStations";
const upgrades: Record<
  UpgradeSlot,
  { title: string; choices: { id: string; name: string }[] }
> = {
  comm: {
    title: "How will your data get home?",
    choices: partsCatalog.communications.map((p) => ({
      id: p.id,
      name: p.name,
    })),
  },
  solar: {
    title: "Give your satellite more energy",
    choices: partsCatalog.solar,
  },
  battery: {
    title: "Keep working in Earth's shadow",
    choices: partsCatalog.batteries,
  },
  storage: {
    title: "Make room for your observations",
    choices: partsCatalog.storage,
  },
  orbit: {
    title: "Try a different path",
    choices: partsCatalog.orbits,
  },
  groundStations: {
    title: "Give Earth more chances to listen",
    choices: [1, 3, 5].map((n) => ({
      id: String(n),
      name: `${n} ground station${n === 1 ? "" : "s"}`,
    })),
  },
};

export default function BeginnerWorkshop({
  mission,
  quick = false,
}: {
  mission: Mission;
  quick?: boolean;
}) {
  const router = useRouter();
  const [design, setDesign] = useState<SatelliteDesign>(() => ({
    ...starterDesign("", mission),
    instruments: [],
  }));
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [challenge, setChallenge] = useState<{
    slot: UpgradeSlot;
    reason: string;
  } | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [platformSlot, setPlatformSlot] = useState<UpgradeSlot>("orbit");
  const [drag, setDrag] = useState<{
    id: string;
    x: number;
    y: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);
  const target = useRef<HTMLDivElement>(null);
  const hasPayload = useRef(false);
  const r = summarizeResources(design, mission.defaultConstraints);
  // The design before the last change, so the guide can react to it.
  const [previous, setPrevious] = useState<SatelliteDesign | null>(null);
  const hint = designHint({
    design,
    resources: r,
    constraints: mission.defaultConstraints,
    category: mission.category,
    previousDesign: previous,
    previousResources: previous
      ? summarizeResources(previous, mission.defaultConstraints)
      : null,
  });
  useEffect(() => {
    let active = true;
    async function hydrate() {
      await Promise.resolve();
      if (!active) return;
      try {
        const preferred = localStorage.getItem(modeKey(mission.slug));
        if (preferred === "advanced" && !quick) {
          const query = new URLSearchParams(window.location.search);
          query.set("mode", "advanced");
          router.replace(`/mission/${mission.slug}/design?${query}`);
          return;
        }
        const raw = localStorage.getItem(designerDraftKey(mission.slug));
        const parsed = designSchema.safeParse(
          raw ? JSON.parse(raw)?.state?.design : null,
        );
        if (parsed.success) {
          setDesign(parsed.data);
          hasPayload.current = true;
        }
        const last = loadAttempts()
          .filter((a) => a.slug === mission.slug && !a.classroomId)
          .at(-1);
        if (last) {
          const causes = causeLines(mission, last.design, last.result);
          const next = causes.find((c) => c.slot && c.slot !== "instruments");
          if (next?.slot && next.slot in upgrades) {
            setChallenge({ slot: next.slot as UpgradeSlot, reason: next.text });
          }
        }
        localStorage.setItem(modeKey(mission.slug), "beginner");
      } catch {
        setError(
          "Saved designs are unavailable. You can still choose a sensor; enable browser storage before launch.",
        );
      }
      setReady(true);
    }
    void hydrate();
    return () => {
      active = false;
    };
  }, [mission, router, quick]);
  function persist(next: SatelliteDesign) {
    setPrevious(design);
    setDesign(next);
    try {
      localStorage.setItem(draftKey(mission.slug), JSON.stringify(next));
      localStorage.setItem(
        designerDraftKey(mission.slug),
        JSON.stringify({ state: { design: next }, version: 0 }),
      );
      localStorage.setItem(modeKey(mission.slug), "beginner");
      setError("");
      return true;
    } catch {
      setError(
        "Your design could not be saved. Enable browser storage and try again.",
      );
      return false;
    }
  }
  function attach(id: string) {
    const next = hasPayload.current
      ? { ...design, instruments: [id], decisions: undefined }
      : starterDesign(id, mission);
    // Supply enough array capacity for a first payload; later upgrades are preserved.
    const sensor = partsCatalog.instruments.find((p) => p.id === id);
    if (sensor && sensor.powerW + 65 > 400 && next.solar === "solar_m")
      next.solar = "solar_l";
    hasPayload.current = true;
    persist(next);
    setStatus(`${sensorNames[id][0]} attached. Ready to launch.`);
  }
  function move(e: PointerEvent<HTMLButtonElement>) {
    if (!drag || drag.id !== e.currentTarget.dataset.sensor) return;
    const moved =
      drag.moved ||
      Math.hypot(e.clientX - drag.originX, e.clientY - drag.originY) > 10;
    setDrag({ ...drag, x: e.clientX, y: e.clientY, moved });
  }
  function release(e: PointerEvent<HTMLButtonElement>) {
    if (!drag) return;
    const box = target.current?.getBoundingClientRect();
    const inside =
      box &&
      e.clientX >= box.left &&
      e.clientX <= box.right &&
      e.clientY >= box.top &&
      e.clientY <= box.bottom;
    if (drag.moved && inside) attach(drag.id);
    else if (drag.moved)
      setStatus(
        "Release over the satellite to attach, or select a sensor with a click.",
      );
    setDrag(null);
  }
  function launch() {
    if (r.violations.length || !persist(design)) return;
    router.push(`/mission/${mission.slug}/run`);
  }
  return (
    <article className={styles.shell}>
      <div className={styles.row}>
        <Link href={`/mission/${mission.slug}/brief`}>← Mission letter</Link>
        <Link
          className={styles.secondary}
          href={`/mission/${mission.slug}/design?mode=advanced`}
        >
          Advanced Mode
        </Link>
      </div>
      <p className={styles.kicker}>{mission.city} / Explorer workshop</p>
      <h1>How would you observe it?</h1>
      <p>{neutralObstacle(mission)}</p>
      {ready && (
        <MissionGuide
          stage={design.instruments.length ? "resources" : "workshop"}
          hint={design.instruments.length ? hint : null}
        />
      )}
      <SatelliteWorkbench
        design={design}
        attaching={!!drag?.moved}
        targetRef={target}
      />
      <p className={styles.status} role="status">
        {status || "Choose a sensor, or drag one onto the satellite."}
      </p>
      <div
        className={styles.sensors}
        role="group"
        aria-label="Choose one sensor"
      >
        {beginnerSensors(mission).map((id) => (
          <button
            key={id}
            data-sensor={id}
            className={`${styles.sensor} ${design.instruments.includes(id) ? styles.selected : ""}`}
            disabled={!ready}
            aria-pressed={design.instruments.includes(id)}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              setDrag({
                id,
                x: e.clientX,
                y: e.clientY,
                originX: e.clientX,
                originY: e.clientY,
                moved: false,
              });
            }}
            onPointerMove={move}
            onPointerUp={release}
            onPointerCancel={() => setDrag(null)}
            onClick={() => attach(id)}
          >
            <SensorArt id={id} />
            <h3>{sensorNames[id][0]}</h3>
            <p>{sensorNames[id][1]}</p>
            <span>
              {design.instruments.includes(id)
                ? "✓ Installed"
                : "Attach sensor →"}
            </span>
          </button>
        ))}
      </div>
      {drag?.moved && (
        <span
          className={styles.ghost}
          style={{ left: drag.x + 12, top: drag.y - 25 }}
        >
          {sensorNames[drag.id][0]}
        </span>
      )}
      {challenge && (
        <section className={styles.observation}>
          <p className={styles.kicker}>From your last attempt</p>
          <p>{challenge.reason}</p>
          <button
            className={styles.secondary}
            onClick={() => setShowUpgrade(!showUpgrade)}
            aria-expanded={showUpgrade}
          >
            {showUpgrade ? "Close upgrade" : "Try one upgrade"}
          </button>
          {showUpgrade && (
            <>
              <h2>{upgrades[challenge.slot].title}</h2>
              <div className={styles.row}>
                {upgrades[challenge.slot].choices.map((p) => (
                  <button
                    key={p.id}
                    className={styles.secondary}
                    aria-pressed={String(design[challenge.slot]) === p.id}
                    onClick={() => {
                      persist({
                        ...design,
                        [challenge.slot]:
                          challenge.slot === "groundStations"
                            ? Number(p.id)
                            : p.id,
                      });
                      setStatus(
                        `${p.name} installed. Check your next observation.`,
                      );
                    }}
                  >
                    {p.name}
                    {String(design[challenge.slot]) === p.id ? " ✓" : ""}
                  </button>
                ))}
              </div>
            </>
          )}
        </section>
      )}
      {design.instruments.length > 0 && (
        <>
          <button
            className={styles.secondary}
            onClick={() => {
              persist({ ...design, instruments: [] });
              setStatus("Sensor removed. Pick a new payload.");
            }}
          >
            Remove sensor
          </button>
          <div className={styles.checks}>
            {constraintChecks(design, mission).map((c) => (
              <details key={c.label}>
                <summary>
                  {c.good ? "✓" : "!"} {c.label}
                </summary>
                <p>{c.text}</p>
                <p>{c.help}</p>
              </details>
            ))}
          </div>
          {r.violations.length > 0 && (
            <p role="alert" className={styles.warning}>
              {r.violations.join(" ")} Change a part under &ldquo;Change the
              supplied platform&rdquo; or in Advanced Mode.
            </p>
          )}
          <div className={styles.row}>
            <p>Launch the satellite and see what it observes.</p>
            <button
              className={styles.primary}
              onClick={launch}
              disabled={!ready || r.violations.length > 0}
            >
              TO LAUNCH →
            </button>
          </div>
        </>
      )}
      {error && (
        <p role="alert" className={styles.warning}>
          {error}
        </p>
      )}
      <details className="mt-6">
        <summary>Change the supplied platform (optional)</summary>
        <p>
          Every part is available now. Pick a system, then a part; the checks
          above update with the real resource totals.
        </p>
        <div className={styles.row} role="group" aria-label="System to change">
          {(Object.keys(upgrades) as UpgradeSlot[]).map((slot) => (
            <button
              key={slot}
              className={styles.secondary}
              aria-pressed={platformSlot === slot}
              onClick={() => setPlatformSlot(slot)}
            >
              {slot === "groundStations"
                ? "Ground stations"
                : slot === "comm"
                  ? "Radio"
                  : slot[0].toUpperCase() + slot.slice(1)}
            </button>
          ))}
        </div>
        <h2>{upgrades[platformSlot].title}</h2>
        <div
          className={styles.row}
          role="group"
          aria-label={upgrades[platformSlot].title}
        >
          {upgrades[platformSlot].choices.map((p) => (
            <button
              key={p.id}
              className={styles.secondary}
              disabled={!ready}
              aria-pressed={String(design[platformSlot]) === p.id}
              onClick={() => {
                persist({
                  ...design,
                  [platformSlot]:
                    platformSlot === "groundStations" ? Number(p.id) : p.id,
                });
                // Keep platform edits when a sensor is attached afterwards.
                hasPayload.current = true;
                setStatus(`${p.name} installed.`);
              }}
            >
              {p.name}
              {String(design[platformSlot]) === p.id ? " ✓" : ""}
            </button>
          ))}
        </div>
      </details>
      <details className="mt-6">
        <summary>About your supplied platform</summary>
        <p>
          The solar array, battery, radio, memory and orbit are pre-fitted. No
          sensor is recommended. The same engineering model evaluates every
          attempt; thermal measurements refer to surface radiation, not air
          temperature. Radar does not measure surface temperature.
        </p>
        <p>
          Advanced Mode adds radar comparisons, a full resource dashboard and up
          to three sensors.
        </p>
      </details>
    </article>
  );
}
