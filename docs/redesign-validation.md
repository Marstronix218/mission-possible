# CODE BLUE redesign validation

## Scope

The game follows disaster → design → launch → observe → discover → improve.
Los Angeles, Houston, and Phoenix are featured; all 18 missions remain playable.
The homepage receives mission metadata separately from simulation grids and loads
MapLibre when the map approaches the viewport.

Engine 1.2.0 adds focus, downlink, and retask decisions. Compatibility fixtures
pin scores, cells, and timelines to 1.1.0 when decisions are omitted. Debrief
explanations use computed diagnostics, and saved attempts preserve them.

## Local verification

Use Node.js 22 and pnpm 10.28.2:

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
NEXT_PUBLIC_DATA_MODE=mock pnpm build
NEXT_PUBLIC_DATA_MODE=mock pnpm start --port 3030
```

The browser QA server explicitly uses mock mode. A POST to `/api/service`
returns `MOCK_MODE`; browser attempts stay in local storage. The deployment's
Supabase configuration is unchanged by these commands.

Browser coverage includes the 18 briefing routes, featured mission failures,
targeted retries, successful runs, previous-attempt comparisons, checkpoint
choices, keyboard part selection, 375px layout, reduced motion, and lazy map
loading. Test designs come from the catalog and are evaluated by the real
simulation engine; no scores or observations are fabricated.

Verified on 2026-11-14: frozen dependency installation, lint, type checking,
231 tests across 22 files, and the production build passed. Chromium browser
checks passed all the journeys above without JavaScript runtime errors or
external writes. The map had zero canvases before approaching its section and
one after scrolling into view. All tested mobile screens fit 375px without
horizontal scrolling.

Screenshots: [home](screenshots/redesign/home-desktop.png),
[map](screenshots/redesign/map-mobile.png), and mobile debriefs for
[Los Angeles](screenshots/redesign/los-angeles-result-mobile.png),
[Houston](screenshots/redesign/houston-result-mobile.png), and
[Phoenix](screenshots/redesign/phoenix-result-mobile.png).

## Data and release boundaries

Hazard observations and educational models are identified per mission. Los
Angeles and Phoenix use NASA observations; Houston uses an educational hazard
model. Playback, scores, satellite behavior, and response-team outcomes are
simulated. NASA Blue Marble supplies the map's background imagery.

This branch does not change the database schema or apply live migrations.
Before release, verify whether `20261114000300_all_missions.sql` has been applied
to the target Supabase project. Its pending status was recorded in the handoff,
and this redesign QA does not certify production migration state.

Review engine and game-contract changes with Ryohei, builder changes with Sakura,
and map/playback/results changes with Wako. This work targets `develop`; release
to `main` remains a separate PR.
