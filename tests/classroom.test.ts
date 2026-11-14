import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
let db: PGlite;
const teacher = "11111111-1111-4111-8111-111111111111";
const student = "22222222-2222-4222-8222-222222222222";
const stranger = "33333333-3333-4333-8333-333333333333";
let classId: string;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`,
  );
  const migrationDir = new URL("../supabase/migrations/", import.meta.url);
  await db.query("insert into auth.users values ($1)", [
    "77777777-7777-4777-8777-777777777777",
  ]);
  for (const filename of (await readdir(migrationDir))
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    const sql = await readFile(new URL(filename, migrationDir), "utf8");
    await db.exec(
      sql.replace(
        "alter publication supabase_realtime add table public.classroom_updates;",
        "",
      ),
    );
  }
  await db.query("insert into auth.users values ($1),($2),($3)", [
    teacher,
    student,
    stranger,
  ]);
  const { rows } = await db.query<{ id: string }>(
    `insert into public.classrooms(teacher_id,name,join_code,mission_slug,budget_m,mass_kg,max_attempts) values($1,'Physics','AB1234','houston',250,500,1) returning id`,
    [teacher],
  );
  classId = rows[0].id;
}, 30000);
afterAll(async () => {
  await db.close();
});
describe("classroom database contracts", () => {
  it("joins with a nickname and prevents case-insensitive duplicate names", async () => {
    const joined = await db.query<{ id: string }>(
      "select (public.join_mission_classroom($1,$2,$3)).id",
      [student, "AB1234", "Orbit"],
    );
    expect(joined.rows[0].id).toBe(classId);
    const duplicate = await db.query<{ id: string }>(
      "select (public.join_mission_classroom($1,$2,$3)).id",
      [stranger, "AB1234", "orbit"],
    );
    expect(duplicate.rows[0].id).toBeNull();
  });
  it("limits invalid join attempts without rolling the rate counter back", async () => {
    for (let i = 0; i < 5; i++)
      await db.query("select public.join_mission_classroom($1,$2,$3)", [
        stranger,
        "XXXXXX",
        "NewName",
      ]);
    const { rows } = await db.query<{ count: number }>(
      "select count from public.join_requests where user_id=$1",
      [stranger],
    );
    expect(rows[0].count).toBe(6);
    const blocked = await db.query<{ id: string }>(
      "select (public.join_mission_classroom($1,$2,$3)).id",
      [stranger, "AB1234", "NewName"],
    );
    expect(blocked.rows[0].id).toBeNull();
  });
  it("saves idempotently and enforces the attempt limit", async () => {
    const id = "44444444-4444-4444-8444-444444444444";
    const args = [
      id,
      student,
      "houston",
      classId,
      {},
      { score: { total: 75 }, engineVersion: "1.0.0" },
      250,
      500,
    ];
    const sql =
      "select (public.save_mission_attempt($1,$2,$3,$4,$5,$6,$7,$8)).id";
    expect((await db.query<{ id: string }>(sql, args)).rows[0].id).toBe(id);
    expect((await db.query<{ id: string }>(sql, args)).rows[0].id).toBe(id);
    await expect(
      db.query(sql, ["55555555-5555-4555-8555-555555555555", ...args.slice(1)]),
    ).rejects.toThrow("Attempt limit reached");
  });
  it("separates classroom ranking from global ranking", async () => {
    const args = ["houston", classId, "1.0.0"];
    const { rows } = await db.query<{ nickname: string; score: number }>(
      "select * from public.mission_ranking($1,$2,$3)",
      args,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].nickname).toBe("Orbit");
    expect(
      (
        await db.query("select * from public.mission_ranking($1,null,$2)", [
          "houston",
          "1.0.0",
        ])
      ).rows,
    ).toHaveLength(0);
  });
  it("denies stranger reads and direct student score writes", async () => {
    await db.exec(
      `set role authenticated; set "request.jwt.claim.sub"='${stranger}';`,
    );
    expect((await db.query("select * from public.attempts")).rows).toHaveLength(
      0,
    );
    expect(
      (await db.query("select * from public.classrooms")).rows,
    ).toHaveLength(0);
    await expect(
      db.query("select public.save_mission_attempt($1,$2,$3,$4,$5,$6,$7,$8)", [
        "66666666-6666-4666-8666-666666666666",
        stranger,
        "houston",
        classId,
        {},
        { score: { total: 100 } },
        250,
        500,
      ]),
    ).rejects.toThrow("permission denied");
    await db.exec("reset role");
  });
  it("locks assignment scoring after an attempt while allowing deadline changes", async () => {
    await expect(
      db.query("update public.classrooms set budget_m=300 where id=$1", [
        classId,
      ]),
    ).rejects.toThrow("Scoring settings are locked");
    await expect(
      db.query("update public.classrooms set mission_slug=$1 where id=$2", [
        "phoenix",
        classId,
      ]),
    ).rejects.toThrow("Scoring settings are locked");
    await db.query(
      "update public.classrooms set deadline=now()+interval '1 day' where id=$1",
      [classId],
    );
  });
  it("backfills pre-existing auth users without granting teacher privileges", async () => {
    const { rows } = await db.query<{ role: string }>(
      "select role from public.profiles where id=$1",
      ["77777777-7777-4777-8777-777777777777"],
    );
    expect(rows[0].role).toBe("student");
  });
  it("excludes solo scores until a public nickname is explicitly chosen", async () => {
    await db.query(
      "select public.save_mission_attempt($1,$2,$3,null,$4,$5,$6,$7)",
      [
        "88888888-8888-4888-8888-888888888888",
        student,
        "houston",
        {},
        { score: { total: 80 }, engineVersion: "1.0.0" },
        250,
        500,
      ],
    );
    const sql = "select * from public.mission_ranking($1,null,$2)";
    expect((await db.query(sql, ["houston", "1.0.0"])).rows).toHaveLength(0);
    await db.query("update public.profiles set nickname=$1 where id=$2", [
      "SkyMapper",
      student,
    ]);
    const { rows } = await db.query<{ nickname: string }>(sql, [
      "houston",
      "1.0.0",
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].nickname).toBe("SkyMapper");
    await db.query("update public.profiles set nickname=null where id=$1", [
      student,
    ]);
    expect((await db.query(sql, ["houston", "1.0.0"])).rows).toHaveLength(0);
  });
});
