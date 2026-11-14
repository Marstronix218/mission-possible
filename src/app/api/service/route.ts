import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { identity, HttpError, check } from "@/lib/backend";
import {
  classSchema,
  designSchema,
  nicknameSchema,
} from "@/components/results/contracts";
import { getMission } from "@/components/results/missions";
import { runSimulation, summarizeResources, ENGINE_VERSION } from "@/lib/sim";
export const runtime = "nodejs";
const uuid = z.string().uuid();
const inputSchema = z.discriminatedUnion("action", [
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
    action: z.literal("ranking"),
    missionSlug: z.string(),
    classroomId: uuid.optional(),
  }),
]);
export async function POST(request: Request) {
  try {
    if (Number(request.headers.get("content-length") ?? 0) > 20000)
      throw new HttpError(413, "Request too large.");
    const raw = await request.text();
    if (raw.length > 20000) throw new HttpError(413, "Request too large.");
    const input = inputSchema.parse(JSON.parse(raw));
    const { db, user } = await identity(request);
    const teacher = () => {
      if (user.is_anonymous || !user.email_confirmed_at)
        throw new HttpError(
          403,
          "Teachers must sign in using their email magic link.",
        );
    };
    const owned = async (id: string) => {
      teacher();
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
    if (input.action === "createClass") {
      teacher();
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
      teacher();
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
    if (input.action === "ranking") {
      if (!getMission(input.missionSlug))
        throw new HttpError(404, "Mission not found.");
      if (input.classroomId) {
        const c = await member(input.classroomId);
        if (c.mission_slug !== input.missionSlug)
          throw new HttpError(400, "Mission does not match this class.");
      }
      const { data, error } = await db.rpc("mission_ranking", {
        p_slug: input.missionSlug,
        p_class: input.classroomId ?? null,
        p_engine: ENGINE_VERSION,
      });
      check(error);
      return NextResponse.json(data);
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
