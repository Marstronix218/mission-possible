# Mission: Possible — Code Blue

An educational satellite-design game using Next.js App Router, TypeScript, MapLibre, and Ryohei's deterministic simulation engine. Browser-local mock classroom data is enabled by default; Supabase is optional and inactive.

Start with [DEMO.md](DEMO.md). Join the sample classroom with **ORBIT1**, or open Teacher to try the complete roleplay flow without email or database setup.

- **Map:** 18 selectable city previews, category filters, local best scores and completion status, bundled Natural Earth country outlines, keyboard-accessible markers and city list.
- **MVP game:** Los Angeles, Houston, Phoenix. Briefing → configurable satellite → resource validation → simulation playback → real computed score, feedback, redesign, saved history, comparisons.
- **NASA comparison:** archived Terra MODIS true-color observations beside modeled observation cells, with dates and exact source metadata. The observed imagery does not supply scoring hazard labels.
- **Classrooms:** email magic-link teacher sign-in, anonymous student joining, custom constraints, deadlines and attempt limits, ranking updates, student design/history inspection, CSV export, member removal, code rotation, and archiving. Works with clearly labeled mock data by default. Live mode requires configured Supabase.
- **Rankings:** server-recalculated submissions, separated by mission/engine version and classroom vs standard solo conditions.

Run `npm ci` and `npm run dev`, then visit http://localhost:3000/map. See [SETUP.md](SETUP.md) for cloud setup, sources, verification limits, and GitHub delivery status.

## Source attribution and integration

Simulation code, shared game types, catalog, and three educational mission datasets are from Ryohei's `feat/ryohei/simulation-core` commit `00efd67345a036735664136ebc01d8eda90c8ffb`. They are dependency code, not newly authored engine work. Other 15 cities remain previews until their mission datasets are supplied.

Natural Earth outlines are public-domain geographic data from https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_admin_0_countries.geojson. The local worker comes from MapLibre GL JS (BSD-3-Clause) during dev/build.

No Supabase project credentials, live classroom accounts, or hosting configuration are included. The database migration is exercised locally using PGlite; hosted Auth/email/Realtime and deployment still require integration checks against the actual project.

`npm audit` currently reports eight moderate findings in the development-only ESLint dependency chain. No forced incompatible dependency downgrade was applied.

Nori’s foundation migration `20261114000000_profiles_and_attempts.sql` is preserved unchanged from the current main branch. The classroom migration extends that schema rather than creating a competing attempts table. The repository main branch gained this foundation while implementation was in progress; `develop` is still at the original PRD commit.
