-- Leaderboard categories: rankings scoped by mission + difficulty tier + engine version.
-- The game has no difficulty field; the tier is derived from the budget/mass stored on
-- each attempt (attempts.constraints) compared with the mission defaults that the
-- trusted API passes in from data/missions. Mirrors src/lib/leaderboard/difficulty.ts;
-- keep the two in sync. Existing mission_ranking() is left unchanged for old callers.
create function public.mission_difficulty(p_budget numeric,p_mass numeric,p_default_budget numeric,p_default_mass numeric)
returns text language sql immutable set search_path='' as $$
 select case
  when p_budget*100 between p_default_budget*95 and p_default_budget*105
   and p_mass*100 between p_default_mass*95 and p_default_mass*105 then 'standard'
  when (p_budget*100 < p_default_budget*90 or p_mass*100 < p_default_mass*90)
   and p_budget*100 <= p_default_budget*105 and p_mass*100 <= p_default_mass*105 then 'tight'
  when (p_budget*100 >= p_default_budget*115 or p_mass*100 >= p_default_mass*115)
   and p_budget*100 >= p_default_budget*95 and p_mass*100 >= p_default_mass*95 then 'relaxed'
  else 'custom' end
$$;
revoke all on function public.mission_difficulty(numeric,numeric,numeric,numeric) from public,anon,authenticated;
grant execute on function public.mission_difficulty(numeric,numeric,numeric,numeric) to service_role;

-- Best score per player within one (mission, difficulty, engine) scope.
-- Global (p_class null): every attempt of players who chose a public profile nickname,
-- shown under that nickname. Class: only that class's attempts by current members,
-- shown under the class nickname. Returns the top 100 plus p_user's own row when it
-- ranks lower, with its true rank and the total number of ranked players.
create function public.mission_ranking_scoped(p_slug text,p_class uuid,p_engine text,p_default_budget numeric,p_default_mass numeric,p_difficulty text,p_user uuid default null,p_budget numeric default null,p_mass numeric default null)
returns table(user_id uuid,nickname text,score numeric,attempts bigint,improvement numeric,achieved timestamptz,rank bigint,players bigint)
language sql stable security definer set search_path='' as $$
 with eligible as (
 select a.* from public.attempts a join public.profiles p on p.id=a.user_id
 where a.mission_slug=p_slug and a.engine_version=p_engine
 and (p_class is null or a.classroom_id=p_class)
 and (p_class is not null or p.nickname is not null)
 and (p_class is null or exists(select 1 from public.classroom_members m where m.classroom_id=p_class and m.user_id=a.user_id))
 and public.mission_difficulty(
  coalesce((a.constraints->>'budgetM')::numeric,p_default_budget),
  coalesce((a.constraints->>'massKg')::numeric,p_default_mass),
  p_default_budget,p_default_mass)=p_difficulty
 and coalesce((a.constraints->>'budgetM')::numeric,p_default_budget)=coalesce(p_budget,p_default_budget)
 and coalesce((a.constraints->>'massKg')::numeric,p_default_mass)=coalesce(p_mass,p_default_mass)
 ), best as (select distinct on (user_id) user_id,score_total,created_at from eligible order by user_id,score_total desc,created_at),
 firsts as(select distinct on (user_id) user_id,score_total from eligible order by user_id,created_at),
 counts as(select user_id,count(*) n from eligible group by user_id),
 ranked as(
 select b.user_id,case when p_class is null then p.nickname else m.nickname end as nickname,b.score_total as score,c.n as attempts,
 b.score_total-f.score_total as improvement,b.created_at as achieved,
 row_number() over(order by b.score_total desc,b.created_at,b.user_id) as rank,count(*) over() as players
 from best b join firsts f using(user_id) join counts c using(user_id) join public.profiles p on p.id=b.user_id
 left join public.classroom_members m on m.classroom_id=p_class and m.user_id=b.user_id
 )
 select r.user_id,r.nickname,r.score,r.attempts,r.improvement,r.achieved,r.rank,r.players from ranked r
 where r.rank<=100 or r.user_id=p_user order by r.rank;
$$;
revoke all on function public.mission_ranking_scoped(text,uuid,text,numeric,numeric,text,uuid,numeric,numeric) from public,anon,authenticated;
grant execute on function public.mission_ranking_scoped(text,uuid,text,numeric,numeric,text,uuid,numeric,numeric) to service_role;

-- Only existing public scopes are discoverable; no class identity or user IDs leave
-- this function. Selecting a tier never combines different engineering limits.
create function public.mission_ranking_conditions(p_slug text,p_engine text,p_default_budget numeric,p_default_mass numeric,p_difficulty text)
returns table(budget_m numeric,mass_kg numeric)
language sql stable security definer set search_path='' as $$
 select distinct coalesce((a.constraints->>'budgetM')::numeric,p_default_budget) budget_m,
 coalesce((a.constraints->>'massKg')::numeric,p_default_mass) mass_kg
 from public.attempts a join public.profiles p on p.id=a.user_id
 where a.mission_slug=p_slug and a.engine_version=p_engine and p.nickname is not null
 and public.mission_difficulty(coalesce((a.constraints->>'budgetM')::numeric,p_default_budget),
 coalesce((a.constraints->>'massKg')::numeric,p_default_mass),p_default_budget,p_default_mass)=p_difficulty
 order by budget_m,mass_kg;
$$;
revoke all on function public.mission_ranking_conditions(text,text,numeric,numeric,text) from public,anon,authenticated;
grant execute on function public.mission_ranking_conditions(text,text,numeric,numeric,text) to service_role;
