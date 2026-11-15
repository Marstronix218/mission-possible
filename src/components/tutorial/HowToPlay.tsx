"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useReducedMotion } from "@/components/designer/useReducedMotion";
import {
  tutorialFinish,
  tutorialIntro,
  tutorialSteps,
} from "@/components/guide/guide-copy";
import { TutorialArt, type SceneId } from "./TutorialArt";
import {
  closeTutorial,
  openTutorial,
  useTutorialOpen,
} from "./tutorial-state";
import styles from "./tutorial.module.css";

const total = tutorialSteps.length;

/** Mount once (the site header does); it renders only while the tutorial is open. */
export function TutorialHost() {
  return useTutorialOpen() ? <TutorialDialog /> : null;
}

function TutorialDialog() {
  // 0 is the welcome screen; 1…total are the steps.
  const [index, setIndex] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const textId = useId();
  const still = useReducedMotion();
  const step = index > 0 ? tutorialSteps[index - 1] : null;
  const last = index === total;

  useEffect(() => {
    const el = dialog.current;
    const returnTo =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    if (el && !el.open) el.showModal();
    return () => {
      if (el?.open) el.close();
      // Back to where the player was; another dialog opening next takes focus itself.
      const target =
        returnTo && returnTo.isConnected && returnTo !== document.body
          ? returnTo
          : document.getElementById("main-content");
      target?.focus();
    };
  }, []);

  // Each new screen is announced by moving focus to its heading.
  useEffect(() => {
    heading.current?.focus();
  }, [index]);

  const go = (next: number) => setIndex(Math.max(0, Math.min(total, next)));

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby={titleId}
      aria-describedby={textId}
      // Escape skips the tour (it never comes back uninvited).
      onCancel={(e) => {
        e.preventDefault();
        closeTutorial();
      }}
      onKeyDown={(e) => {
        if (e.target instanceof HTMLInputElement) return;
        if (e.key === "ArrowRight" && !last) go(index + 1);
        if (e.key === "ArrowLeft" && index > 0) go(index - 1);
      }}
    >
      <div className={styles.frame}>
        <div className={styles.top}>
          <p className={styles.tag}>How to play</p>
          {!last && (
            <button
              type="button"
              className="btn-pop btn-pop--ghost btn-pop--sm"
              onClick={closeTutorial}
            >
              Skip tutorial
            </button>
          )}
        </div>

        <div key={index} className={styles.stage}>
          <div className={styles.viewport}>
            <TutorialArt
              scene={(step?.id ?? "intro") as SceneId}
              still={still}
            />
          </div>
          {step && (
            <p className={styles.stepNo} aria-hidden="true">
              STEP {index}
            </p>
          )}
          <h2
            id={titleId}
            ref={heading}
            tabIndex={-1}
            className={`${styles.title} ${step ? "" : styles.welcome}`}
          >
            {step ? (
              <>
                <span className="sr-only">
                  Step {index} of {total}:{" "}
                </span>
                {step.title}
              </>
            ) : (
              tutorialIntro.title
            )}
          </h2>
          <p id={textId} className={styles.text}>
            {step ? step.text : tutorialIntro.text}
          </p>
        </div>

        <div className={styles.bottom}>
          <div className={styles.progress}>
            <ol className={styles.dots} aria-label="Tutorial steps">
              {tutorialSteps.map((s, i) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className={styles.dot}
                    aria-label={`Step ${i + 1}: ${s.title}`}
                    aria-current={index === i + 1 ? "step" : undefined}
                    data-done={index > i + 1 ? "true" : undefined}
                    onClick={() => go(i + 1)}
                  />
                </li>
              ))}
            </ol>
            <p className={styles.count} aria-hidden="true">
              {step ? `Step ${index} of ${total}` : "Welcome"}
            </p>
          </div>
          <div className={styles.nav}>
            {index > 0 && (
              <button
                type="button"
                className="btn-pop btn-pop--ghost"
                onClick={() => go(index - 1)}
              >
                <span aria-hidden="true">←</span> Back
              </button>
            )}
            {last ? (
              <button
                type="button"
                className={`btn-pop btn-pop--lime ${styles.navNext}`}
                onClick={closeTutorial}
              >
                {tutorialFinish} <span aria-hidden="true">🚀</span>
              </button>
            ) : (
              <button
                type="button"
                className={`btn-pop ${styles.navNext}`}
                onClick={() => go(index + 1)}
              >
                {index === 0 ? tutorialIntro.start : "Next"}{" "}
                <span aria-hidden="true">→</span>
              </button>
            )}
          </div>
          <p className={styles.hint} aria-hidden="true">
            Tip: use the ← → arrow keys. Press Esc to skip.
          </p>
        </div>
      </div>
    </dialog>
  );
}

/** Replay button for the header and the map. */
export function HowToPlayButton({
  className = "btn-pop btn-pop--ghost btn-pop--sm",
}: {
  className?: string;
}) {
  return (
    <button type="button" className={className} onClick={openTutorial}>
      <span aria-hidden="true">❔</span>
      <span>How to play</span>
    </button>
  );
}
