"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Mission,
  ResourceSummary,
  SatelliteDesign,
  SimResult,
} from "@/types/game";
import { MissionMap } from "@/components/results/MissionMap";
import {
  cellFrame,
  deliveries,
  deliveryStatus,
  downlinkLatency,
  missionMoments,
  nextMomentHour,
  observationWindowHours,
  playbackPlan,
  storageSeries,
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
  const packages = useMemo(
    () => deliveries(result, downlinkLatency(result, resources)),
    [result, resources],
  );
  const moments = useMemo(() => {
    const windows = observationWindowHours(design);
    return missionMoments(
      mission,
      result,
      packages,
      windows,
      storageSeries(
        resources,
        downlinkLatency(result, resources),
        windows,
        span,
      ),
    );
  }, [mission, result, packages, design, resources, span]);
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
  const grid = new Map(mission.grid.map((c) => [c.id, c]));
  for (const c of result.cells) {
    const g = grid.get(c.id);
    if (!g) continue;
    const f = cellFrame(g, c, hour, span);
    if (f.flagged && !f.falseAlarm) found++;
  }
  const delivered = deliveryStatus(packages, hour);
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
      className={`${styles.shell} ${styles.observation}`}
      aria-label="Simulated Earth observation"
    >
      <p className={styles.kicker}>
        Simulated observation / Hour {Math.floor(hour)} of {Math.round(span)}
      </p>
      <MissionMap
        mission={mission}
        result={result}
        hour={hour}
        mode="live"
        animate={!paused && !reducedMotion && visible}
        label={`${found} hazard zones found by hour ${Math.floor(hour)}.`}
      />
      <p role="status" className={styles.outcomeText}>
        {momentCopy}
      </p>
      <div className={styles.launchIndicators}>
        <span>◎ {found} zones found</span>
        <span>↗ {delivered.delivered} data packages delivered</span>
      </div>
      <p className={styles.credit}>
        ! identified hazard · ☁ blocked look · outline: sensor footprint. Map
        cells and timing come from the engine; this is not live satellite
        footage.
      </p>
      <div className={styles.row}>
        <button
          className={styles.secondary}
          disabled={hour >= span || reducedMotion}
          onClick={() => setPaused(!paused)}
        >
          {paused ? "Resume" : "Pause"}
        </button>
        <button
          className={styles.secondary}
          disabled={next === null || hour >= span}
          onClick={() => {
            if (next !== null) setHour(next);
          }}
        >
          Next observation →
        </button>
      </div>
    </section>
  );
}
