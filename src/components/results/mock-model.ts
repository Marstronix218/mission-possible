import {
  classSchema,
  designSchema,
  nicknameSchema,
  type Classroom,
} from "./contracts";
import { getMission, defaultDesign } from "./missions";
import { runSimulation, summarizeResources, ENGINE_VERSION } from "@/lib/sim";
import type { Constraints, SatelliteDesign, SimResult } from "@/types/game";
import {
  defaultRankingDifficulty,
  sameConditions,
  difficultyOf,
  isDifficulty,
  type Difficulty,
} from "@/lib/leaderboard/difficulty";
import {
  leaderboardSubmission,
  publicRanking,
  type RankingSource,
} from "@/lib/api/leaderboard";
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
  const demoClass = state.classrooms[0];
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
      const at = `2026-11-14T18:0${i * 2 + j}:00.000Z`;
      for (const scope of ["class", "solo"]) {
        // Class attempts run under the class limits, as the live API enforces.
        const constraints =
          scope === "class"
            ? { budgetM: demoClass.budget_m, massKg: demoClass.mass_kg }
            : mission.defaultConstraints;
        const result = runSimulation(mission, design, constraints);
        state.attempts.push({
          id: `fixture-${i}-${j}-${scope}`,
          user_id: id,
          mission_slug: mission.slug,
          classroom_id: scope === "class" ? demoClassId : null,
          design,
          constraints,
          result,
          score_total: result.score.total,
          engine_version: result.engineVersion,
          created_at: at,
        });
      }
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
  if (action === "rankingConditions") {
    const mission = getMission(String(input.missionSlug));
    if (!mission) throw new Error("Mission not found.");
    if (!isDifficulty(input.difficulty)) throw new Error("Unknown difficulty.");
    const scopes = new Map<string, Constraints>();
    for (const a of state.attempts) {
      const c = a.constraints ?? mission.defaultConstraints;
      if (
        a.mission_slug === mission.slug &&
        a.engine_version === ENGINE_VERSION &&
        state.profiles[a.user_id]?.nickname &&
        difficultyOf(c, mission.defaultConstraints) === input.difficulty
      )
        scopes.set(`${c.budgetM}|${c.massKg}`, c);
    }
    return [...scopes.values()].sort(
      (a, b) => a.budgetM - b.budgetM || a.massKg - b.massKg,
    );
  }
  if (action === "ranking") {
    const mission = getMission(String(input.missionSlug));
    if (!mission) throw new Error("Mission not found.");
    const c = input.classroomId ? member(input.classroomId) : null;
    if (c && c.mission_slug !== input.missionSlug)
      throw new Error("Mission does not match the classroom.");
    if (input.difficulty !== undefined && !isDifficulty(input.difficulty))
      throw new Error("Unknown difficulty.");
    return publicRanking(
      demoRanking(
        state,
        mission.slug,
        c?.id ?? null,
        (input.difficulty as Difficulty | undefined) ??
          defaultRankingDifficulty(mission.defaultConstraints, c),
        ctx.userId,
        c
          ? { budgetM: Number(c.budget_m), massKg: Number(c.mass_kg) }
          : ((input.constraints as Constraints | undefined) ??
              mission.defaultConstraints),
      ),
      ctx.userId,
    );
  }
  if (action === "overallRanking")
    return publicRanking(demoOverallRanking(state), ctx.userId);
  if (action === "myAttempts")
    return state.attempts
      .filter((a) => a.user_id === ctx.userId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 300)
      .map((a) => ({
        id: a.id,
        mission_slug: a.mission_slug,
        classroom_id: a.classroom_id,
        score_total: a.score_total,
        score_breakdown: a.result.score,
        constraints: a.constraints,
        engine_version: a.engine_version,
        created_at: a.created_at,
      }));
  if (action === "myClasses") {
    const pick = (c: Classroom) => ({
      id: c.id,
      name: c.name,
      mission_slug: c.mission_slug,
      budget_m: c.budget_m,
      mass_kg: c.mass_kg,
      max_attempts: c.max_attempts,
      deadline: c.deadline,
      is_active: c.is_active,
    });
    return [
      ...state.classrooms
        .filter((c) => c.teacher_id === ctx.userId)
        .map((c) => ({
          ...pick(c),
          join_code: c.join_code,
          role: "teacher",
          nickname: null,
        })),
      ...state.members
        .filter((m) => m.user_id === ctx.userId)
        .flatMap((m) => {
          const c = state.classrooms.find((c) => c.id === m.classroom_id);
          return c
            ? [{ ...pick(c), role: "student", nickname: m.nickname }]
            : [];
        }),
    ];
  }
  if (action === "submitScore") {
    const attempt = state.attempts.find(
      (a) => a.id === input.attemptId && a.user_id === ctx.userId,
    );
    if (!attempt)
      throw new Error("This mission result is not saved in the demo yet.");
    const mission = getMission(attempt.mission_slug);
    if (!mission) throw new Error("Mission not found.");
    if (attempt.classroom_id) member(attempt.classroom_id);
    if (!attempt.classroom_id || input.nickname !== undefined) {
      if (input.nickname === undefined || input.nickname === null)
        throw new Error("Choose a pilot name first.");
      // Idempotent: repeating the same name on refresh changes nothing.
      state.profiles[ctx.userId].nickname = nicknameSchema.parse(
        input.nickname,
      );
    }
    const difficulty = difficultyOf(
      attempt.constraints,
      mission.defaultConstraints,
    );
    return leaderboardSubmission(
      demoRanking(
        state,
        attempt.mission_slug,
        attempt.classroom_id,
        difficulty,
        ctx.userId,
        attempt.constraints ?? mission.defaultConstraints,
      ),
      ctx.userId,
      attempt,
      ENGINE_VERSION,
      {
        missionSlug: attempt.mission_slug,
        difficulty,
        engineVersion: ENGINE_VERSION,
        constraints: attempt.constraints ?? mission.defaultConstraints,
      },
    );
  }
  throw new Error("Unsupported demo operation.");
}

