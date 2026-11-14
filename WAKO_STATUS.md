# Wako implementation status

Current scope is the browser-local mock experience. Supabase remains disabled by explicit data-mode selection. The current upstream PRD was fetched and matched the local requirements during this continuation.

## Latest completed work

- **F-SIM-01 / accessibility:** Playback respects the system reduced-motion preference and offers an explicit Reduce motion checkbox. Motion can be started deliberately; skip remains available. Active playback uses elapsed time for an 18-second sequence, excluding pauses.
- **F-CLS-03 / error states:** Classroom screens show the active student's used/remaining attempts. Deadline displays update while a page is open. Expired, archived, exhausted, and teacher-preview states prevent launch. Existing mock submission rules continue to enforce limits independently.
- **F-EVL-03 / F-ITR-02:** Saved history preserves the original result and engine version. It no longer silently resimulates stored attempts. Comparisons require matching mission, classroom, constraints, and engine version and choose an older comparable attempt.
- **F-MAP-04:** Map best scores read the current demo actor's own standard-condition history. Class/custom scores and other students' progress are excluded. Category filtering keeps the selected preview in the selected category.
- **Pending saves:** The UI announces submission progress and preserves the draft. A successful primary save can reach its result even if the optional browser cache fails.

## Validation

- 35 automated tests pass, including stored-score preservation, comparison partitioning, precise deadline boundaries, viewer-specific attempt counts, and student history isolation.
- ESLint, TypeScript, and the production build pass.
- Browser checked at 768 × 1024: teacher creation, student join, briefing/design/playback/results, and launch blocked after the one allowed attempt. The design remained available for inspection.
- The Reduce motion checkbox stopped progress at approximately 16.7%; skip still saved a 61.2 result.
- Teacher and map views had document width 768 at a 768px viewport, with no horizontal page overflow. No browser console errors were captured during the checked flow.
- The system preference is wired through matchMedia; the manual reduced-motion path was exercised in the browser. Physical Chromebook/iPad and separate Chrome/Edge/Safari testing have not been performed.

## Integration boundaries

Only Los Angeles, Houston, and Phoenix have playable mission data. The other 15 cities remain selectable previews until verified datasets are supplied. NASA true-color imagery is observed geographic context; hazard grids remain explicitly educational models.

The mock classroom is browser-local roleplay, not multi-device authentication or an authoritative shared service. Live backend and deployment checks remain outside the requested mock-data continuation. The live adapter will need the agreed authoritative classroom/status/history contracts before production acceptance.

Delivery branch: `feat/wako/world-results`. GitHub access is connected; this snapshot is being published for draft integration review. The upstream shared designer and UI components are preserved, with Wako’s mock screens selected only in mock mode.

## Upstream reconciliation before publication

The updated develop foundation is preserved, including Sakura’s original designer, design store, UI primitives, and styling tokens. The shared briefing/designer pages use the upstream implementation in live mode and the local Wako flow in explicit mock mode. Dependencies are merged with the upstream npm package/lockfile and previously floating versions are pinned to the versions already tested. A skip-to-content link is restored.

After reconciliation, all 35 tests and the production build pass. ESLint passes with one pre-existing warning in the unchanged upstream designer about internal window.location navigation. The combined teacher dashboard renders without console errors.
