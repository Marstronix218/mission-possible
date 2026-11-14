# Browser-local classroom demo

Mock mode is the default. Existing Supabase credentials are preserved but are not used. No database migration, anonymous sign-in, email sign-in, or Supabase connection is required.

Start with `pnpm install --frozen-lockfile` and `pnpm dev`, or use `run-local.command` in this workspace. The app shows a persistent **MOCK DATA MODE** banner.

1. Open **Join class**, use code **ORBIT1**, and choose a new nickname. The three `Demo …` classmates are fictional, and their displayed scores are calculated by the real simulation engine.
2. Open the class mission, design a satellite, launch, then view the computed result and class ranking. The sample classroom allows three attempts per demo student.
3. Open **Teacher** to roleplay the sample teacher. No email is requested. Inspect the sample class's students and designs, export CSV, regenerate its code, remove a demo member, or archive the class. Mission/budget/mass are locked once attempts exist.
4. Create a new classroom to try custom mission conditions or deadlines. Join it as a student using its generated code.
5. Open **Rankings** to view fictional sample players. Publish an explicitly chosen nickname to include your own standard-condition solo scores. Class scores remain separate.
6. **Use another demo student** starts a new local student identity. **Reset demo** restores only the mock classroom dataset, with confirmation. It does not contact Supabase.

Mock classrooms, fictional profiles, and attempts persist in this browser's local storage. Each tab has its own role/student identity in session storage. Same-origin tabs share the mock dataset and receive browser-local update events. This is not a multi-device backend or a security/authentication demonstration. Browser data can be edited or cleared by the user.

`NEXT_PUBLIC_DATA_MODE=mock` is set in the local environment. Live services require explicitly changing that value to `supabase` and restarting/rebuilding. The server application API rejects live requests while mock mode is active.

Implementation boundaries:
- `mock-model.ts`: classroom behavior and actual simulation results, with injected time/IDs for tests.
- `mock-storage.ts`: local persistence, per-tab roleplay, browser update events, and Web Locks when supported.
- `cloud.ts`: selects the mock adapter before any live auth or request is attempted.

NASA image files remain archived observations for geographic context. Hazard grids remain the engine's explicitly educational models.

## Verified browser journey

A demo student joined ORBIT1, completed the Los Angeles class mission, scored 61.2, and appeared in the classroom ranking. The demo teacher saw the student’s saved design/history and created another class with a generated code. Local HTTP checks confirmed that the live API is disabled and auth callbacks redirect locally in mock mode. No Supabase provisioning was performed.

## Wako playback and classroom polish

- During playback, choose **Reduce motion** to hold the animation still, or use the system reduced-motion preference. **Play animation** opts into motion; **Skip to results** works from the still view.
- Classroom brief/design/playback screens show attempts used and remaining. Once exhausted, the designer explains the limit and disables launch while preserving the satellite design.
- Deadline status updates as time passes, without requiring a class mutation or reload.
- Result comparisons use older attempts with matching mission, class, engine version, and constraints. Historical scores remain stored snapshots.
- The map shows only the active demo actor's own solo best scores. Class scores remain in their class ranking.

See `WAKO_STATUS.md` for validation evidence and the remaining integration boundaries.
