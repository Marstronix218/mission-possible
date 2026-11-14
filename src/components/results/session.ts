import type { Constraints, SatelliteDesign, SimResult } from "@/types/game";
import { designSchema } from "./contracts";
import { getMission } from "./missions";
import { runSimulation } from "@/lib/sim";
export type SavedAttempt = {
  id: string;
  slug: string;
  design: SatelliteDesign;
  constraints: Constraints;
  result: SimResult;
  at: string;
  classroomId?: string;
  verified: boolean;
};
export const attemptsKey = "mission-possible-attempts-v2";
export const draftKey = (slug: string, classroomId?: string) =>
  "mission-design:" + slug + ":" + (classroomId ?? "solo");
export function loadAttempts(): SavedAttempt[] {
  try {
    const rows: unknown = JSON.parse(localStorage.getItem(attemptsKey) ?? "[]");
    if (!Array.isArray(rows)) return [];
    return rows
      .filter((a): a is SavedAttempt => {
        if (
          !a ||
          typeof a !== "object" ||
          typeof a.id !== "string" ||
          typeof a.at !== "string" ||
          !Number.isFinite(Date.parse(a.at)) ||
          !getMission(a.slug)
        )
          return false;
        return (
          designSchema.safeParse(a.design).success &&
          Number.isFinite(a.constraints?.budgetM) &&
          Number.isFinite(a.constraints?.massKg)
        );
      })
      .slice(-50)
      .map((a) => ({
        ...a,
        result: runSimulation(getMission(a.slug)!, a.design, a.constraints),
      }));
  } catch {
    return [];
  }
}
export function saveAttempt(a: SavedAttempt) {
  localStorage.setItem(
    attemptsKey,
    JSON.stringify(
      [...loadAttempts().filter((x) => x.id !== a.id), a].slice(-50),
    ),
  );
}

// Compatibility bridge for Sakura's persisted Zustand design store.
export const designerDraftKey=(slug:string)=>`mission-possible:design:${slug}`;
