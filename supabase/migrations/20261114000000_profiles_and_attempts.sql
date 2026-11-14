-- Phase 1 solo-play persistence. Classroom ownership is added in Phase 3.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'student' check (role in ('student', 'teacher')),
  nickname text check (nickname is null or (length(btrim(nickname)) between 1 and 32)),
  created_at timestamptz not null default now()
);

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  mission_slug text not null check (mission_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  design jsonb not null check (jsonb_typeof(design) = 'object'),
  score_total numeric not null check (score_total between 0 and 100),
  score_breakdown jsonb not null check (jsonb_typeof(score_breakdown) = 'object'),
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  engine_version text not null check (length(btrim(engine_version)) between 1 and 64),
  created_at timestamptz not null default now()
);

create index attempts_user_history_idx on public.attempts(user_id, created_at desc);
create index attempts_mission_score_idx
  on public.attempts(mission_slug, engine_version, score_total desc, created_at asc);

alter table public.profiles enable row level security;
alter table public.attempts enable row level security;

-- Avoid Supabase's permissive default table grants. Student JWTs (including
-- anonymous-auth users) can edit only their own nickname, never their role.
revoke all on public.profiles, public.attempts from anon, authenticated;
grant select on public.profiles, public.attempts to authenticated;
grant update (nickname) on public.profiles to authenticated;
grant all on public.profiles, public.attempts to service_role;

create policy profiles_select_own on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles
  for update to authenticated using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
create policy attempts_select_own on public.attempts
  for select to authenticated using ((select auth.uid()) = user_id);
-- No INSERT/UPDATE/DELETE policy on attempts: only trusted server code writes
-- simulation results, using the service role after recomputing the score.

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Never trust client-controlled metadata for roles, or copy email/name/PII.
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
