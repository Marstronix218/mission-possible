# Run and connect the application

**Deployed mode: live Supabase.** Set `NEXT_PUBLIC_DATA_MODE=supabase` with the configured project URL and keys. Use `NEXT_PUBLIC_DATA_MODE=mock` only for the offline classroom roleplay in `DEMO.md`.

## Local solo play

Use Node.js 22.13+:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open http://localhost:3000/map. The three MVP missions run the actual deterministic engine in the browser. Drafts and attempts persist locally. Local records never enter cloud leaderboards.

## Live classrooms and verified rankings

1. Create a development Supabase project (or use the team's existing project).
2. Apply all three SQL files in `supabase/migrations/` in filename order with Supabase migrations or its SQL editor. This migration includes RLS, service-only mutation functions, transactional submission limits, and a Realtime timestamp table.
3. In Authentication, enable Anonymous Sign-Ins and email Magic Links. Set the site URL and allow `/auth/confirm` as a redirect URL for localhost and the intended deployment. Configure email delivery for the intended class size. Supabase's default email delivery limits are suitable only for testing.
4. Copy `.env.example` to `.env.local`, then set the project URL, anonymous/publishable public key, service-role/secret key, and `NEXT_PUBLIC_DATA_MODE=supabase`. The service-role key is server-only: never add a `NEXT_PUBLIC_` prefix or commit it.
5. Restart/build the app. The browser obtains an anonymous session for students and solo players. Teachers request a magic link and sign in. A project administrator must then approve their `profiles.role` as `teacher` using trusted Supabase administration; a verified email alone does not grant this role. Then click **Load my classes**.
6. Create a classroom, share its six-character code, and join as a student in a separate browser profile. Student sign-in requires no email.
7. Submit two designs, confirm the class ranking updates, inspect history as the teacher, and check that a second unrelated account cannot read the class. These live Auth/email/Realtime checks require the real project and have not been executed in this environment.

The browser uses `/api/service` with a discriminated, Zod-validated action contract. Every request verifies the bearer token with Supabase Auth. Mutations use a server-only service client. Scores are recalculated on the server; the browser cannot supply a score. The database serializes submissions per user and checks membership, deadline, attempt limit, and unchanged constraints. A stable request UUID makes submission retries idempotent.

Class rankings subscribe to `classroom_updates`; only a timestamp is broadcast. RLS permits members and their teacher to read it. A ten-second refresh is retained for recovery. Designs and student email addresses are not broadcast. The global ranking includes solo attempts with standard conditions and groups by mission and engine version. Ties use the earliest achievement.

The database tests run the SQL in PGlite with Supabase Auth stand-ins. They verify SQL behavior and access rules, but cannot certify hosted Auth, email delivery, Realtime publication, or Vercel deployment.

## NASA sources

`public/nasa/*.jpg` contains NASA GIBS / Terra MODIS corrected-reflectance true-color snapshots dated **2024-07-01**. Each image has a matching JSON file with the exact request, bounding box, date, and usage. These images provide observed geographic context beside the modeled observation grid; they are not hazard labels or scoring truth.

Regenerate from the official GIBS WMS service:

```sh
python3 scripts/data/fetch-nasa-images.py
```

Scoring uses Ryohei's explicitly educational-model mission grids. Replacing them with real hazard grids (FIRMS, OPERA, ECOSTRESS) remains a data-owner integration and must preserve provenance and engine versioning.

## Verification

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

The local dev/build commands use Webpack because this host's Turbopack file watcher cannot start an FSEvent stream. MapLibre's worker is copied from the locked dependency to `public/maps/` before each dev/build; the worker is generated, not manually vendored.

## GitHub delivery

Local branch: `feat/wako/world-results`. Integration base: `develop` at `617701ef05be9c0644b902cbe691cf22f37fad3d`.

The simulation dependency is Ryohei's branch commit `00efd67345a036735664136ebc01d8eda90c8ffb`. Its source is copied unchanged, and its origin is recorded here. The dependency is already present in the current integration base. Sakura’s shared designer, stores, UI primitives, and tokens are preserved; the mock briefing/designer entrypoints select Wako’s local demo only when mock mode is active.

The feature branch is pushed. [Draft PR #5](https://github.com/Marstronix218/mission-possible/pull/5) targets `develop`; review remains pending. Protected branches have not been changed.

Nori’s foundation migration `20261114000000_profiles_and_attempts.sql` is preserved unchanged from the current main branch. The classroom migration extends that schema rather than creating a competing attempts table. The repository main branch gained this foundation while implementation was in progress; the delivery branch has now been reconciled with the updated `develop` foundation.

The browser uses `@supabase/ssr` cookie-backed sessions for compatibility with Nori’s auth foundation. `/auth/confirm` supports the foundation’s `token_hash` email template and verifies the OTP before redirecting to the teacher dashboard.

Final browser checks: a valid thermal/sun-synchronous design scored 61.2; switching its orbit to Low LEO scored 33.5. The comparison showed −27.7 points and the orbit change. Removing all instruments disabled launch. NASA imagery and redesign/history rendered successfully.

## Latest upstream information

Fetched all remote branches on 2026-11-14. `origin/develop` is now `617701ef05be9c0644b902cbe691cf22f37fad3d` and its shared components have been reconciled into this feature branch. `origin/main` is `2be9a014d834866c222daecdd8bc1437a2c7d94e`. Ryohei’s latest branch is `c91776ede3b5e596b93551706780d69a42914fb3`; all simulation, game-type, and mission-data files already match that branch.

The latest upstream PRD is now included. `docs/upstream-setup.md` preserves Nori’s foundation setup guide; use this SETUP.md for the current standalone branch’s local commands. Other upstream implementation branches have been fetched for integration, not force-merged over local work.

The classroom API now follows the upstream authorization rule: only a non-anonymous, email-confirmed user with a server-read `profiles.role = teacher` can manage classes. Clients cannot grant that role themselves.

## Verified backend status and database access

Earlier checks verified the configured public and secret API keys without logging their values; database REST and Auth settings endpoints returned 200, but application tables were not yet present. The user subsequently reported enabling anonymous sign-ins. Hosted backend state has not been rechecked during the requested mock-data continuation.

The three API variables do not grant arbitrary SQL execution. To let the migration runner create the schema, set `SUPABASE_DB_URL` (or the supported alias `DATABASE_URL`) in `.env.local` to a PostgreSQL connection string from the Supabase Connect dialog (session-pooler or direct connection). Credentials stay in the local file. Run:

```sh
pnpm db:check
pnpm db:migrate
```

The runner checks that a hosted connection matches the configured Supabase project, enforces certificate verification, uses a transaction/advisory lock, and records applied migration versions/checksums. It never logs a connection string. Alternatively, use the separately supplied `database-setup.sql` in the project SQL Editor for this empty project. No hosted migration has been claimed or applied without SQL/admin access.

The third migration locks scoring settings once a class has attempts, backfills pre-existing Auth users as students, and requires explicit public-nickname choice before solo scores appear globally. API ranking responses omit internal user IDs. Class deadlines display the local timezone; database time remains authoritative.

## Integrated release

The home route redirects to `/map`; the placeholder landing page is retired. Designer launch hands the persisted draft to `/run`; playback completion submits exactly once through the existing attempt service and opens `/result`. Live classroom brief/design routes preserve the classroom query and server constraints. Demo data stays browser-local and labeled; it is not verified cloud persistence.

Use the pinned pnpm version from package.json. Feature PRs target `develop`; the reviewed release PR targets `main` because Vercel production follows `main`. Merging feature PRs into `develop` alone does not update production.

## Live provisioning verified — 2026-11-14

All three migrations were applied to the configured hosted project through the authenticated Supabase CLI. Anonymous sign-in, server-scored solo save, idempotent retry, history, unauthorized-request rejection, teacher class creation, student joining, classroom submission/ranking and the email-token callback were verified against the real backend. Temporary test teacher/class records were removed. The map container is sized outside CSS layers so MapLibre cannot collapse its height.

Production and Preview explicitly select `NEXT_PUBLIC_DATA_MODE=supabase`; changing a public variable requires rebuilding the deployment. Existing local demo records are not imported into verified cloud history or rankings.

The stored direct PostgreSQL password was rejected, but the authenticated CLI can initialize its supported temporary login role. For future migrations, use `supabase link --project-ref <project-ref>` and `supabase db push --linked` from the reviewed branch instead of supplying an invalid `SUPABASE_DB_PASSWORD`. Do not reset the database or replace credentials to fix an application mode flag.
