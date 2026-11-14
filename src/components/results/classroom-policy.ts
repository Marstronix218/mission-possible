import type { Classroom } from "./contracts";
export function classroomBlocker(
  classroom: Classroom | null,
  attempts: number,
  now: number,
): string | null {
  if (!classroom) return "Loading classroom conditions…";
  if (!classroom.is_active) return "This classroom is archived.";
  if (classroom.deadline && Date.parse(classroom.deadline) <= now)
    return "The classroom deadline has passed.";
  if (classroom.max_attempts !== null && attempts >= classroom.max_attempts)
    return "You have used all available attempts for this classroom.";
  return null;
}
export function attemptsRemaining(classroom: Classroom, attempts: number) {
  return classroom.max_attempts === null
    ? null
    : Math.max(0, classroom.max_attempts - attempts);
}
