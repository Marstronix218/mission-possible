# Map, physical assembly and mission radar charts

This implementation follows the supplied 11-page gameplay/UI brief and its workshop and pentagon-chart references. It starts from `develop` at `8ebacf0f3ed7091dd3be014a2bc30ac22a5a8d83`, which already includes PR #15. The original PDF and its third-party reference screenshots are not copied into the repository.

## Entry and letters

- The world map is the first major screen, using the existing NASA Blue Marble layer and all 18 registered mission locations. These are the repository's current U.S. scenarios, not newly invented international missions.
- Pins preview on hover/focus and navigate directly to the selected mission letter on activation. The existing cards/list remain a keyboard-accessible fallback if map tiles fail.
- A native modal welcome envelope arrives automatically on first entry. Opening it reveals paper with a welcome message and **EXPLORE THE WORLD**. Dismissal is stored locally; ordinary navigation does not repeat it. **Mission welcome** reopens it. Escape and the close control dismiss it.
- Location letters use the actual mission objective, city and response target. Envelope flap and paper animations respect the system's reduced-motion preference. Opening a letter focuses its heading.

## Full planning is the default

The complete staged designer is now the main solo workshop. **Quick experiment** preserves the earlier one-payload beginner path. Both use the existing design store and launch/simulation pipeline.

The workshop retains every instrument, orbit, solar, battery, radio, memory and ground-station choice. Its geometric CSS 3D assembly supports pointer pickup, a highlighted attachment mount, click/keyboard installation, rotation and physical removal. Solar size changes the wing span; radio selection changes the antenna; multiple instruments occupy visible payload positions. Opening the bus reveals removable battery and memory modules. The floating mount keeps drag-to-attach available when the main model is off screen. Click and keyboard input remain alternatives to dragging.

Resource feedback reports the actual previous and current cost, mass, power, downlink and storage totals. Battery changes also show the catalog's eclipse-continuity benefit. The original constraints still block invalid launches; moving a module does not add a bonus or change a simulation probability.

The orbit stage keeps its existing dedicated visualization. Ground-station count and contact-time/cost choices remain in the radio stage.

## Component comparison

Six catalog categories have five-axis comparisons: sensors, arrays, batteries, radios, memory and orbit presets. Two selected parts overlay as solid cyan and dashed amber polygons. Every axis has an actual value/unit and an explanation of what further out means.

Normalization uses the minimum and maximum across the **entire category**, consistently for both selected parts. Lower demand is inverted for cost, mass, power use and data load; constant traits use the middle of the scale. Derived ratios are calculated from the displayed catalog values. These are relative traits, not mission scores or a recommendation for the selected hazard.

The catalog does not assign geographic coverage to an individual instrument. The sensor chart therefore uses **Low data load**, explicitly labelled in GB/day, rather than presenting a fabricated coverage score. Orbit comparison uses the catalog's swath, revisit, detail and reliability factors. Batteries use modeled shadow continuity, not an invented watt-hour capacity.

## Results

Both full and quick debriefs include a large interactive pentagon chart, with the overall score above it. All five axes are read directly from the saved result: accuracy, coverage, response time, cost efficiency and reliability. No new transmission score or substitute aggregate is invented.

Hover, click, focus or keyboard activation selects a criterion. Its panel shows the value out of 100, weighted contribution to the total, the engine's existing explanation/formula, diagnosed positive/negative causes and a specific next experiment. First-delivery timing and actual modeled downlink capacity are shown separately. Existing observation maps, comparisons, challenges, history and retry behavior are preserved.

## Deliberate model boundaries

The current authoritative contract supplies **one bus**, a mission-specific mass/budget allowance and a fixed replay duration. The workshop exposes these in **Bus, launch & mission lifetime**. Alternative bus sizes, priced rocket models and adjustable lifetime are not selectable: introducing them would require a coordinated catalog/engine/API contract change and new scenario/acceptance tests. No unscored cosmetic selector or fictional engineering calculation is used to imply those capabilities exist.

The assembly is a schematic CSS 3D prototype, not a photorealistic WebGL spacecraft or a mechanical fit simulator. Geometry is illustrative. Ground station locations and orbit timing remain the repository's existing educational abstractions. No database migration, live NASA ingest, new dataset, game-contract change or production deployment is part of this change. Local mock mode remains selected.

## Verification

- 255 tests pass, including 16 new checks for five-axis normalization/units across all six categories, inverse demand axes, actual saved scores, accessible points, weighted explanations, resource deltas, all mission letters and installed/missing modules.
- Browser: welcome auto-arrival, paper opening, dismissal persistence, pin-to-letter navigation, default full workshop, module removal, keyboard replacement, drag-to-snap battery upgrade, comparison selection, launch, simulation result and keyboard selection of the Timing axis.
- Verified computed result: 65.0 overall; Timing 52.2 contributes 15.7/30 points; first useful delivery 7.7 h for an 8 h target. These values came from the engine using the tested design.
- Phone viewport 390 × 844: full workshop and results have document width 390, with no horizontal overflow. The result chart stacks above its explanation, and HTML metric controls provide an alternative to small point targets. Physical touchscreen hardware and separate-browser coverage remain unverified.
