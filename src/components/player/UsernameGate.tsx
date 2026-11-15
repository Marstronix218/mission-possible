"use client";
import { useEffect, useId, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { backendAvailable } from "@/components/results/cloud";
import {
  useTutorialOpen,
  useTutorialSeen,
} from "@/components/tutorial/tutorial-state";
import { usePlayerName } from "./player-name";
import { PlayerNameForm } from "./PlayerNameForm";

/**
 * Friendly first-mission gate: solo players choose a pilot name once before
 * the brief. Classroom players already join with a class nickname, and
 * without a backend (live or mock demo) there is no leaderboard to name.
 */
export function UsernameGate() {
  const name = usePlayerName();
  const classroom = useSearchParams().get("classroom");
  // Wait until the first-time How-to-Play tour is finished or skipped.
  const tutorialSeen = useTutorialSeen();
  const tutorialOpen = useTutorialOpen();
  const tutorialDone = tutorialSeen === true && !tutorialOpen;
  const open = backendAvailable && name === null && !classroom && tutorialDone;
  const dialog = useRef<HTMLDialogElement>(null);
  const wasOpen = useRef(false);
  const titleId = useId();

  useEffect(() => {
    // The gate only closes once a name is saved; continue from the page.
    if (wasOpen.current && !open)
      document.getElementById("main-content")?.focus();
    wasOpen.current = open;
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  if (!open) return null;
  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      className="panel form-panel"
      style={{ margin: "auto", color: "inherit", width: "min(520px, 92vw)" }}
      // A name is required to fly; Escape should not leave a half-open gate.
      onCancel={(e) => e.preventDefault()}
    >
      <div className="eyebrow">Pilot check-in</div>
      <h2 id={titleId} className="font-display">
        👋 Welcome aboard! What should we call you?
      </h2>
      <p>
        Pick a pilot name before your first mission. Your completed missions are
        scored by the simulator and posted to the leaderboard under this name.
        You can change it anytime from the Pilot button in the header.
      </p>
      <PlayerNameForm submitLabel="🚀 Start my mission" />
      <p className="mb-0 mt-3">
        <Link href="/map">← Back to all missions</Link>
      </p>
    </dialog>
  );
}
