-- Server-authenticated operations. Browser clients have read-only access to their own
-- attempts/classes/membership; all mutations pass through verified API sessions.
create table public.classrooms (
 id uuid primary key default gen_random_uuid(), teacher_id uuid not null references auth.users on delete cascade,
 name text not null check(length(name) between 1 and 80), join_code text unique not null check(join_code ~ '^[A-Z0-9]{6}$'),
 mission_slug text not null check(mission_slug in ('los-angeles','houston','phoenix')),
 budget_m numeric not null check(budget_m between 80 and 1000), mass_kg numeric not null check(mass_kg between 150 and 1500),
 max_attempts integer check(max_attempts between 1 and 100), deadline timestamptz, is_active boolean not null default true,
 created_at timestamptz not null default now()
);
create table public.classroom_members (
 classroom_id uuid references public.classrooms on delete cascade, user_id uuid references auth.users on delete cascade,
 nickname text not null check(length(nickname) between 2 and 24), joined_at timestamptz not null default now(), primary key(classroom_id,user_id)
);
create unique index members_unique_nickname on public.classroom_members(classroom_id,lower(nickname));
alter table public.attempts add column classroom_id uuid references public.classrooms on delete cascade;
alter table public.attempts add column constraints jsonb;
create index attempts_ranking on public.attempts(mission_slug,classroom_id,engine_version,score_total desc,created_at);
create table public.join_requests (user_id uuid primary key references auth.users on delete cascade, count integer not null, window_start timestamptz not null);
create table public.classroom_updates (classroom_id uuid primary key references public.classrooms on delete cascade, updated_at timestamptz not null default now());
alter table public.classrooms enable row level security;
alter table public.classroom_members enable row level security;
alter table public.attempts enable row level security;
alter table public.join_requests enable row level security;
alter table public.classroom_updates enable row level security;
create function public.can_read_class(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.classrooms where id=p_id and teacher_id=auth.uid())
 or exists(select 1 from public.classroom_members where classroom_id=p_id and user_id=auth.uid());
$$;
revoke all on function public.can_read_class(uuid) from public;
grant execute on function public.can_read_class(uuid) to authenticated;
create policy classrooms_read on public.classrooms for select to authenticated using(public.can_read_class(id));
create policy members_read on public.classroom_members for select to authenticated using(public.can_read_class(classroom_id));
create policy attempts_read on public.attempts for select to authenticated using(user_id=auth.uid() or exists(select 1 from public.classrooms where id=classroom_id and teacher_id=auth.uid()));
create policy updates_read on public.classroom_updates for select to authenticated using(public.can_read_class(classroom_id));
revoke all on public.classrooms,public.classroom_members,public.attempts,public.join_requests,public.classroom_updates from anon,authenticated;
grant select on public.classrooms,public.classroom_members,public.attempts,public.classroom_updates to authenticated;
grant all on public.classrooms,public.classroom_members,public.attempts,public.join_requests,public.classroom_updates to service_role;

create function public.join_mission_classroom(p_user uuid,p_code text,p_nickname text) returns public.classrooms language plpgsql security definer set search_path='' as $$
 declare c public.classrooms; tries public.join_requests;
 begin
 -- Return failures as JSON from the service only after this transaction commits.
 -- A rate counter must persist even when a code is invalid, so invalid joins return null.
 insert into public.join_requests values(p_user,1,now()) on conflict(user_id) do update set count=case when public.join_requests.window_start < now()-interval '1 minute' then 1 else public.join_requests.count+1 end,window_start=case when public.join_requests.window_start < now()-interval '1 minute' then now() else public.join_requests.window_start end returning * into tries;
 if tries.count>5 then return null; end if;
 select * into c from public.classrooms where join_code=p_code and is_active and (deadline is null or deadline>now()) for update;
 if c.id is null then return null; end if;
 if exists(select 1 from public.classroom_members where classroom_id=c.id and user_id=p_user) then return c; end if;
 if exists(select 1 from public.classroom_members where classroom_id=c.id and lower(nickname)=lower(p_nickname)) then return null; end if;
 insert into public.classroom_members(classroom_id,user_id,nickname) values(c.id,p_user,p_nickname);
 return c;
 end;
