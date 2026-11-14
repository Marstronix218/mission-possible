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
- Mission JSON identifies whether each source is NASA-observed or an educational model. The MVP
  grids are explicitly educational models inspired by the linked NASA products, not live observations.

Regenerate the three MVP datasets with:

```sh
node scripts/data/generate-mvp-missions.mjs
```
