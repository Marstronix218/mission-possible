import { describe, expect, it } from "vitest";

import { allMissions } from "../../missions/registry";
import type { SatelliteDesign } from "../../../types/game";
import { runSimulation } from "..";
import baseline from "./fixtures/engine-1.1.0-baseline.json";
import { snapshotDesigns, summarize } from "./baseline-helpers";

// The fixture was generated from the unmodified 1.1.0 engine before decisions and
// diagnostics were added. Version 1.3 intentionally removes cost efficiency from
// the evaluation total, so observations and underlying metrics stay pinned while
// total, success and feedback may change.
const defaultDecisions: SatelliteDesign["decisions"] = { focus: "wide" };

describe("engine 1.1.0 backward compatibility", () => {
  it("covers every mission and snapshot design", () => {
    expect(baseline).toHaveLength(
      allMissions.length * Object.keys(snapshotDesigns).length,
    );
  });

  it.each(allMissions.map((mission) => [mission.slug, mission] as const))(
    "%s preserves 1.1.0 observations while using the new evaluation total",
    (slug, mission) => {
      for (const [name, design] of Object.entries(snapshotDesigns)) {
        const expected = baseline.find(
          (row) => row.slug === slug && row.design === name,
        );
        expect(expected, `${slug}/${name}`).toBeDefined();
        for (const variant of [
          design,
          { ...design, decisions: defaultDecisions },
          { ...design, decisions: {} },
        ]) {
          const summary = summarize(
            runSimulation(mission, variant, mission.defaultConstraints),
          );
          const {
            score,
            success: _success,
            feedback: _feedback,
            ...actual
          } = summary;
          const {
            score: expectedScore,
            success: _oldSuccess,
            feedback: _oldFeedback,
            ...stable
          } = expected!;
          expect({ slug, design: name, ...actual }, `${slug}/${name}`).toEqual(
            stable,
          );
          const { total: _newTotal, ...metrics } = score;
          const { total: _oldTotal, ...oldMetrics } = expectedScore;
          expect(metrics, `${slug}/${name}`).toEqual(oldMetrics);
        }
      }
    },
  );
});