$$;
create function public.save_mission_attempt(p_id uuid,p_user uuid,p_slug text,p_class uuid,p_design jsonb,p_result jsonb,p_budget numeric,p_mass numeric) returns public.attempts language plpgsql security definer set search_path='' as $$
 declare c public.classrooms; a public.attempts;
 begin
 -- Serialize each user's submissions and enforce retry idempotence + class limits.
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
 select * into a from public.attempts where id=p_id;
 if a.id is not null then if a.user_id<>p_user then raise exception 'Invalid attempt identifier'; end if;return a;end if;
 if p_class is not null then
 select * into c from public.classrooms where id=p_class for update;
 if c.id is null or not c.is_active or (c.deadline is not null and c.deadline<=now()) then raise exception 'Class is closed';end if;
 if not exists(select 1 from public.classroom_members where classroom_id=c.id and user_id=p_user) then raise exception 'Join this class first';end if;
 if c.mission_slug<>p_slug or c.budget_m<>p_budget or c.mass_kg<>p_mass then raise exception 'Class settings changed. Reload before launching.';end if;
 if c.max_attempts is not null and (select count(*) from public.attempts where classroom_id=p_class and user_id=p_user)>=c.max_attempts then raise exception 'Attempt limit reached';end if;
 end if;
 insert into public.attempts(id,user_id,classroom_id,mission_slug,design,result,score_breakdown,score_total,engine_version,constraints) values(p_id,p_user,p_class,p_slug,p_design,p_result,p_result->'score',(p_result->'score'->>'total')::numeric,p_result->>'engineVersion',jsonb_build_object('budgetM',p_budget,'massKg',p_mass)) returning * into a;
 if p_class is not null then insert into public.classroom_updates values(p_class,now()) on conflict(classroom_id) do update set updated_at=excluded.updated_at;end if;
 return a;
 end;
$$;
revoke all on function public.join_mission_classroom(uuid,text,text) from public,anon,authenticated;
revoke all on function public.save_mission_attempt(uuid,uuid,text,uuid,jsonb,jsonb,numeric,numeric) from public,anon,authenticated;
grant execute on function public.join_mission_classroom(uuid,text,text) to service_role;
grant execute on function public.save_mission_attempt(uuid,uuid,text,uuid,jsonb,jsonb,numeric,numeric) to service_role;
-- Realtime exposes only a change timestamp to members, never student designs or emails.
alter publication supabase_realtime add table public.classroom_updates;

create function public.mission_ranking(p_slug text,p_class uuid,p_engine text) returns table(user_id uuid,nickname text,score numeric,attempts bigint,improvement numeric,achieved timestamptz) language sql stable security definer set search_path='' as $$
 with eligible as (
 select a.* from public.attempts a where mission_slug=p_slug and engine_version=p_engine
 and classroom_id is not distinct from p_class
 and (p_class is null or exists(select 1 from public.classroom_members m where m.classroom_id=p_class and m.user_id=a.user_id))
 ), best as (select distinct on (user_id) user_id,score_total,created_at from eligible order by user_id,score_total desc,created_at),
 firsts as(select distinct on (user_id) user_id,score_total from eligible order by user_id,created_at),
 counts as(select user_id,count(*) n from eligible group by user_id)
 select b.user_id,coalesce(m.nickname,'Explorer '||left(b.user_id::text,6)),b.score_total,c.n,b.score_total-f.score_total,b.created_at
 from best b join firsts f using(user_id) join counts c using(user_id)
 left join public.classroom_members m on m.classroom_id=p_class and m.user_id=b.user_id
 order by b.score_total desc,b.created_at,b.user_id limit 100;
$$;
revoke all on function public.mission_ranking(text,uuid,text) from public,anon,authenticated;
grant execute on function public.mission_ranking(text,uuid,text) to service_role;
