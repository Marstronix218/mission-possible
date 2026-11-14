# Mission: Possible — Code Blue

Educational satellite mission design game. This initial Nori-owned slice provides
Next.js tooling, CI, Supabase SSR authentication helpers, and secure solo-attempt
storage. The mission UI and simulation engine are separate teammates' work.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

The landing page builds without secrets. To exercise authentication and database
storage, follow [the setup guide](docs/setup.md). It includes local ports,
environment variables, hosted provisioning, and integration work still pending.

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
supabase test db
```

The API schemas and typed fetch wrapper are available under `src/lib/api/`.
`ensurePlayerSession()` starts anonymous play; `requestTeacherSignIn()` requests
an email sign-in. Server clients are under `src/lib/supabase/`; `src/proxy.ts`
refreshes sessions using the Next.js 16 Proxy convention.

No attempt-submission route is enabled until Ryohei's reviewed mission catalog,
resource validation, and deterministic simulation engine are available. Clients
must never submit trusted scores or select server-side constraints. Classroom
and leaderboard APIs are later slices.
