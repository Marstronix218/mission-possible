# Visual workshop onboarding

Based on main `b5920242d0353568ea592c440874247d2c4d4084` (including the latest
team updates), the full solo workshop alternates a dedicated visual explanation
with one subsystem's selection screen:

1. Sensors
2. Orbit
3. Solar generation
4. Battery
5. Observation storage
6. Radio
7. Ground stations
8. Final review

Each explanation has one task, a mission-specific concept diagram, three concepts,
Back and Continue. The diagrams are labeled schematics, not NASA observations or
calculated flight paths. They adapt wildfire/heat examples to the selected mission
and respect reduced-motion preferences. Choosing components keeps the existing
click, keyboard and drag installation mechanisms. Continue confirms a selection;
it deliberately does not auto-advance on the first sensor because players may
install multiple instruments or compare options before continuing.

The same persisted design survives Back, section changes and reload. A complete
saved design opens at review; debrief repair links open the actual flagged
subsystem. All categories remain reachable during the first attempt. Review
blocks launch for the actual engine resource violations. No optimal configuration
is preselected by this change.

A compact sticky budget/mass/power/data/storage display uses the existing resource
summary, with utilization bars and explicit over-limit labels. Detailed resource
consequences, installed-versus-alternative comparisons, technical card values and
radars remain available on demand. The existing guide, full component catalog,
assembly model, resource formulas, mission budgets, scoring, launch route, saved
attempts and ranking implementation are retained from latest main.

This change is scoped to the full solo workshop. The optional quick experiment and
classroom's existing shared design form retain their established behavior. It
adds no database schema, network API, library, physics model or score rule.

## Verification

- Local full suite: 505 tests passed, including new navigation/completion,
  instruction rendering for Los Angeles and San Francisco, and unchanged
  deterministic engine output after reading the workshop flow.
- Type checking and production build passed. ESLint has no errors; six existing
  unused-variable warnings in engine compatibility tests remain outside this scope.
- Browser: Los Angeles all subsystem instructions/selections → launch → observation
  → saved result/ranking; refreshing retained one attempt. San Francisco selection
  → launch/skip → saved result → retry retained the spacecraft. These were mock
  mode checks with actual engine calculations, not hosted database verification.
- 390 × 844 layout: instruction and selection pages have no horizontal overflow;
  instruction navigation remains visible. Default desktop viewport also checked.
- Both visual diagrams and model calculations remain distinct from NASA imagery.
