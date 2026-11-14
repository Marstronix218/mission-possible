-- Bring pre-existing Auth identities into the application without granting privileges.
insert into public.profiles(id) select id from auth.users on conflict(id) do nothing;

create function public.lock_classroom_scoring() returns trigger language plpgsql set search_path='' as $$
begin
 if (new.mission_slug,new.budget_m,new.mass_kg) is distinct from (old.mission_slug,old.budget_m,old.mass_kg)
 and exists(select 1 from public.attempts where classroom_id=old.id)
 then raise exception 'Scoring settings are locked after the first attempt. Create a new class for another assignment.';end if;
 return new;
end;
$$;
create trigger classroom_scoring_lock before update on public.classrooms for each row execute function public.lock_classroom_scoring();
revoke all on function public.lock_classroom_scoring() from public,anon,authenticated;

-- Global participation is opt-in: only explicitly chosen profile nicknames are public.
-- User IDs are needed for grouping internally but are removed by the API response.
create or replace function public.mission_ranking(p_slug text,p_class uuid,p_engine text) returns table(user_id uuid,nickname text,score numeric,attempts bigint,improvement numeric,achieved timestamptz) language sql stable security definer set search_path='' as $$
 with eligible as (
 select a.* from public.attempts a join public.profiles p on p.id=a.user_id
 where a.mission_slug=p_slug and a.engine_version=p_engine
 and a.classroom_id is not distinct from p_class
 and (p_class is not null or p.nickname is not null)
 and (p_class is null or exists(select 1 from public.classroom_members m where m.classroom_id=p_class and m.user_id=a.user_id))
 ), best as (select distinct on (user_id) user_id,score_total,created_at from eligible order by user_id,score_total desc,created_at),
 firsts as(select distinct on (user_id) user_id,score_total from eligible order by user_id,created_at),
 counts as(select user_id,count(*) n from eligible group by user_id)
 select b.user_id,case when p_class is null then p.nickname else m.nickname end,b.score_total,c.n,b.score_total-f.score_total,b.created_at
 from best b join firsts f using(user_id) join counts c using(user_id) join public.profiles p on p.id=b.user_id
 left join public.classroom_members m on m.classroom_id=p_class and m.user_id=b.user_id
 order by b.score_total desc,b.created_at,b.user_id limit 100;
$$;
revoke all on function public.mission_ranking(text,uuid,text) from public,anon,authenticated;
grant execute on function public.mission_ranking(text,uuid,text) to service_role;
