import { isMockMode } from "@/lib/data-mode";
import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { identity, HttpError, check } from "@/lib/backend";
import { canManageClassrooms } from "@/lib/authorization";
import {
  classSchema,
  designSchema,
  nicknameSchema,
} from "@/components/results/contracts";
import { getMission } from "@/components/results/missions";
import { missionSlugs } from "@/lib/missions/registry";
import {
  defaultRankingDifficulty,
  difficulties,
  difficultyOf,
} from "@/lib/leaderboard/difficulty";
import { runSimulation, summarizeResources, ENGINE_VERSION } from "@/lib/sim";
import {
  leaderboardSubmission,
  publicRanking,
  type RankingSource,
} from "@/lib/api/leaderboard";
export const runtime = "nodejs";
const uuid = z.string().uuid();
const rankingConditions = z.object({
  budgetM: z.number().positive().max(10000),
  massKg: z.number().positive().max(100000),
});
const inputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("setNickname"),
    nickname: nicknameSchema.nullable(),
  }),
  z.object({ action: z.literal("createClass"), settings: classSchema }),
  z.object({ action: z.literal("listClasses") }),
  z.object({
    action: z.literal("updateClass"),
    id: uuid,
    settings: classSchema.optional(),
    operation: z.enum(["settings", "rotate", "archive"]).default("settings"),
  }),
  z.object({
    action: z.literal("joinClass"),
    code: z.string().regex(/^[A-Z0-9]{6}$/),
    nickname: nicknameSchema,
  }),
  z.object({ action: z.literal("classroom"), id: uuid }),
  z.object({ action: z.literal("students"), id: uuid }),
  z.object({ action: z.literal("removeStudent"), id: uuid, userId: uuid }),
  z.object({
    action: z.literal("attempt"),
    missionSlug: z.string(),
    design: designSchema,
    classroomId: uuid.optional(),
    requestId: uuid,
  }),
  z.object({
    action: z.literal("history"),
    missionSlug: z.string(),
    classroomId: uuid.optional(),
  }),
  z.object({
    // Publishes an already server-scored attempt; the client never sends a score.
    action: z.literal("submitScore"),
    attemptId: uuid,
    nickname: nicknameSchema.optional(),
  }),
  z.object({
    action: z.literal("ranking"),
    missionSlug: z.enum(missionSlugs),
    classroomId: uuid.optional(),
    difficulty: z.enum(difficulties).optional(),
    constraints: rankingConditions.optional(),
  }),
  z.object({
    action: z.literal("rankingConditions"),
    missionSlug: z.enum(missionSlugs),
    difficulty: z.enum(difficulties),
  }),
  z.object({ action: z.literal("myAttempts") }),
  z.object({ action: z.literal("myClasses") }),
]);

