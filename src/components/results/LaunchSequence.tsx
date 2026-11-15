"use client";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import type { SatelliteDesign } from "@/types/game";
import type { StoryEvent } from "@/lib/story/events";
import { StoryEventCard } from "./StoryEventCard";
import { LaunchScene } from "./launch/LaunchScene";
import {
  LAUNCH_PHASES,
  autoAdvanceDelay,
  buildLaunchSteps,
  orbitLabel,
  phaseIndexOf,
  phaseStates,
  sceneState,
  totalDurationMs,
} from "./launch/launch-timeline";
import styles from "./launch/launch.module.css";

const phaseMark = { done: "✓", current: "▶", upcoming: "○" } as const;
const phaseWord = {
  done: "complete",
  current: "in progress",
  upcoming: "not started",
} as const;

/**
 * Illustrative launch cinematic: integration, launch, deployment, first look at
 * the target. Purely presentational — skipping or replaying never touches the
 * engineering simulation, which the calling screen runs and saves.
 */
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
  const steps = useMemo(
    () => buildLaunchSteps({ orbit: design.orbit, city }),
    [design.orbit, city],
  );
  // -1 is the "ready for launch" frame on the pad.
  const [index, setIndex] = useState(-1);
  const started = index >= 0;
  const step = started ? steps[index] : null;
  const last = index === steps.length - 1;
  const heading = useRef<HTMLHeadingElement>(null);
  const finish = useEffectEvent(() => onComplete());

  useEffect(() => {
    if (!started) return;
    const delay = autoAdvanceDelay(steps, index, reducedMotion);
    if (delay === null) return;
    const timer = setTimeout(() => {
      if (index >= steps.length - 1) finish();
      else setIndex(index + 1);
    }, delay);
    return () => clearTimeout(timer);
  }, [started, index, reducedMotion, steps]);

  function begin() {
    setIndex(0);
    // The launch button disappears; keep keyboard users anchored on the sequence.
    requestAnimationFrame(() => heading.current?.focus({ preventScroll: true }));
  }

  const scene = sceneState(steps, index);
  const states = phaseStates(steps, index);
  const phase = step ? LAUNCH_PHASES[phaseIndexOf(step.phase)] : null;
  const orbitName = orbitLabel(design.orbit);
  const seconds = Math.round(totalDurationMs(steps) / 1000);
  const announcement = step
    ? `${phase?.label}, step ${index + 1} of ${steps.length}: ${step.title}. ${step.countdown ? "" : step.caption}`
    : blocker
      ? "Launch blocked. Check your design."
      : "Ready for your launch command.";

  return (
    <section
      className={`${styles.shell} ${reducedMotion ? styles.reduced : ""}`}
      aria-labelledby="launch-heading"
    >
      <header className={styles.header}>
        <p className={styles.kicker}>Launch control / {city}</p>
        <h2
          id="launch-heading"
          ref={heading}
          tabIndex={-1}
          className={styles.title}
        >
          {step ? step.title : "READY FOR LAUNCH?"}
        </h2>
      </header>

      <ol className={styles.progress} aria-label="Launch stages">
        {LAUNCH_PHASES.map((p, i) => (
          <li
            key={p.id}
            className={styles.phase}
            data-state={states[i]}
            aria-current={states[i] === "current" ? "step" : undefined}
          >
            <span>
              <span className={styles.phaseMark} aria-hidden="true">
                {phaseMark[states[i]]}
              </span>
              {i + 1}. {p.label}
              <span className="sr-only"> ({phaseWord[states[i]]})</span>
            </span>
          </li>
        ))}
      </ol>

      <div className={styles.layout}>
        <figure className={styles.stage}>
          <LaunchScene
            design={design}
            scene={scene}
            city={city}
            countdown={step?.countdown}
          />
        </figure>

        <div className={styles.panel}>
          <p className={styles.stepMeta}>
            {step
              ? `${phase?.label} · Step ${index + 1} of ${steps.length}`
              : "Pre-launch · Satellite on the crane"}
          </p>
          <p className={styles.caption}>
            {step
              ? step.caption
              : "Your satellite hangs above the open fairing, built exactly as you designed it. Press launch to load it and fly."}
          </p>

          {blocker ? (
            <p role="alert" className={styles.warning}>
              {blocker}
            </p>
          ) : (
            <div className={styles.controls}>
              {!started && (
                <button
                  type="button"
                  className={`primary ${styles.launchButton}`}
                  onClick={begin}
                >
                  LAUNCH SATELLITE →
                </button>
              )}
              {started && reducedMotion && (
                <>
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => setIndex((i) => Math.max(0, i - 1))}
                  >
                    ← Previous step
                  </button>
                  <button
                    type="button"
                    className="primary"
                    onClick={() =>
                      last ? onComplete() : setIndex((i) => i + 1)
                    }
                  >
                    {last ? "Begin observation →" : "Next step →"}
                  </button>
                </>
              )}
              {started && (
                <>
                  <button type="button" onClick={() => setIndex(0)}>
                    ↺ Replay launch
                  </button>
                  <button type="button" onClick={onComplete}>
                    Skip animation →
                  </button>
                </>
              )}
            </div>
          )}

          <p className={styles.note}>
            {reducedMotion
              ? "Motion is reduced: step through the launch at your own pace."
              : `About ${seconds} seconds. Skip at any time; it does not change your result.`}
          </p>

          <dl className={styles.readout} aria-label="Mission readiness">
            <div>
              <dt>Spacecraft</dt>
              <dd>{blocker ? "! Check design" : "✓ Spacecraft configured"}</dd>
            </div>
            <div>
              <dt>Orbit</dt>
              <dd>{orbitName}</dd>
            </div>
            <div>
              <dt>Target</dt>
              <dd>◎ {city}</dd>
            </div>
            <div>
              <dt>Response</dt>
              <dd>◷ {responseHours ?? "—"} h response target</dd>
            </div>
          </dl>
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>

      <details>
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
