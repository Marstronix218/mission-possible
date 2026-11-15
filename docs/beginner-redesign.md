# Beginner mission redesign (PR #15 notes)

The default flow has since been expanded to full mission planning; see [mission-planning-radar.md](mission-planning-radar.md). This earlier quick flow remains available under **Quick experiment**.

Based on `develop` at `0a3f90d9acee96b81cb659dffbd864b5d1db2847` (including the merged visual-game work). This branch refines the existing application; it does not replace the simulation or classroom services.

## Play the loop

1. Open `/map` and select **START MISSION**. The main action always starts Los Angeles; the existing 18 registered missions remain available below.
2. Open the incoming letter and **ACCEPT MISSION**. The objective, city and response target come from the selected mission.
3. Attach one of three sensors by pointer drag, click, Enter or Space. Rotate the geometric 3D satellite using the labelled slider. Remove or replace the payload.
4. Select **TO LAUNCH**, then **LAUNCH SATELLITE**. Launch control has a large action, satellite model and three readiness indicators. Engineering details and motion options are expandable. The countdown takes 2.4 seconds, is skippable, and is omitted with reduced motion.
5. Watch the simplified observation map, advance to the next engine event, or skip to the computed result. The clock pauses off screen and when the tab is hidden. Reduced-motion playback advances manually.
6. Results show observed/missed cells, an archived NASA reference, a simulation-backed reason and **FIX & RETRY**. The score and detailed comparison are secondary. Retrying preserves the design. A subsequent attempt can expose one relevant engineering upgrade from its actual diagnosis.

## Engineering and progression

The first decision is the payload. A supplied platform fits support systems for that first payload within the mission budget where possible. It is not a scored recommendation: there are no sensor correctness badges, hints, predicted scores or category-fit numbers on the beginner cards. The original deterministic engine still computes every observation, cloud block, detection, deadline, score and constraint. No artificial failure or forced timer changes the outcome.

The first platform provides an ordinary radio, battery, memory, ground stations and orbit; budget-constrained payloads may need cheaper support systems. All three beginner payloads pass the existing launch constraints for Los Angeles, Houston, Phoenix and San Francisco. A warning still blocks launch when later edits exceed real constraints. Upgrades remain installed when the sensor is replaced or removed.

**Advanced Mode** retains the existing full staged designer, all parts, orbit visualisation, ground stations and engineering gauges. Its draft is shared with Explorer Mode. Classroom routes retain their original shared designer and server/mock submission rules. Advanced retry links retain their targeted fix slots.

## Images and science

No new imagery, external runtime service or rendering dependency was added. The landing, letters, mission cards and results reuse the repository's attributed `/public/nasa/*.jpg` archives and link to their source/date/usage JSON. Los Angeles uses the existing VIIRS true-color/fire-detection reference from 8 January 2025. Mission hazard inputs, including the existing NASA-derived wildfire cells and other observed/model datasets, remain unchanged.

Real reference imagery is separated from the simulated cell map. No photograph is presented as live imagery or as a synthetic camera/radar/thermal product. Thermal descriptions refer to radiation from Earth's surface, not air temperature. Radar is not described as a heat sensor or an earthquake prediction instrument.

## Scope and limits

The workshop is a lightweight CSS 3D geometric prototype with an actual payload attachment interaction, not a WebGL scene or a photorealistic spacecraft model. Dragging was verified with a mouse; click/keyboard alternatives and mobile layout were checked, but physical touchscreen hardware remains unverified. Power/radio/memory/orbit choices use the retained Advanced Mode or the contextual upgrade panel, not five new physical assembly stages. There is no new Commander difficulty, live NASA ingestion, team collaboration service or mission-report export in this change.

No production deployment or hosted database migration is part of this work. Mock data remains explicitly selected in the local configuration.

## Verification

- 239 tests pass, including all 18 registered mission letters, three neutral choices per mission, launchable starter packages, unchanged deterministic sensor outcomes, real budget/power failures and result/retry placement.
- ESLint, TypeScript and the production build pass. Changed source and documentation are formatted with the repository’s Prettier.
- Browser: camera attachment, mouse drag-and-snap to thermal, an engine-backed failed Los Angeles attempt, preserved retry configuration, a contextual radio upgrade, manual reduced-motion event stepping, keyboard assembly, and switching between Explorer and Advanced Mode.
- Successful computed results: San Francisco 72.8, Houston 78.0 and Phoenix 75.3. A Los Angeles camera experiment scored 20.2 with its actual late-data diagnosis; that run used an earlier saved low-bandwidth configuration. No score was hardcoded into gameplay.
- Mobile viewport 390 × 844: workshop/launch have no horizontal overflow; launch action is visible above the model. Desktop viewport 1280 × 900: first mission hero has no horizontal overflow. Physical touchscreen and cross-browser hardware remain unverified.