export async function POST(request: Request) {
  if (isMockMode)
    return NextResponse.json(
      {
        error: {
          code: "MOCK_MODE",
          message:
            "Live backend requests are disabled. Demo actions run locally in the browser.",
        },
      },
      { status: 503 },
    );
  try {
    if (Number(request.headers.get("content-length") ?? 0) > 20000)
      throw new HttpError(413, "Request too large.");
    const raw = await request.text();
    if (raw.length > 20000) throw new HttpError(413, "Request too large.");
    const input = inputSchema.parse(JSON.parse(raw));
    const { db, user } = await identity(request);
    const teacher = async () => {
      const { data, error } = await db
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (error || !canManageClassrooms(user, data?.role))
        throw new HttpError(
          403,
          "Sign in with your teacher email and ask the project administrator to approve your teacher role.",
        );
    };
    const owned = async (id: string) => {
      await teacher();
      const { data, error } = await db
        .from("classrooms")
        .select("*")
        .eq("id", id)
        .eq("teacher_id", user.id)
        .single();
      if (error || !data)
        throw new HttpError(403, "Only the class teacher can do this.");
      return data;
    };
    const member = async (id: string) => {
      const { data: c, error } = await db
        .from("classrooms")
        .select("*")
        .eq("id", id)
        .single();
      if (error || !c) throw new HttpError(404, "Class not found.");
      if (c.teacher_id !== user.id) {
        const { data: m } = await db
          .from("classroom_members")
          .select("user_id")
          .eq("classroom_id", id)
          .eq("user_id", user.id)
          .maybeSingle();
        if (!m) throw new HttpError(403, "Join this class first.");
      }
      return c;
    };
    if (input.action === "setNickname") {
      const { data, error } = await db
        .from("profiles")
        .update({ nickname: input.nickname })
        .eq("id", user.id)
        .select("nickname")
        .single();
      check(error);
      return NextResponse.json(data);
    }
    if (input.action === "createClass") {
      await teacher();
      const { data, error } = await db
        .from("classrooms")
        .insert({
          ...input.settings,
          teacher_id: user.id,
          join_code: randomBytes(4).toString("hex").slice(0, 6).toUpperCase(),
        })
        .select()
        .single();
      check(error);
      return NextResponse.json(data);
    }
    if (input.action === "listClasses") {
      await teacher();
      const { data, error } = await db
        .from("classrooms")
        .select("*")
        .eq("teacher_id", user.id)
        .order("created_at", { ascending: false });
      check(error);
      return NextResponse.json(data);
    }
    if (input.action === "updateClass") {
      await owned(input.id);
      const patch =
        input.operation === "archive"
          ? { is_active: false }
          : input.operation === "rotate"
            ? {
                join_code: randomBytes(4)
                  .toString("hex")
                  .slice(0, 6)
                  .toUpperCase(),
              }
            : classSchema.parse(input.settings);
      const { data, error } = await db
        .from("classrooms")
        .update(patch)
        .eq("id", input.id)
        .select()
        .single();
      check(error);
      return NextResponse.json(data);
    }
    if (input.action === "joinClass") {
      const { data, error } = await db.rpc("join_mission_classroom", {
        p_user: user.id,
        p_code: input.code,
        p_nickname: input.nickname,
      });
      check(error);
      if (!data || !data.id)
        throw new HttpError(
          400,
          "Could not join. Check the code, nickname, deadline, or try again in one minute.",
        );
      return NextResponse.json(data);
    }
    if (input.action === "classroom") {
      return NextResponse.json(await member(input.id));
    }
    if (input.action === "removeStudent") {
      await owned(input.id);
      const { error } = await db
        .from("classroom_members")
        .delete()
        .eq("classroom_id", input.id)
        .eq("user_id", input.userId);
      check(error);
      return NextResponse.json({ ok: true });
    }
    if (input.action === "students") {
      await owned(input.id);
      const { data: members, error } = await db
        .from("classroom_members")
        .select("*")
        .eq("classroom_id", input.id);
      check(error);
      const { data: attempts, error: e } = await db
        .from("attempts")
        .select("*")
        .eq("classroom_id", input.id)
        .order("created_at");
      check(e);
      return NextResponse.json({ members, attempts });
    }
    if (input.action === "attempt") {
      const mission = getMission(input.missionSlug);
      if (!mission) throw new HttpError(404, "Mission not found.");
      const classroom = input.classroomId
        ? await member(input.classroomId)
        : null;
      if (classroom && classroom.mission_slug !== mission.slug)
        throw new HttpError(400, "This class has a different mission.");
      const constraints = classroom
        ? {
            budgetM: Number(classroom.budget_m),
            massKg: Number(classroom.mass_kg),
          }
        : mission.defaultConstraints;
      const resources = summarizeResources(input.design, constraints);
      if (resources.violations.length)
        throw new HttpError(400, resources.violations.join(" "));
      const result = runSimulation(mission, input.design, constraints);
      const { data, error } = await db.rpc("save_mission_attempt", {
        p_id: input.requestId,
        p_user: user.id,
        p_slug: mission.slug,
        p_class: input.classroomId ?? null,
        p_design: input.design,
        p_result: result,
        p_budget: constraints.budgetM,
        p_mass: constraints.massKg,
      });
      check(error);
      return NextResponse.json(data);
    }
    if (input.action === "history") {
      let query = db
        .from("attempts")
        .select("*")
        .eq("user_id", user.id)
        .eq("mission_slug", input.missionSlug)
        .eq("engine_version", ENGINE_VERSION)
        .order("created_at", { ascending: false })
        .limit(50);
      query = input.classroomId
        ? query.eq("classroom_id", input.classroomId)
        : query.is("classroom_id", null);
      const { data, error } = await query;
      check(error);
      return NextResponse.json(data);
    }
    if (input.action === "rankingConditions") {
      const mission = getMission(input.missionSlug)!;
      const { data, error } = await db.rpc("mission_ranking_conditions", {
        p_slug: mission.slug,
        p_engine: ENGINE_VERSION,
        p_default_budget: mission.defaultConstraints.budgetM,
        p_default_mass: mission.defaultConstraints.massKg,
        p_difficulty: input.difficulty,
      });
      check(error);
      return NextResponse.json(
        (data ?? []).map((c: { budget_m: number; mass_kg: number }) => ({
          budgetM: Number(c.budget_m),
          massKg: Number(c.mass_kg),
        })),
      );
    }
    if (input.action === "ranking") {
      const mission = getMission(input.missionSlug);
      if (!mission) throw new HttpError(404, "Mission not found.");
      const c = input.classroomId ? await member(input.classroomId) : null;
      if (c && c.mission_slug !== input.missionSlug)
        throw new HttpError(400, "Mission does not match this class.");
      const defaults = mission.defaultConstraints;
      const constraints = c
        ? { budgetM: Number(c.budget_m), massKg: Number(c.mass_kg) }
        : (input.constraints ?? defaults);
      const { data, error } = await db.rpc("mission_ranking_scoped", {
        p_slug: mission.slug,
        p_class: input.classroomId ?? null,
        p_engine: ENGINE_VERSION,
        p_default_budget: defaults.budgetM,
        p_default_mass: defaults.massKg,
        p_difficulty: input.difficulty ?? defaultRankingDifficulty(defaults, c),
        p_user: user.id,
        p_budget: constraints.budgetM,
        p_mass: constraints.massKg,
      });
      check(error);
      return NextResponse.json(
        publicRanking((data ?? []) as RankingSource[], user.id),
      );
    }
    if (input.action === "myAttempts") {
      // Only the caller's own rows, summarized; never designs or other players.
      const { data, error } = await db
        .from("attempts")
        .select(
          "id,mission_slug,classroom_id,score_total,score_breakdown,constraints,engine_version,created_at",
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(300);
      check(error);
      return NextResponse.json(data ?? []);
    }
    if (input.action === "myClasses") {
      const { data: memberships, error } = await db
        .from("classroom_members")
        .select("classroom_id,nickname")
        .eq("user_id", user.id);
      check(error);
      const ids = (memberships ?? []).map((m) => m.classroom_id);
      const { data: joined, error: e1 } = ids.length
        ? await db
            .from("classrooms")
            .select(
              "id,name,mission_slug,budget_m,mass_kg,max_attempts,deadline,is_active",
            )
            .in("id", ids)
        : { data: [], error: null };
      check(e1);
      const { data: owned, error: e2 } = await db
        .from("classrooms")
        .select(
          "id,name,mission_slug,budget_m,mass_kg,max_attempts,deadline,is_active,join_code",
        )
        .eq("teacher_id", user.id)
        .order("created_at", { ascending: false });
      check(e2);
      return NextResponse.json([
        ...(owned ?? []).map((c) => ({
          ...c,
          role: "teacher",
          nickname: null,
        })),
        ...(joined ?? []).map((c) => ({
          ...c,
          role: "student",
          nickname:
            memberships?.find((m) => m.classroom_id === c.id)?.nickname ?? null,
        })),
      ]);
    }
    if (input.action === "submitScore") {
      const { data: attempt, error } = await db
        .from("attempts")
        .select(
          "id,mission_slug,classroom_id,score_total,engine_version,constraints",
        )
        .eq("id", input.attemptId)
        .eq("user_id", user.id)
        .maybeSingle();
      check(error);
      if (!attempt)
        throw new HttpError(
          404,
          "This mission result is not saved on the server yet.",
        );
      const mission = getMission(attempt.mission_slug);
      if (!mission) throw new HttpError(404, "Mission not found.");
      if (attempt.classroom_id) await member(attempt.classroom_id);
      if (!attempt.classroom_id || input.nickname) {
        if (!input.nickname)
          throw new HttpError(400, "Choose a pilot name first.");
        // Idempotent: repeating the same name on refresh changes nothing.
        const { error: e } = await db
          .from("profiles")
          .update({ nickname: input.nickname })
          .eq("id", user.id);
        check(e);
      }
      // Rank within the attempt's own scope: mission + difficulty + engine.
      const defaults = mission.defaultConstraints;
      const constraints =
        (attempt.constraints as { budgetM: number; massKg: number } | null) ??
        defaults;
      const difficulty = difficultyOf(constraints, defaults);
      const { data, error: e } = await db.rpc("mission_ranking_scoped", {
        p_slug: attempt.mission_slug,
        p_class: attempt.classroom_id,
        p_engine: ENGINE_VERSION,
        p_default_budget: defaults.budgetM,
        p_default_mass: defaults.massKg,
        p_difficulty: difficulty,
        p_budget: constraints.budgetM,
        p_mass: constraints.massKg,
        p_user: user.id,
      });
      check(e);
      return NextResponse.json(
        leaderboardSubmission(
          (data ?? []) as RankingSource[],
          user.id,
          attempt,
          ENGINE_VERSION,
          {
            missionSlug: attempt.mission_slug,
            difficulty,
            engineVersion: ENGINE_VERSION,
            constraints,
          },
        ),
      );
    }

    throw new HttpError(400, "Unknown action.");
  } catch (error) {
    const status =
      error instanceof HttpError
        ? error.status
        : error instanceof z.ZodError || error instanceof SyntaxError
          ? 400
          : 503;
    return NextResponse.json(
      {
        error: {
          code: status === 503 ? "SERVICE_UNAVAILABLE" : "REQUEST_FAILED",
          message:
            error instanceof z.ZodError
              ? error.issues.map((i) => i.message).join(" ")
              : status === 503
                ? "Live backend is unavailable. Check the server configuration."
                : error instanceof Error
                  ? error.message
                  : "Request failed.",
        },
      },
      { status },
    );
  }
}
