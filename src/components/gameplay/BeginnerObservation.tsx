"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Mission,
  ResourceSummary,
  SatelliteDesign,
  SimResult,
} from "@/types/game";
import { partsCatalog } from "@/lib/sim";
import { ObservationView } from "@/components/results/observation/ObservationView";
import { MissionOrbit } from "@/components/results/MissionOrbit";
import {
  cellFrame,
  deliveries,
  deliveryStatus,
  downlinkLatency,
  missionMoments,
  nextMomentHour,
  observationWindowHours,
  playbackPlan,
  storageAt,
  storageSeries,
  windowState,
} from "@/components/results/mission-playback";
import styles from "./gameplay.module.css";

/** A view of the existing result's events; no new probabilities or score changes. */
export function BeginnerObservation({
  mission,
  design,
  resources,
  result,
  reducedMotion,
  onEnd,
}: {
  mission: Mission;
  design: SatelliteDesign;
  resources: ResourceSummary;
  result: SimResult;
  reducedMotion: boolean;
  onEnd: () => void;
}) {
  const [hour, setHour] = useState(0);
  const [paused, setPaused] = useState(false);
  const root = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(true);
  const plan = useMemo(() => playbackPlan(mission, result), [mission, result]);
  const span = plan.spanHours;
  const windowHours = useMemo(() => observationWindowHours(design), [design]);
  const latency = downlinkLatency(result, resources);
  const packages = useMemo(
    () => deliveries(result, latency),
    [result, latency],
  );
  const storage = useMemo(
    () => storageSeries(resources, latency, windowHours, span),
    [resources, latency, windowHours, span],
  );
  const moments = useMemo(() => {
    return missionMoments(mission, result, packages, windowHours, storage);
  }, [mission, result, packages, windowHours, storage]);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let inView = true;
    const io = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        setVisible(inView && !document.hidden);
      },
      { threshold: 0.1 },
    );
    io.observe(el);
    const changed = () => setVisible(inView && !document.hidden);
    document.addEventListener("visibilitychange", changed);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", changed);
    };
  }, []);
  useEffect(() => {
    if (paused || reducedMotion || !visible || hour >= span) return;
    let last = performance.now();
    const timer = setInterval(() => {
      const now = performance.now();
      const delta = now - last;
      last = now;
      setHour((h) => Math.min(span, h + (delta * span) / 18000));
    }, 100);
    return () => clearInterval(timer);
  }, [paused, reducedMotion, visible, hour, span]);
  useEffect(() => {
    if (hour >= span) onEnd();
  }, [hour, span, onEnd]);
  let found = 0;
  let active = 0;
  let observed = 0;
  const grid = new Map(mission.grid.map((c) => [c.id, c]));
  for (const c of result.cells) {
    const g = grid.get(c.id);
    if (!g) continue;
    const f = cellFrame(g, c, hour, span);
    if (f.hazardActive) active++;
    if (f.seen) observed++;
    if (f.flagged && !f.falseAlarm) found++;
  }
  const delivery = deliveryStatus(packages, hour);
  const stored = storageAt(storage, hour);
  const window = windowState(windowHours, hour, span);
  const payload = partsCatalog.instruments.find(
    (part) => part.id === design.instruments[0],
  );
  const progress = Math.min(100, (hour / span) * 100);
  const day = Math.min(mission.durationDays, Math.floor(hour / 24) + 1);
  const deadlineRemaining = Math.max(0, mission.targetResponseHours - hour);
  const deliveredInTime =
    result.firstDeliveryHours !== null &&
    result.firstDeliveryHours <= mission.targetResponseHours;
  const latest = moments.filter((m) => m.hour <= hour).at(-1);
  const momentCopy =
    latest?.kind === "blocked"
      ? "Cloud or smoke interrupted an observation."
      : latest?.kind === "detect"
        ? "Your sensor identified a hazard zone."
        : latest?.kind === "delivery"
          ? "Observations reached the ground team."
          : latest?.kind === "deadline"
            ? result.firstDeliveryHours !== null &&
              result.firstDeliveryHours <= mission.targetResponseHours
              ? "Your first data arrived within the response target."
              : "The response target passed before your first data arrived."
            : latest?.kind === "storage-full"
              ? "The modeled storage estimate reached capacity."
              : latest?.kind === "onset"
                ? "The hazard changed in the mission scenario."
                : "Watch each observation opportunity.";
  const next = nextMomentHour(moments, hour);
  return (
    <section
      ref={root}
      className={`${styles.shell} ${styles.missionControl}`}
      aria-label="Simulated Earth observation"
    >
      <header className={styles.controlHeader}>
        <div>
          <p className={styles.kicker}>Orbital operations / {mission.city}</p>
          <h2>Satellite Mission Control</h2>
          <p>{mission.objective.en}</p>
        </div>
        <div className={styles.missionClock}>
          <span>MISSION ELAPSED</span>
          <strong>H+{Math.floor(hour).toString().padStart(3, "0")}</strong>
          <small>
            Day {day} of {mission.durationDays}
          </small>
        </div>
      </header>

      <div className={styles.controlGrid}>
        <div className={styles.earthPanel}>
          <div className={styles.panelHeader}>
            <div>
              <span>EARTH OBSERVATION</span>
              <strong>{mission.city} mission area</strong>
            </div>
            <span
              className={`${styles.passState} ${window.open ? styles.passOpen : ""}`}
            >
              {window.open ? "● SENSOR LOOK ACTIVE" : "○ BETWEEN PASSES"}
            </span>
          </div>
          <ObservationView
            mission={mission}
            design={design}
            resources={resources}
            result={result}
            hour={hour}
            mode="live"
            animate={!paused && !reducedMotion && visible}
          />
          <p role="status" aria-live="polite" className={styles.eventCallout}>
            <span aria-hidden="true">
              {latest?.kind === "blocked"
                ? "☁"
                : latest?.kind === "delivery"
                  ? "📡"
                  : latest?.kind === "detect"
                    ? "◎"
                    : "🛰️"}
            </span>
            Latest event: {momentCopy}
          </p>
        </div>

        <aside className={styles.telemetryRail} aria-label="Mission telemetry">
          <section className={styles.orbitCard}>
            <div className={styles.panelHeader}>
              <div>
                <span>SPACECRAFT</span>
                <strong>{payload?.name ?? "Mission satellite"}</strong>
              </div>
              <span className={styles.liveDot}>LIVE</span>
            </div>
            <MissionOrbit
              city={mission.city}
              windowHours={windowHours}
              hour={hour}
              span={span}
              stations={design.groundStations}
              transmitting={delivery.onboard > 0 || stored > 0.05}
              geo={design.orbit === "geo"}
              animate={!paused && !reducedMotion && visible}
            />
            <p className={styles.orbitStatus}>
              {window.open
                ? `Passing over ${mission.city} — collecting observations.`
                : Number.isFinite(window.untilOpen)
                  ? `Next modeled observation window in ${window.untilOpen.toFixed(1)} h.`
                  : "Final observation window complete."}
            </p>
          </section>

          <section className={styles.telemetryCard}>
            <h3>Mission telemetry</h3>
            <dl className={styles.telemetryList}>
              <div>
                <dt>Area observed</dt>
                <dd>
                  {observed} / {result.cells.length}
                </dd>
              </div>
              <div>
                <dt>Confirmed detections</dt>
                <dd>
                  {found} / {active} active
                </dd>
              </div>
              <div>
                <dt>Data packages</dt>
                <dd>
                  {delivery.delivered} ground · {delivery.onboard} onboard
                </dd>
              </div>
              <div>
                <dt>Storage estimate</dt>
                <dd>
                  {stored.toFixed(1)} / {storage.capacityGB} GB
                </dd>
              </div>
            </dl>
            <div
              className={styles.storageMeter}
              role="meter"
              aria-label="Estimated onboard storage used"
              aria-valuemin={0}
              aria-valuemax={storage.capacityGB}
              aria-valuenow={Number(stored.toFixed(1))}
            >
              <span
                style={{
                  width: `${storage.capacityGB ? Math.min(100, (stored / storage.capacityGB) * 100) : 0}%`,
                }}
              />
            </div>
            <p className={styles.deadlineStatus}>
              {delivery.delivered > 0
                ? deliveredInTime
                  ? `✓ First data met the ${mission.targetResponseHours} h target.`
                  : `! First data arrived after the ${mission.targetResponseHours} h target.`
                : deadlineRemaining > 0
                  ? `${deadlineRemaining.toFixed(1)} h until the first-data target.`
                  : "First-data target passed; no package delivered yet."}
            </p>
          </section>
        </aside>
      </div>

      <div className={styles.controlFooter}>
        <div className={styles.missionProgress}>
          <span style={{ width: `${progress}%` }} />
        </div>
        <div className={styles.controlActions}>
          <button
            className={styles.secondary}
            disabled={hour >= span || reducedMotion}
            onClick={() => setPaused(!paused)}
          >
            {paused ? "▶ Resume mission" : "❚❚ Pause mission"}
          </button>
          <button
            className={styles.secondary}
            disabled={next === null || hour >= span}
            onClick={() => {
              if (next !== null) setHour(next);
            }}
          >
            Next mission event →
          </button>
        </div>
        <p className={styles.simulationNote}>
          Engine-backed cells, timing, detections, storage, and delivery ·
          simplified orbit diagram · not live satellite footage
        </p>
      </div>
    </section>
  );
}
