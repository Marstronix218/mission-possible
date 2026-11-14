import {
  classSchema,
  designSchema,
  nicknameSchema,
  type Classroom,
  type Ranking,
} from "./contracts";
import { getMission, defaultDesign } from "./missions";
import { runSimulation, summarizeResources, ENGINE_VERSION } from "@/lib/sim";
import type { Constraints, SatelliteDesign, SimResult } from "@/types/game";
export const demoClassId = "d0000000-0000-4000-8000-000000000001";
export const demoTeacherId = "d0000000-0000-4000-8000-000000000002";
export const demoCode = "ORBIT1";
export type DemoAttempt = {
  id: string;
  user_id: string;
  mission_slug: string;
  classroom_id: string | null;
  design: SatelliteDesign;
  constraints: Constraints;
  result: SimResult;
  score_total: number;
  engine_version: string;
  created_at: string;
};
export type DemoState = {
  version: 1;
  classrooms: Classroom[];
  members: { classroom_id: string; user_id: string; nickname: string }[];
  attempts: DemoAttempt[];
  profiles: Record<string, { nickname: string | null }>;
};
export type DemoContext = {
  userId: string;
  role: "teacher" | "student";
  now: string;
  uuid: () => string;
};
export function createDemoState(): DemoState {
  const state: DemoState = {
    version: 1,
    classrooms: [
      {
        id: demoClassId,
        teacher_id: demoTeacherId,
        name: "Code Blue Lab · Demo",
        join_code: demoCode,
        mission_slug: "los-angeles",
        budget_m: 250,
        mass_kg: 500,
        max_attempts: 3,
        deadline: null,
        is_active: true,
      },
    ],
    members: [],
    attempts: [],
    profiles: {},
  };
  const scenarios = [
    ["Demo Nova", "leo_400", "sso_700"],
    ["Demo River", "sso_700", "meo_tilt"],
    ["Demo Orbit Fox", "leo_400", "meo_tilt"],
  ];
  scenarios.forEach(([name, first, last], i) => {
    const id = "d1000000-0000-4000-8000-" + String(i + 1).padStart(12, "0");
    state.profiles[id] = { nickname: name };
    state.members.push({
      classroom_id: demoClassId,
      user_id: id,
      nickname: name,
    });
    [first, last].forEach((orbit, j) => {
      const design = { ...defaultDesign, orbit };
      const mission = getMission("los-angeles")!;
      const result = runSimulation(mission, design, mission.defaultConstraints);
      const at = `2026-11-14T18:0${i * 2 + j}:00.000Z`;
      for (const scope of ["class", "solo"])
        state.attempts.push({
          id: `fixture-${i}-${j}-${scope}`,
          user_id: id,
          mission_slug: mission.slug,
          classroom_id: scope === "class" ? demoClassId : null,
          design,
          constraints: mission.defaultConstraints,
          result,
          score_total: result.score.total,
          engine_version: result.engineVersion,
          created_at: at,
        });
    });
  });
  return state;
}
export function performDemoAction(
  state: DemoState,
  action: string,
  input: Record<string, unknown>,
  ctx: DemoContext,
): unknown {
  state.profiles[ctx.userId] ??= { nickname: null };
  const findClass = (id: unknown) => {
    const c = state.classrooms.find((c) => c.id === id);
    if (!c) throw new Error("Classroom not found.");
    return c;
  };
  const teacher = (id?: unknown) => {
    if (ctx.role !== "teacher")
      throw new Error("Open the demo teacher dashboard to manage classrooms.");
    if (id && findClass(id).teacher_id !== ctx.userId)
      throw new Error("This classroom belongs to another demo teacher.");
  };
  const member = (id: unknown) => {
    const c = findClass(id);
    if (
      c.teacher_id !== ctx.userId &&
      !state.members.some(
        (m) => m.classroom_id === c.id && m.user_id === ctx.userId,
      )
    )
      throw new Error(
        "Join this demo classroom first. The sample code is ORBIT1.",
      );
    return c;
  };
  if (action === "setNickname") {
    const nickname =
      input.nickname === null ? null : nicknameSchema.parse(input.nickname);
    state.profiles[ctx.userId].nickname = nickname;
    return { nickname };
  }
  if (action === "listClasses") {
    teacher();
    return state.classrooms.filter((c) => c.teacher_id === ctx.userId);
  }
  if (action === "createClass") {
    teacher();
    const settings = classSchema.parse(input.settings);
    if (state.classrooms.length >= 50)
      throw new Error("The demo supports up to 50 local classes.");
    let code: string;
    do {
      code = ctx.uuid().replaceAll("-", "").slice(-6).toUpperCase();
    } while (state.classrooms.some((c) => c.join_code === code));
    const c = {
      ...settings,
      id: ctx.uuid(),
      teacher_id: ctx.userId,
      join_code: code,
      is_active: true,
    };
    state.classrooms.push(c);
    return c;
  }
  if (action === "updateClass") {
    teacher(input.id);
    const c = findClass(input.id);
    if (input.operation === "archive") c.is_active = false;
    else if (input.operation === "rotate") {
      let code: string;
      do {
        code = ctx.uuid().replaceAll("-", "").slice(-6).toUpperCase();
      } while (state.classrooms.some((x) => x.join_code === code));
      c.join_code = code;
    } else {
      const settings = classSchema.parse(input.settings);
      if (
        state.attempts.some((a) => a.classroom_id === c.id) &&
        (settings.mission_slug !== c.mission_slug ||
          settings.budget_m !== c.budget_m ||
          settings.mass_kg !== c.mass_kg)
      )
        throw new Error(
          "Scoring settings are locked after the first attempt. Create a new classroom.",
        );
      Object.assign(c, settings);
    }
    return c;
  }
  if (action === "joinClass") {
    const code = String(input.code ?? "")
      .trim()
      .toUpperCase();
    const nickname = nicknameSchema.parse(input.nickname);
    const c = state.classrooms.find((c) => c.join_code === code && c.is_active);
    if (!c || (c.deadline && c.deadline <= ctx.now))
      throw new Error("That class code is invalid, expired, or archived.");
    const existing = state.members.find(
      (m) => m.classroom_id === c.id && m.user_id === ctx.userId,
    );
    if (existing) return c;
    if (
      state.members.some(
        (m) =>
          m.classroom_id === c.id &&
          m.nickname.toLowerCase() === nickname.toLowerCase(),
      )
    )
      throw new Error("That nickname is already used in this class.");
    state.members.push({ classroom_id: c.id, user_id: ctx.userId, nickname });
    return c;
  }
  if (action === "classroom") return member(input.id);
  if (action === "classroomStatus") {
    const c = member(input.id);
    const isMember = state.members.some(
      (m) => m.classroom_id === c.id && m.user_id === ctx.userId,
    );
    return {
      attemptsUsed: state.attempts.filter(
        (a) => a.classroom_id === c.id && a.user_id === ctx.userId,
      ).length,
      canSubmit: isMember,
      isTeacher: c.teacher_id === ctx.userId,
    };
  }

  if (action === "students") {
    teacher(input.id);
    return {
      members: state.members.filter((m) => m.classroom_id === input.id),
      attempts: state.attempts.filter((a) => a.classroom_id === input.id),
    };
  }
  if (action === "removeStudent") {
    teacher(input.id);
    state.members = state.members.filter(
      (m) => !(m.classroom_id === input.id && m.user_id === input.userId),
    );
    return { ok: true };
  }
  if (action === "attempt") {
    const old = state.attempts.find((a) => a.id === input.requestId);
    if (old) {
      if (old.user_id !== ctx.userId)
        throw new Error("Attempt ID belongs to a different player.");
      return old;
    }
    const mission = getMission(String(input.missionSlug));
    if (!mission) throw new Error("This mission is not available.");
    const design = designSchema.parse(input.design);
    let constraints = mission.defaultConstraints;
    if (input.classroomId) {
      const c = member(input.classroomId);
      if (
        !state.members.some(
          (m) => m.classroom_id === c.id && m.user_id === ctx.userId,
        )
      )
        throw new Error(
          "Join as a demo student before submitting a class attempt.",
        );
      if (!c.is_active || (c.deadline && c.deadline <= ctx.now))
        throw new Error("The classroom is closed.");
      if (c.mission_slug !== mission.slug)
        throw new Error("This classroom has a different mission.");
      if (
        c.max_attempts !== null &&
        state.attempts.filter(
          (a) => a.classroom_id === c.id && a.user_id === ctx.userId,
        ).length >= c.max_attempts
      )
        throw new Error(
          "Attempt limit reached. Try a new demo student or a new class.",
        );
      constraints = { budgetM: c.budget_m, massKg: c.mass_kg };
    }
    const resources = summarizeResources(design, constraints);
    if (resources.violations.length)
      throw new Error(resources.violations.join(" "));
    const result = runSimulation(mission, design, constraints);
    const a: DemoAttempt = {
      id: String(input.requestId ?? ctx.uuid()),
      user_id: ctx.userId,
      mission_slug: mission.slug,
      classroom_id: input.classroomId ? String(input.classroomId) : null,
      design,
      constraints,
      result,
      score_total: result.score.total,
      engine_version: result.engineVersion,
      created_at: ctx.now,
    };
    state.attempts.push(a);
    return a;
  }
  if (action === "history")
    return state.attempts
      .filter(
        (a) =>
          a.user_id === ctx.userId &&
          a.mission_slug === input.missionSlug &&
          a.classroom_id === (input.classroomId ?? null) &&
          a.engine_version === ENGINE_VERSION,
      )
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 50);
  if (action === "ranking") {
    if (!getMission(String(input.missionSlug)))
      throw new Error("Mission not found.");
    if (
      input.classroomId &&
      member(input.classroomId).mission_slug !== input.missionSlug
    )
      throw new Error("Mission does not match the classroom.");
    const rows = state.attempts
      .filter(
        (a) =>
          a.mission_slug === input.missionSlug &&
          a.classroom_id === (input.classroomId ?? null) &&
          a.engine_version === ENGINE_VERSION,
      )
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    const grouped = new Map<string, Ranking & { first: number }>();
    for (const a of rows) {
      const membership = state.members.find(
        (m) => m.classroom_id === input.classroomId && m.user_id === a.user_id,
      );
      const nickname = input.classroomId
        ? membership?.nickname
        : state.profiles[a.user_id]?.nickname;
      if (!nickname) continue;
      const existing = grouped.get(a.user_id);
      if (!existing)
        grouped.set(a.user_id, {
          entry_id: 0,
          nickname,
          score: a.score_total,
          attempts: 1,
          improvement: 0,
          achieved: a.created_at,
          first: a.score_total,
        });
      else {
        existing.attempts++;
        if (a.score_total > existing.score) {
          existing.score = a.score_total;
          existing.achieved = a.created_at;
        }
        existing.improvement = existing.score - existing.first;
      }
    }
    return [...grouped.values()]
      .sort((a, b) => b.score - a.score || a.achieved.localeCompare(b.achieved))
      .map((r, i) => ({
        entry_id: i + 1,
        nickname: r.nickname,
        score: r.score,
        attempts: r.attempts,
        improvement: r.improvement,
        achieved: r.achieved,
      }));
  }
  throw new Error("Unsupported demo operation.");
}
