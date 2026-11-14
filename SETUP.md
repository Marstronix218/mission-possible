# Run and connect the application

## Local solo play

Use Node.js 22.13+:

```sh
npm ci
npm run dev
```

Open http://localhost:3000/map. The three MVP missions run the actual deterministic engine in the browser. Drafts and attempts persist locally. Local records never enter cloud leaderboards.

## Live classrooms and verified rankings

1. Create a development Supabase project (or use the team's existing project).
2. Apply both SQL files in `supabase/migrations/` in filename order with Supabase migrations or its SQL editor. This migration includes RLS, service-only mutation functions, transactional submission limits, and a Realtime timestamp table.
3. In Authentication, enable Anonymous Sign-Ins and email Magic Links. Set the site URL and allow `/teacher` and `/auth/confirm` as a redirect URL for both localhost and the intended deployment. Configure email delivery for the intended class size. Supabase's default email delivery limits are suitable only for testing.
4. Copy `.env.example` to `.env.local`, then set the project URL, anonymous public key, and service-role key. The service-role key is server-only: never add a `NEXT_PUBLIC_` prefix or commit it.
5. Restart/build the app. The browser obtains an anonymous session for students and solo players. Teachers request a magic link, sign in, then click **Load my classes**.
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
npm run lint
npm run typecheck
npm test
npm run build
```

The local dev/build commands use Webpack because this host's Turbopack file watcher cannot start an FSEvent stream. MapLibre's worker is copied from the locked dependency to `public/maps/` before each dev/build; the worker is generated, not manually vendored.

## GitHub delivery

Local branch: `feat/wako/world-results`. Integration base: `develop`, currently at the original PRD commit.

The simulation dependency is Ryohei's branch commit `00efd67345a036735664136ebc01d8eda90c8ffb`. Its source is copied unchanged, and its origin is recorded here. Coordinate the simulation branch merge before merging this application branch. This work also bootstraps Next.js and adds a temporary designer/backend because no other implementation exists on `develop` yet.

This environment currently has no working authenticated GitHub write connection. The installed connector reports an unavailable tool, and no GitHub CLI/token is configured. The local source and ZIP are complete delivery artifacts, but they are not a remote push or pull request. Do not merge directly into `main` or `develop`.

Nori’s foundation migration `20261114000000_profiles_and_attempts.sql` is preserved unchanged from the current main branch. The classroom migration extends that schema rather than creating a competing attempts table. The repository main branch gained this foundation while implementation was in progress; `develop` is still at the original PRD commit.

The browser uses `@supabase/ssr` cookie-backed sessions for compatibility with Nori’s auth foundation. `/auth/confirm` supports the foundation’s `token_hash` email template and verifies the OTP before redirecting to the teacher dashboard.

Final browser checks: a valid thermal/sun-synchronous design scored 61.2; switching its orbit to Low LEO scored 33.5. The comparison showed −27.7 points and the orbit change. Removing all instruments disabled launch. NASA imagery and redesign/history rendered successfully.