/**
 * Best score per player in one (mission, difficulty, engine) scope, mirroring
 * public.mission_ranking_scoped (ties: earliest). Global boards hold every
 * attempt of players with a public pilot name; class boards only that class.
 * Returns the top 100 plus the caller's own row with its true rank.
 */
function demoRanking(
  state: DemoState,
  slug: string,
  classroomId: string | null,
  difficulty: Difficulty,
  userId: string,
  constraints: Constraints,
): RankingSource[] {
  const defaults = getMission(slug)!.defaultConstraints;
  const rows = state.attempts
    .filter(
      (a) =>
        a.mission_slug === slug &&
        (classroomId === null || a.classroom_id === classroomId) &&
        a.engine_version === ENGINE_VERSION &&
        difficultyOf(a.constraints, defaults) === difficulty &&
        sameConditions(a.constraints ?? defaults, constraints),
    )
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const grouped = new Map<string, RankingSource & { first: number }>();
  for (const a of rows) {
    const nickname = classroomId
      ? state.members.find(
          (m) => m.classroom_id === classroomId && m.user_id === a.user_id,
        )?.nickname
      : state.profiles[a.user_id]?.nickname;
    if (!nickname) continue;
    const existing = grouped.get(a.user_id);
    if (!existing)
      grouped.set(a.user_id, {
        user_id: a.user_id,
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
  const ranked = [...grouped.values()].sort(
    (a, b) =>
      b.score - a.score ||
      a.achieved.localeCompare(b.achieved) ||
      a.user_id.localeCompare(b.user_id),
  );
  return ranked
    .map((r, i) => ({
      user_id: r.user_id,
      nickname: r.nickname,
      score: r.score,
      attempts: r.attempts,
      improvement: r.improvement,
      achieved: r.achieved,
      rank: i + 1,
      players: ranked.length,
    }))
    .filter((r) => r.rank <= 100 || r.user_id === userId);
}

/** Sum of each player's best score in every global mission. */
function demoOverallRanking(state: DemoState): RankingSource[] {
  const eligible = state.attempts.filter(
    (a) => a.classroom_id === null && a.engine_version === ENGINE_VERSION,
  );
  const users = new Map<
    string,
    RankingSource & { first: number; best: Map<string, number> }
  >();
  for (const a of eligible.sort((x, y) =>
    x.created_at.localeCompare(y.created_at),
  )) {
    const nickname = state.profiles[a.user_id]?.nickname;
    if (!nickname) continue;
    const current = users.get(a.user_id) ?? {
      user_id: a.user_id,
      nickname,
      score: 0,
      attempts: 0,
      improvement: 0,
      achieved: a.created_at,
      first: a.score_total,
      best: new Map<string, number>(),
    };
    current.attempts += 1;
    const previous = current.best.get(a.mission_slug) ?? 0;
    if (a.score_total > previous)
      current.best.set(a.mission_slug, a.score_total);
    current.score = [...current.best.values()].reduce(
      (sum, score) => sum + score,
      0,
    );
    current.achieved = a.created_at;
    users.set(a.user_id, current);
  }
  return [...users.values()]
    .map((row) => ({ ...row, improvement: row.score - row.first }))
    .sort((a, b) => b.score - a.score || a.achieved.localeCompare(b.achieved))
    .slice(0, 100);
}
