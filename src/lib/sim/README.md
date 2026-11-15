# Simulation core

This directory is the pure, deterministic game engine shared by the browser and server.
It has no React, Next.js, Supabase, clock, or unseeded-randomness dependency.

```ts
import { runSimulation, summarizeResources } from "@/lib/sim";

const resources = summarizeResources(design, mission.defaultConstraints);
if (resources.violations.length === 0) {
  const result = runSimulation(mission, design, mission.defaultConstraints);
}
```

## Model boundaries

- `summarizeResources` is the launch gate for budget, mass, power, data, and catalog validity.
- `runSimulation` uses the mission seed, grid, category rules, and selected parts to model coverage,
  clouds, detection, downlink delay, reliability, and the five score components.
- A mission succeeds at a total score of at least 60 with at least 50% coverage.
- `ENGINE_VERSION` must change whenever a scoring or simulation change would affect rankings.
- `result.diagnostics` and per-cell `lookHours`, `blockedHours`, `detectedHour` and `missReason`
  are recorded from the branches the engine actually took. `feedback.ts` and `explain.ts` build
  their text only from these numbers; never add a reason the engine did not compute.
- `design.decisions` (focus, downlink, retask) are in-mission operations choices. Magnitudes live
  in `DECISION_EFFECTS` in `engine.ts`. Omitted decisions reproduce the 1.1.0 engine exactly;
  `__tests__/compat.test.ts` pins this against `__tests__/fixtures/engine-1.1.0-baseline.json`.
- Mission JSON records each source's provenance. Los Angeles and Phoenix include archived NASA-observed hazard inputs; Houston retains an explicitly educational-model flood grid. Other missions likewise use their own source metadata. Observations are historical reference evidence, and satellite behavior and scores are simulated.

Regenerate the three MVP datasets with:

```sh
node scripts/data/generate-mvp-missions.mjs
```
