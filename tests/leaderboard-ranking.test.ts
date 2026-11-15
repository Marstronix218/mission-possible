import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { difficultyOf } from "@/lib/leaderboard/difficulty";

let db: PGlite;
const engine = "1.2.0";
const teacher = "11111111-1111-4111-8111-111111111111";
const nova = "22222222-2222-4222-8222-222222222222";
const river = "33333333-3333-4333-8333-333333333333";
const hidden = "44444444-4444-4444-8444-444444444444";
let classId: string;

type Row = {
  user_id: string;
  nickname: string;
  score: string;
  attempts: string;
  improvement: string;
  rank: string;
  players: string;
};
const ranking = async (
  slug: string,
  difficulty: string,
  opts: {
    classId?: string;
    user?: string;
    defaults?: [number, number];
    conditions?: [number, number];
  } = {},
) =>
  (
    await db.query<Row>(
      "select * from public.mission_ranking_scoped($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [
        slug,
        opts.classId ?? null,
        engine,
        opts.defaults?.[0] ?? 220,
        opts.defaults?.[1] ?? 450,
        difficulty,
        opts.user ?? null,
        opts.conditions?.[0] ?? opts.defaults?.[0] ?? 220,
        opts.conditions?.[1] ?? opts.defaults?.[1] ?? 450,
      ],
    )
  ).rows;
let seq = 0;
const attempt = (
  user: string,
  score: number,
  budget: number | null = 220,
  mass: number | null = 450,
  extra: { classId?: string; engine?: string; slug?: string } = {},
) =>
  db.query(
    `insert into public.attempts(user_id,mission_slug,classroom_id,design,score_total,score_breakdown,result,engine_version,constraints,created_at)
     values($1,$2,$3,'{}',$4,'{}','{}',$5,$6,timestamptz '2026-11-14 00:00:00+00' + make_interval(mins => $7))`,
    [
      user,
      extra.slug ?? "los-angeles",
      extra.classId ?? null,
      score,
      extra.engine ?? engine,
      budget === null
        ? null
        : JSON.stringify({ budgetM: budget, massKg: mass }),
      ++seq,
    ],
  );

beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`,
  );
  const dir = new URL("../supabase/migrations/", import.meta.url);
  for (const name of (await readdir(dir))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(
      (await readFile(new URL(name, dir), "utf8")).replace(
        "alter publication supabase_realtime add table public.classroom_updates;",
        "",
      ),
    );
  await db.query("insert into auth.users values ($1),($2),($3),($4)", [
    teacher,
    nova,
    river,
    hidden,
  ]);
  await db.query(
    "update public.profiles set nickname=case id when $1::uuid then 'Nova' when $2::uuid then 'River' end where id in ($1,$2)",
    [nova, river],
  );
  const { rows } = await db.query<{ id: string }>(
    "insert into public.classrooms(teacher_id,name,join_code,mission_slug,budget_m,mass_kg) values($1,'Lab','LAB123','los-angeles',150,450) returning id",
    [teacher],
  );
  classId = rows[0].id;
  await db.query(
    "insert into public.classroom_members(classroom_id,user_id,nickname) values($1,$2,'Class Nova'),($1,$3,'Class Shadow')",
    [classId, nova, hidden],
  );
  await attempt(nova, 40);
  await attempt(nova, 70);
  await attempt(nova, 55, null, null); // legacy row without constraints = defaults
  await attempt(river, 65);
  await attempt(river, 95, 260, 520); // relaxed
  await attempt(river, 99, 440, 900); // same tier, different engineering limits
  await attempt(river, 98, 225, 450); // same standard tier, different budget
  await attempt(river, 99, 220, 450, { engine: "1.0.0" });
  await attempt(river, 98, 220, 450, { slug: "houston" });
  await attempt(hidden, 90); // no public nickname: never on the global board
  await attempt(nova, 30, 150, 450, { classId });
  await attempt(hidden, 60, 150, 450, { classId });
}, 30000);
afterAll(async () => {
  await db.close();
});

describe("mission_difficulty", () => {
  it("matches the TypeScript tiers, including band edges", async () => {
    for (const [db0, dm] of [
      [200, 400],
      [220, 450],
      [175, 420],
    ])
      for (const b of [0.5, 0.85, 0.9, 0.925, 0.95, 1, 1.05, 1.1, 1.15, 1.5])
        for (const m of [0.8, 0.9, 0.95, 1, 1.05, 1.12, 1.15, 1.3]) {
          const budget = Math.round(db0 * b * 100) / 100;
          const mass = Math.round(dm * m * 100) / 100;
          const { rows } = await db.query<{ t: string }>(
            "select public.mission_difficulty($1,$2,$3,$4) t",
            [budget, mass, db0, dm],
          );
          expect([budget, mass, db0, dm, rows[0].t]).toEqual([
            budget,
            mass,
            db0,
            dm,
            difficultyOf(
              { budgetM: budget, massKg: mass },
              { budgetM: db0, massKg: dm },
            ),
          ]);
        }
  });
  it("matches SQL numeric for precise values next to thresholds", async () => {
    for (const budget of [
      197.999999999, 198, 208.999999999, 209, 231, 231.000000001, 252.999999999,
      253,
    ]) {
      const { rows } = await db.query<{ tier: string }>(
        "select public.mission_difficulty($1,450,220,450) tier",
        [budget],
      );
      expect(
        difficultyOf(
          { budgetM: budget, massKg: 450 },
          { budgetM: 220, massKg: 450 },
        ),
      ).toBe(rows[0].tier);
    }
  });
});

describe("mission_ranking_scoped", () => {
  it("ranks the best score per public player within one tier and engine", async () => {
    const rows = await ranking("los-angeles", "standard", { user: nova });
    expect(
      rows.map((r) => [
        r.nickname,
        Number(r.score),
        Number(r.attempts),
        Number(r.rank),
      ]),
    ).toEqual([
      ["Nova", 70, 3, 1],
      ["River", 65, 1, 2],
    ]);
    expect(Number(rows[0].improvement)).toBe(30);
    expect(rows.every((r) => Number(r.players) === 2)).toBe(true);
  });
  it("keeps other tiers, missions and engine versions separate", async () => {
    expect(
      (await ranking("los-angeles", "relaxed", { conditions: [260, 520] })).map(
        (r) => Number(r.score),
      ),
    ).toEqual([95]);
    expect(
      (await ranking("houston", "standard", { defaults: [320, 650] })).length,
    ).toBe(0);
    // Class attempts of public players join the global board of their own tier.
    expect(
      (await ranking("los-angeles", "tight", { conditions: [150, 450] })).map(
        (r) => [r.nickname, Number(r.score)],
      ),
    ).toEqual([["Nova", 30]]);
  });
  it("keeps exact engineering conditions separate within a difficulty tier", async () => {
    const rows = await ranking("los-angeles", "relaxed", {
      conditions: [260, 520],
    });
    expect(rows.map((r) => [Number(r.score), Number(r.attempts)])).toEqual([
      [95, 1],
    ]);
    expect(
      (await ranking("los-angeles", "relaxed", { conditions: [440, 900] })).map(
        (r) => Number(r.score),
      ),
    ).toEqual([99]);
    expect(
      (
        await ranking("los-angeles", "standard", { conditions: [225, 450] })
      ).map((r) => Number(r.score)),
    ).toEqual([98]);
  });
  it("discovers only public condition scopes in the selected mission, tier and engine", async () => {
    await attempt(hidden, 90, 700, 900);
    const { rows } = await db.query<{ budget_m: string; mass_kg: string }>(
      "select * from public.mission_ranking_conditions('los-angeles',$1,220,450,'relaxed')",
      [engine],
    );
    expect(rows.map((c) => [Number(c.budget_m), Number(c.mass_kg)])).toEqual([
      [260, 520],
      [440, 900],
    ]);
    const privilege = await db.query<{ ok: boolean }>(
      "select has_function_privilege('authenticated','public.mission_ranking_conditions(text,text,numeric,numeric,text)','execute') ok",
    );
    expect(privilege.rows[0].ok).toBe(false);
  });
  it("ranks a class on its own attempts under class nicknames", async () => {
    const rows = await ranking("los-angeles", "tight", {
      classId,
      conditions: [150, 450],
    });
    expect(rows.map((r) => [r.nickname, Number(r.score)])).toEqual([
      ["Class Shadow", 60],
      ["Class Nova", 30],
    ]);
  });
  it("returns the caller's own row with its true rank beyond the top 100", async () => {
    await db.exec(`
      insert into auth.users select ('00000000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid from generate_series(1,105) g;
      update public.profiles set nickname='Pilot '||right(id::text,3) where nickname is null and id::text like '00000000-0000-4000-8000-%';
      insert into public.attempts(user_id,mission_slug,design,score_total,score_breakdown,result,engine_version,constraints)
        select id,'phoenix','{}',90,'{}','{}','${engine}','{"budgetM":180,"massKg":380}' from public.profiles where id::text like '00000000-0000-4000-8000-%';
    `);
    await attempt(nova, 10, 180, 380, { slug: "phoenix" });
    const rows = await ranking("phoenix", "standard", {
      user: nova,
      defaults: [180, 380],
    });
    expect(rows).toHaveLength(101);
    expect([
      rows[100].user_id,
      Number(rows[100].rank),
      Number(rows[100].players),
    ]).toEqual([nova, 106, 106]);
    const anon = await ranking("phoenix", "standard", { defaults: [180, 380] });
    expect(anon).toHaveLength(100);
  });
  it("is callable only by the service role", async () => {
    const { rows } = await db.query<{ ok: boolean }>(
      "select has_function_privilege('authenticated','public.mission_ranking_scoped(text,uuid,text,numeric,numeric,text,uuid,numeric,numeric)','execute') ok",
    );
    expect(rows[0].ok).toBe(false);
  });
});
