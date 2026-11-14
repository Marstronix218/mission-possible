import {
  parseSavedAttempts,
  savedAttemptSchema,
  type SavedAttempt,
} from "./history-model";
export type { SavedAttempt } from "./history-model";
export const attemptsKey = "mission-possible-attempts-v2";
export const draftKey = (slug: string, classroomId?: string) =>
  "mission-design:" + slug + ":" + (classroomId ?? "solo");
export function loadAttempts(): SavedAttempt[] {
  try {
    return parseSavedAttempts(localStorage.getItem(attemptsKey));
  } catch {
    return [];
  }
}
export function saveAttempt(attempt: SavedAttempt) {
  const snapshot = savedAttemptSchema.parse(attempt);
  localStorage.setItem(
    attemptsKey,
    JSON.stringify(
      [...loadAttempts().filter((a) => a.id !== snapshot.id), snapshot].slice(
        -50,
      ),
    ),
  );
}
export const designerDraftKey = (slug: string) =>
  `mission-possible:design:${slug}`;
