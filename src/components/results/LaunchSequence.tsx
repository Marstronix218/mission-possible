"use client";
import { useEffect, useState } from "react";
import type { SatelliteDesign } from "@/types/game";
import type { StoryEvent } from "@/lib/story/events";
import { StoryEventCard } from "./StoryEventCard";
import { SatelliteWorkbench } from "@/components/gameplay/SatelliteWorkbench";
import styles from "@/components/gameplay/gameplay.module.css";

const launchStages = [
  {
    title: "SYSTEMS READY",
    detail: "Final spacecraft checks complete.",
  },
  { title: "3… IGNITION", detail: "Launch sequence started." },
  { title: "2… LIFTOFF", detail: "Vehicle climbing away from Earth." },
  { title: "1… DEPLOY", detail: "Spacecraft separating from the vehicle." },
  {
    title: "SATELLITE IN ORBIT",
    detail: "Solar arrays deployed. Mission control has the spacecraft.",
  },
] as const;

/** A short optional cinematic; the calling screen still runs and saves the engineering simulation. */
export function LaunchSequence({
  events,
  design,
  reducedMotion,
  onComplete,
  city = "Earth",
  responseHours,
  blocker,
}: {
  events: StoryEvent[];
  design: SatelliteDesign;
  reducedMotion: boolean;
  onComplete: () => void;
  city?: string;
  responseHours?: number;
  blocker?: string | null;
}) {
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!started || reducedMotion) return;
    const last = launchStages.length - 1;
    const t = setTimeout(
      () => {
        if (step >= last) onComplete();
        else setStep((current) => current + 1);
      },
      step >= last ? 1100 : 760,
    );
    return () => clearTimeout(t);
  }, [started, step, reducedMotion, onComplete]);
  const current = launchStages[step];
  return (
    <section
      className={`${styles.shell} ${styles.launch}`}
      aria-labelledby="launch-heading"
    >
      <p className={styles.kicker}>Launch control / {city}</p>
      <h2 id="launch-heading">
        {started ? current.title : "READY FOR LAUNCH?"}
      </h2>
      {blocker ? (
        <p role="alert" className={styles.warning}>
          {blocker}
        </p>
      ) : started ? (
        <button className={styles.secondary} onClick={onComplete}>
          Skip to observation →
        </button>
      ) : (
        <button
          className={styles.primary}
          onClick={() => {
            if (reducedMotion) onComplete();
            else setStarted(true);
          }}
        >
          LAUNCH SATELLITE →
        </button>
      )}

      {started ? (
        <div
          className={styles.launchScene}
          data-stage={step}
          aria-hidden="true"
        >
          <div className={styles.launchStars} />
          <div className={styles.earthHorizon} />
          <div className={styles.rocket}>
            <span className={styles.rocketNose} />
            <span className={styles.rocketBody} />
            <span className={styles.rocketFinLeft} />
            <span className={styles.rocketFinRight} />
            <span className={styles.rocketFlame} />
          </div>
          <div className={styles.deployedSatellite}>
            <span />
            <strong />
            <span />
          </div>
          <div className={styles.launchTrack}>
            {launchStages.map((stage, index) => (
              <span
                key={stage.title}
                className={index <= step ? styles.trackDone : undefined}
              />
            ))}
          </div>
        </div>
      ) : (
        <SatelliteWorkbench design={design} />
      )}
      {started && (
        <p className={styles.launchStatus} role="status">
          {current.detail}
        </p>
      )}
      <div className={styles.launchIndicators} aria-label="Mission readiness">
        <span>{blocker ? "! Check design" : "✓ Spacecraft configured"}</span>
        <span>◎ Target: {city}</span>
        <span>◷ {responseHours ?? "—"} h response target</span>
      </div>
      <p className="sr-only" role="status">
        {started ? current.detail : "Ready for your launch command"}
      </p>
      <details className="mt-6 text-left">
        <summary>Optional engineering details</summary>
        <p>
          This launch is illustrative. Your actual observation, delivery and
          score are computed by the mission engine.
        </p>
        <div className="grid gap-2">
          {events.map((e) => (
            <StoryEventCard
              key={e.id}
              event={e}
              design={design}
              showHour={false}
            />
          ))}
        </div>
      </details>
    </section>
  );
}
