"use client";
import { useSyncExternalStore } from "react";

export const tutorialSeenKey = "mission-possible:tutorial-seen";
const changeEvent = "mission-possible:tutorial-updated";

// Fallbacks for blocked storage; they last for the current page session.
let memorySeen = false;
let open = false;

export function readTutorialSeen(): boolean {
  try {
    return localStorage.getItem(tutorialSeenKey) === "1" || memorySeen;
  } catch {
    return memorySeen;
  }
}

function notify() {
  window.dispatchEvent(new Event(changeEvent));
}

/** Remember that the player finished or skipped the tutorial. */
export function markTutorialSeen() {
  memorySeen = true;
  try {
    localStorage.setItem(tutorialSeenKey, "1");
  } catch {
    /* Storage blocked: the in-memory flag still works on this page. */
  }
  notify();
}

export function openTutorial() {
  if (open) return;
  open = true;
  notify();
}

/** Close the tutorial; closing always counts as seen so it never nags again. */
export function closeTutorial() {
  open = false;
  markTutorialSeen();
}

function subscribe(onChange: () => void) {
  window.addEventListener(changeEvent, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(changeEvent, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** `undefined` until the browser value is known (server render and hydration). */
export function useTutorialSeen(): boolean | undefined {
  return useSyncExternalStore<boolean | undefined>(
    subscribe,
    readTutorialSeen,
    () => undefined,
  );
}

export function useTutorialOpen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => open,
    () => false,
  );
}
