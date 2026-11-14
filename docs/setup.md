# Development and infrastructure setup

This foundation prepares the repository for the team. A successful local build
is separate from provisioning Supabase, linking Vercel, or deploying the app.
The steps below are setup instructions, not evidence that remote resources exist.

## Local development

Install Node.js 22, pnpm, the Supabase CLI, and Docker Desktop. Use the pnpm
version recorded in `package.json`.

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
supabase start
supabase db reset
supabase test db
```

This project uses local ports 55320–55324 to avoid colliding with other stacks.
Copy the local API URL and anonymous key from `supabase status` into
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`.
Set `SUPABASE_SERVICE_ROLE_KEY` only in the local/server environment. Never paste
that key into a client module, PR, issue, or committed file. Then run:

```sh
pnpm dev
```

Before proposing a change:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

After applying schema changes locally, regenerate the database contract:

```sh
supabase gen types typescript --local > src/types/database.ts
```

## Supabase development and production

Create separate Supabase projects for development/Preview and production; select
the intended organization and region explicitly. Configure each independently:

1. Enable Anonymous Sign-ins for students/solo play and email Magic Link for
   teachers. Students do not need an email address or real name.
2. Set the Auth Site URL to the environment's canonical app URL. Add the exact
   callback URLs used by the application to Auth Redirect URLs; include localhost
   for development. Set the hosted Magic Link email template to the versioned
   `supabase/templates/magic_link.html` template, which sends `token_hash` to
   `/auth/confirm?type=email`. Email sign-in does not grant the teacher role;
   teacher authorization requires a separate trusted provisioning process. Scope any Vercel Preview wildcard to this project's/team's
   Preview domain rather than allowing arbitrary origins.
3. Review the migration and apply it to development first. Remote migration
   commands affect the linked database, so verify the project reference before
   `supabase db push`.
4. Run SQL/RLS checks against development before promoting the same migration to
   production during an agreed release.
5. Keep anonymous requests behind Supabase's supported abuse protection and
   production CAPTCHA configuration before opening the app to public traffic.

Local migrations and tests are under `supabase/`. Auth provider enablement,
redirect allowlists, and hosted project settings require remote configuration;
a migration alone does not establish them.

## Vercel

Import `Marstronix218/mission-possible` as a Next.js project. Set `main` as the
Production Branch. Feature PRs and `develop` use Preview deployments.

Configure environment variables separately by environment:

| Variable                        | Development / Preview       | Production                 |
| ------------------------------- | --------------------------- | -------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Development project's URL   | Production project's URL   |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Development anonymous key   | Production anonymous key   |
| `SUPABASE_SERVICE_ROLE_KEY`     | Development server-only key | Production server-only key |

Use Vercel's secret environment-variable controls for the service-role key.
Redeploy after environment changes. `NEXT_PUBLIC_` values are included in browser
bundles and must never contain a privileged key. Do not configure NASA ingestion
keys on Vercel; data preprocessing is Ryohei's separate local workflow.

After linking the correct project, developers can obtain development variables
with `vercel env pull .env.local`. Do not overwrite an existing local environment
without preserving its intended local Supabase settings.

## GitHub integration

The repository already exists at `Marstronix218/mission-possible`. This foundation
uses a feature branch because the repository initially has only `main`.

- Create `develop` from the reviewed foundation and target ordinary PRs at it.
- Configure branch protection/rulesets for `main` and `develop`: require PRs,
  passing `CI / lint, types, tests, build`, one approval, and code-owner review;
  prohibit force pushes and deletion. Verify GitHub's displayed check name after
  the first workflow run before selecting it as required.
- Require shared game-contract review from all four teammates through the team's
  review process; CODEOWNERS alone does not require every listed owner to approve.
- Use squash merges and enable automatic head-branch deletion.
- Add teammates' verified GitHub handles and repository access before expanding
  `.github/CODEOWNERS`. Current ownership uses the verified repository owner;
  PRD display names are not assumed to be GitHub usernames.
- Release through a reviewed `develop` → `main` PR.

The CI workflow runs lint, typecheck, tests, and a production build without
production credentials. Supabase integration tests require the local database
stack and are run separately with `supabase test db`.

## Remaining provisioning and integration checks

- [ ] Development and production Supabase project references are recorded privately.
- [ ] Hosted anonymous auth, teacher Magic Links, redirects, and abuse protection are configured.
- [x] Local development migration and 19 RLS tests pass on Docker/Supabase.
- [x] Generated database types match the applied local migration.
- [ ] Vercel project is linked with separate Preview/Production variables.
- [ ] A Preview deploy passes auth callback and session refresh smoke checks.
- [ ] GitHub branch rules and teammate ownership are configured and verified.
- [ ] Ryohei's reviewed game contracts and simulation are integrated before attempt scoring is enabled.
- [ ] Classroom authorization, ranking, and limits are implemented before Classroom launch.
- [ ] Production backup and monitoring settings are reviewed before release.
