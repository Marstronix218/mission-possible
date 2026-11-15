import type { SimResult } from "@/types/game";
import { isTrueDetection } from "./mission-playback";

// The canvas grid map that used to live here was replaced by
// ./observation/ObservationView (real NASA reference + simulated observation).

/** Final hazard-zone outcome counts, for screen-reader text and keyed lists. */
export function finalCounts(result: SimResult) {
  const counts = {
    found: 0,
    falseAlarm: 0,
    "cloud-blocked": 0,
    "never-in-view": 0,
    "not-recognised": 0,
    "before-event": 0,
    seen: 0,
  };
  for (const c of result.cells) {
    if (c.observed) counts.seen += 1;
    if (c.detected && !isTrueDetection(c)) counts.falseAlarm += 1;
    if (isTrueDetection(c)) counts.found += 1;
    else if (c.truth > 0.5) {
      const reason =
        c.missReason ?? (c.observed ? "not-recognised" : "never-in-view");
      counts[reason] += 1;
    }
  }
  return counts;
}
