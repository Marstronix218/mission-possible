"use client";
import { useEffect, useRef, useState } from "react";
import type { SimResult } from "@/types/game";
import { openTutorial } from "@/components/tutorial/tutorial-state";
import { guideName, guideRole, stageLines, type GuideStage } from "./guide-copy";
import { resultLine, type GuideHint } from "./guide-context";
import { setGuidePref, useGuidePref } from "./guide-prefs";
import { GuideAvatar, type GuideMood } from "./GuideAvatar";
import styles from "./guide.module.css";

/** Minimum time a message stays up before the next one replaces it. */
export const GUIDE_COOLDOWN_MS = 2500;

interface Message {
  key: string;
  label: string;
  text: string;
  mood: GuideMood;
}

function pick(
  stage: GuideStage,
  hint: GuideHint | null | undefined,
  result: SimResult | null | undefined,
  muted: boolean,
): Message {
  if (hint && !muted) {
    const label =
      hint.tone === "celebrate" ? "Nice!" : hint.tone === "fix" ? "Heads up" : "Tip";
    const mood: GuideMood =
      hint.tone === "celebrate" ? "happy" : hint.tone === "fix" ? "thinking" : "neutral";
    return { key: `hint:${hint.id}:${hint.text}`, label, text: hint.text, mood };
  }
  if (stage === "results" && result)
    return {
      key: `results:${result.score.total}:${result.success}`,
      label: result.success ? "Well done!" : "Debrief",
      text: resultLine(result),
      mood: result.success ? "happy" : "neutral",
    };
  return {
    key: `stage:${stage}`,
    label: "Next step",
    text: stageLines[stage],
    mood: stage === "launch" ? "happy" : "neutral",
  };
}

/**
 * Nova, the optional mission guide: one short instruction per screen, plus
 * context hints from real design numbers. Messages change only when the stage
 * or the hint changes, never faster than the cooldown, and are announced politely.
 */
export function MissionGuide({
  stage,
  hint,
  result,
}: {
  stage: GuideStage;
  hint?: GuideHint | null;
  result?: SimResult | null;
}) {
  const hidden = useGuidePref("hidden");
  const muted = useGuidePref("muted");
  const target = pick(stage, hint, result, muted);
  const [shown, setShown] = useState<Message>(target);
  const changedAt = useRef(0);

  useEffect(() => {
    if (target.key === shown.key) return;
    const wait = Math.max(
      0,
      changedAt.current + GUIDE_COOLDOWN_MS - Date.now(),
    );
    const timer = window.setTimeout(() => {
      changedAt.current = Date.now();
      setShown(target);
    }, wait);
    return () => window.clearTimeout(timer);
    // `target` is rebuilt every render; its key identifies the message.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.key, shown.key]);

  if (hidden)
    return (
      <div className={styles.dock}>
        <button
          type="button"
          className={styles.showButton}
          onClick={() => setGuidePref("hidden", false)}
        >
          <span className={styles.miniAvatar}>
            <GuideAvatar mood="neutral" />
          </span>
          Show guide
        </button>
      </div>
    );

  return (
    <aside className={styles.dock} aria-label={`${guideName}, your ${guideRole.toLowerCase()}`}>
      <div className={styles.guide}>
        <div key={shown.key} className={styles.avatar} data-mood={shown.mood}>
          <GuideAvatar mood={shown.mood} />
        </div>
        <div className={styles.bubble} data-mood={shown.mood}>
          <p className={styles.who}>
            <strong>{guideName}</strong>
            <span aria-hidden="true"> · </span>
            <span className={styles.label}>{shown.label}</span>
          </p>
          <p className={styles.text} aria-live="polite" aria-atomic="true">
            {shown.text}
          </p>
          <div className={styles.controls}>
            <button
              type="button"
              aria-pressed={muted}
              onClick={() => setGuidePref("muted", !muted)}
            >
              {muted ? "Unmute hints" : "Mute hints"}
            </button>
            <button type="button" onClick={openTutorial}>
              How to play
            </button>
            <button
              type="button"
              onClick={() => setGuidePref("hidden", true)}
            >
              Hide guide
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
