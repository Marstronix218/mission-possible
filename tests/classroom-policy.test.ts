import { describe, it, expect } from "vitest";
import {
  classroomBlocker,
  attemptsRemaining,
} from "../src/components/results/classroom-policy";
import { createDemoState } from "../src/components/results/mock-model";
describe("classroom launch feedback", () => {
  it("expires precisely at the deadline and remains open immediately before it", () => {
    const c = {
      ...createDemoState().classrooms[0],
      deadline: "2026-11-14T21:00:00.000Z",
    };
    const t = Date.parse(c.deadline);
    expect(classroomBlocker(c, 0, t - 1)).toBeNull();
    expect(classroomBlocker(c, 0, t)).toContain("deadline");
  });
  it("blocks exhausted attempts and handles unlimited and archived classes", () => {
    const c = createDemoState().classrooms[0];
    expect(classroomBlocker(c, 2, 0)).toBeNull();
    expect(classroomBlocker(c, 3, 0)).toContain("all available");
    expect(attemptsRemaining(c, 4)).toBe(0);
    expect(classroomBlocker({ ...c, max_attempts: null }, 100, 0)).toBeNull();
    expect(attemptsRemaining({ ...c, max_attempts: null }, 100)).toBeNull();
    expect(classroomBlocker({ ...c, is_active: false }, 0, 0)).toContain(
      "archived",
    );
  });
});
