"use client";
import { useEffect, useState } from "react";
import type { SatelliteDesign } from "@/types/game";
import type { StoryEvent } from "@/lib/story/events";
import { StoryEventCard } from "./StoryEventCard";
import { SatelliteWorkbench } from "@/components/gameplay/SatelliteWorkbench";
import styles from "@/components/gameplay/gameplay.module.css";

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
    if (step >= 3) {
      onComplete();
      return;
    }
    const t = setTimeout(() => setStep((s) => s + 1), 800);
    return () => clearTimeout(t);
  }, [started, step, reducedMotion, onComplete]);
  return (
    <section
      className={`${styles.shell} ${styles.launch}`}
      aria-labelledby="launch-heading"
    >
      <p className={styles.kicker}>Launch control / {city}</p>
      <h2 id="launch-heading">
        {started ? ["3…", "2…", "1…", "IN ORBIT"][step] : "READY FOR LAUNCH?"}
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

      <SatelliteWorkbench design={design} />
      <div className={styles.launchIndicators} aria-label="Mission readiness">
        <span>{blocker ? "! Check design" : "✓ Satellite ready"}</span>
        <span>◎ {city}</span>
        <span>◷ {responseHours ?? "—"} h response target</span>
      </div>
      <p className="sr-only" role="status">
        {started
          ? `Launch countdown ${3 - step}`
          : "Ready for your launch command"}
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
