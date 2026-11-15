import { describe, expect, it } from "vitest";

import { allMissions } from "../../missions/registry";
import type { SatelliteDesign } from "../../../types/game";
import { runSimulation } from "..";
import baseline from "./fixtures/engine-1.1.0-baseline.json";
import { snapshotDesigns, summarize } from "./baseline-helpers";

// The fixture was generated from the unmodified 1.1.0 engine before decisions and
// diagnostics were added. Designs without decisions (or with explicit defaults)
// must reproduce it exactly. Feedback became diagnostics-driven in 1.2.0, so only
// its leading mission-threshold item is pinned.
const defaultDecisions: SatelliteDesign["decisions"] = { focus: "wide" };

describe("engine 1.1.0 backward compatibility", () => {
  it("covers every mission and snapshot design", () => {
    expect(baseline).toHaveLength(allMissions.length * Object.keys(snapshotDesigns).length);
  });

  it.each(allMissions.map((mission) => [mission.slug, mission] as const))(
    "%s reproduces 1.1.0 scores, cells, timeline and delivery",
    (slug, mission) => {
      for (const [name, design] of Object.entries(snapshotDesigns)) {
        const expected = baseline.find((row) => row.slug === slug && row.design === name);
        expect(expected, `${slug}/${name}`).toBeDefined();
        for (const variant of [design, { ...design, decisions: defaultDecisions }, { ...design, decisions: {} }]) {
          const { feedback, ...actual } = summarize(runSimulation(mission, variant, mission.defaultConstraints));
          expect({ slug, design: name, feedback: expected!.feedback, ...actual }, `${slug}/${name}`).toEqual(expected);
          expect(feedback[0], `${slug}/${name}`).toEqual(expected!.feedback[0]);
        }
      }
    },
  );
});
