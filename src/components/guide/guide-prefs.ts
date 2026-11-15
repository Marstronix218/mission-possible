"use client";
import { useSyncExternalStore } from "react";

export type GuidePref = "hidden" | "muted";

const keys: Record<GuidePref, string> = {
  hidden: "mission-possible:guide-hidden",
  muted: "mission-possible:guide-muted",
};
const changeEvent = "mission-possible:guide-updated";
// Fallback for blocked storage; lasts for the current page session.
const memory: Record<GuidePref, boolean> = { hidden: false, muted: false };

function read(pref: GuidePref): boolean {
  try {
    const raw = localStorage.getItem(keys[pref]);
    return raw === null ? memory[pref] : raw === "1";
  } catch {
    return memory[pref];
  }
}

export function setGuidePref(pref: GuidePref, value: boolean) {
  memory[pref] = value;
  try {
    localStorage.setItem(keys[pref], value ? "1" : "0");
  } catch {
    /* Storage blocked: the in-memory value still works on this page. */
  }
  window.dispatchEvent(new Event(changeEvent));
}

function subscribe(onChange: () => void) {
  window.addEventListener(changeEvent, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(changeEvent, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Defaults to visible and unmuted, including on the server. */
export function useGuidePref(pref: GuidePref): boolean {
  return useSyncExternalStore(
    subscribe,
    () => read(pref),
    () => false,
  );
}
