import { useSyncExternalStore } from "react";

const query = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia?.(query);
  media?.addEventListener("change", onChange);
  return () => media?.removeEventListener("change", onChange);
}

/** True when the player asked the system for reduced motion. Server render assumes motion is fine. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia?.(query).matches ?? false, () => false);
}
