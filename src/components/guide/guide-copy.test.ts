import { describe, expect, it } from "vitest";
import { stageLines, tutorialIntro, tutorialSteps } from "./guide-copy";

describe("guide copy", () => {
  it("has one short, friendly line for every stage", () => {
    for (const [stage, line] of Object.entries(stageLines)) {
      expect(line.length, stage).toBeGreaterThan(20);
      expect(line.length, stage).toBeLessThanOrEqual(160);
      // Short sentences: none longer than ~22 words.
      for (const sentence of line.split(/(?<=[.!?])\s+/))
        expect(sentence.split(/\s+/).length, stage).toBeLessThanOrEqual(22);
    }
  });

  it("walks through five tutorial steps after the welcome", () => {
    expect(tutorialIntro.title).toBe("WELCOME TO MISSION: POSSIBLE!");
    expect(tutorialSteps.map((s) => s.title)).toEqual([
      "Choose Your Mission",
      "Build Your Satellite",
      "Plan Your Mission",
      "Launch and Observe",
      "Learn and Improve",
    ]);
  });
});
