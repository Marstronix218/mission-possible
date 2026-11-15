-- Overall global leaderboard: the sum of each pilot's best score per mission.
-- Classroom attempts never contribute to this public board.
create function public.overall_ranking(p_engine text)
returns table(user_id uuid,nickname text,score numeric,attempts bigint,improvement numeric,achieved timestamptz)
language sql stable security definer set search_path='' as $$
  with eligible as (
    select a.*
    from public.attempts a
    join public.profiles p on p.id=a.user_id
    where a.classroom_id is null
      and a.engine_version=p_engine
      and p.nickname is not null
  ),
  best_per_mission as (
    select distinct on (user_id,mission_slug)
      user_id,mission_slug,score_total,created_at
    from eligible
    order by user_id,mission_slug,score_total desc,created_at
  ),
  totals as (
    select user_id,sum(score_total) score,max(created_at) achieved
    from best_per_mission group by user_id
  ),
  firsts as (
    select distinct on (user_id) user_id,score_total
    from eligible order by user_id,created_at
  ),
  counts as (
    select user_id,count(*) n from eligible group by user_id
  )
  select t.user_id,p.nickname,t.score,c.n,t.score-f.score_total,t.achieved
  from totals t
  join public.profiles p on p.id=t.user_id
  join firsts f using(user_id)
  join counts c using(user_id)
  order by t.score desc,t.achieved,t.user_id
  limit 100;
$$;
revoke all on function public.overall_ranking(text) from public,anon,authenticated;
grant execute on function public.overall_ranking(text) to service_role;
