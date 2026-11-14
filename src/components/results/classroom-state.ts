import { api, isMockMode } from "./cloud";
import type { Classroom, ClassroomProgress } from "./contracts";
export async function loadClassroomState(id: string) {
  const classroom = await api<Classroom>("classroom", { id });
  const progress = isMockMode
    ? await api<ClassroomProgress>("classroomStatus", { id })
    : {
        attemptsUsed: (
          await api<unknown[]>("history", {
            missionSlug: classroom.mission_slug,
            classroomId: id,
          })
        ).length,
        canSubmit: true,
        isTeacher: false,
      };
  return { classroom, progress };
}
