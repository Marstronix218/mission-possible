# Gameplay, tutorial, launch, and rankings

## Implemented

- Removed the pre-launch prediction question and its saved-result comparison.
- Kept the payload hidden during countdown/ascent. The fairing opens in space,
  the satellite separates, and its panels deploy afterward.
- Open observation on Compare, with visibly selected controls and distinct real
  NASA reference imagery and simulated satellite observations.
- Show a short first-mission tutorial, with skip, replay, keyboard navigation,
  reduced motion, and remembered completion. Pilot check-in waits for the tour.
- Add an optional Nova guide with engineering-state hints and persistent hide
  and mute controls. Existing engineering systems and result charts remain.
- Add My Performance, Class, and Global rankings. A comparison is scoped by
  mission, difficulty, exact budget/mass limits, and simulator version. Global
  filters offer existing public limit combinations; class limits stay teacher-owned.
- Keep automatic, server-scored recording and duplicate-attempt protection.
  A class nickname stays private to its class unless the player explicitly
  chooses a separate public pilot name. Global class entries use that public name.
- Label the personal history window: latest 300 server attempts, or latest 50
  device attempts. Best scores and counts describe that available history.

## Verification — November 15, 2026

- Node 22 / pnpm 10.28.2: frozen installation, lint, type checking, 500 tests
  across 41 files, and production builds passed.
- Supabase local start/reset and all 19 pgTAP database checks passed. A local
  database backup was taken before reset. Database types were regenerated with
  `supabase gen types typescript --local`, with only trailing whitespace normalized.
- SQL tests cover difficulty boundaries, exact-condition isolation, public
  opt-in, class nicknames, ranking beyond the top 100, and restricted RPC access.
- A delayed-response browser harness verified that old global rows, condition
  discovery, and class rows cannot overwrite a newly selected scope.
- Chromium at 375px with reduced motion: tutorial completion, replay, skip,
  pilot-name gate, guide preferences after reload, workshop-to-result play,
  all 15 launch frames, Compare default/toggle, automatic practice ranking,
  personal progress, and Class/Global tabs passed. No horizontal overflow,
  JavaScript runtime errors, or external writes occurred.
- A separate local Supabase run verified server recomputation, idempotency,
  teacher class creation, code joining, private class names, explicit public
  names, exact conditions, and removal of user IDs from public rows.
- A browser run against that real local backend automatically recorded and
  ranked a mission; reloading its result retained exactly one attempt.

Screenshots: [tutorial](screenshots/gameplay-guide/tutorial-mobile.png),
[observation comparison](screenshots/gameplay-guide/compare-mobile.png),
[personal progress](screenshots/gameplay-guide/personal-mobile.png).

## Live database rollout

Applied to the Supabase project matching the configured API URL before deploying
the new application code:

- `20261114000300_all_missions.sql`
- `20261115000000_leaderboard_difficulty.sql`

Authenticated CLI migration history confirms both are applied. Read-only live
calls to `mission_ranking_conditions` and `mission_ranking_scoped` succeeded.
No test students, classes, or scores were written to production. The migration
is additive and preserves the old ranking function for the currently deployed app.

## Reproduce local UI QA

```sh
NEXT_PUBLIC_DATA_MODE=mock pnpm build
NEXT_PUBLIC_DATA_MODE=mock pnpm start --port 3030
```

Use a fresh browser profile, open a mission, finish or skip the tour, choose a
pilot name, build, launch, observe, and finish. Check the three leaderboard tabs.
Mock mode is only for isolated practice QA; deployed Supabase settings were not changed.
