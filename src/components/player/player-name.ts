"use client";
import { useSyncExternalStore } from "react";
import { nicknameSchema } from "@/components/results/contracts";

export const playerNameKey = "mission-possible:player-name";
export const playerNameEvent = "mission-possible:player-updated";

// Fallback for browsers that block storage; lasts for the current page session.
let memoryName: string | null = null;

export function readPlayerName(): string | null {
  let raw: string | null = memoryName;
  try {
    raw = localStorage.getItem(playerNameKey) ?? memoryName;
  } catch {
    /* Storage blocked: use the in-memory name. */
  }
  const parsed = nicknameSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** Validate with the shared nickname rules, remember it, and notify listeners. */
export function savePlayerName(input: string): string {
  const name = nicknameSchema.parse(input);
  memoryName = name;
  try {
    localStorage.setItem(playerNameKey, name);
  } catch {
    /* Storage blocked: the in-memory name still works on this page. */
  }
  window.dispatchEvent(new Event(playerNameEvent));
  return name;
}

function subscribe(onChange: () => void) {
  window.addEventListener(playerNameEvent, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(playerNameEvent, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** `undefined` until the browser value is known (server render and hydration). */
export function usePlayerName(): string | null | undefined {
  return useSyncExternalStore<string | null | undefined>(
    subscribe,
    readPlayerName,
    () => undefined,
  );
}
