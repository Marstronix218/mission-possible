begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

insert into auth.users (id, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', '{"role":"teacher","email":"must-not-copy@example.com"}'),
  ('22222222-2222-4222-8222-222222222222', '{}');
select is((select count(*)::integer from public.profiles), 2, 'Auth users receive profiles');
select is((select role from public.profiles where id = '11111111-1111-4111-8111-111111111111'), 'student', 'Client metadata cannot grant teacher privileges');
select is((select nickname from public.profiles where id = '11111111-1111-4111-8111-111111111111'), null, 'No personal data copied into nickname');
select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'Profiles have RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.attempts'::regclass), 'Attempts have RLS');

set local role service_role;
insert into public.attempts (id, user_id, mission_slug, design, score_total, score_breakdown, result, engine_version) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'los-angeles', '{}', 82, '{}', '{}', '1.0.0'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222', 'houston', '{}', 64, '{}', '{}', '1.0.0');
select is((select count(*)::integer from public.attempts), 2, 'Service role can persist verified attempts');
select throws_ok($$insert into public.attempts (user_id, mission_slug, design, score_total, score_breakdown, result, engine_version) values ('11111111-1111-4111-8111-111111111111', 'los-angeles', '{}', 101, '{}', '{}', '1.0.0')$$, '23514', null, 'Scores above 100 rejected');
select throws_ok($$insert into public.attempts (user_id, mission_slug, design, score_total, score_breakdown, result, engine_version) values ('11111111-1111-4111-8111-111111111111', 'los-angeles', '{}', -1, '{}', '{}', '1.0.0')$$, '23514', null, 'Negative scores rejected');
select throws_ok($$insert into public.attempts (user_id, mission_slug, design, score_total, score_breakdown, result, engine_version) values ('11111111-1111-4111-8111-111111111111', 'los-angeles', '[]', 82, '{}', '{}', '1.0.0')$$, '23514', null, 'Array design rejected');

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select is((select count(*)::integer from public.profiles), 1, 'Only own profile visible');
select is((select count(*)::integer from public.attempts), 1, 'Only own attempts visible');
select lives_ok($$update public.profiles set nickname = 'OrbitFox' where id = '11111111-1111-4111-8111-111111111111'$$, 'Owner may update nickname');
select is((select nickname from public.profiles where id = '11111111-1111-4111-8111-111111111111'), 'OrbitFox', 'Nickname update persists');
select throws_ok($$update public.profiles set role = 'teacher' where id = '11111111-1111-4111-8111-111111111111'$$, '42501', null, 'Owner cannot escalate role');
select throws_ok($$insert into public.attempts (user_id, mission_slug, design, score_total, score_breakdown, result, engine_version) values ('11111111-1111-4111-8111-111111111111', 'los-angeles', '{}', 100, '{}', '{}', '1.0.0')$$, '42501', null, 'Owner cannot submit forged attempt directly');
select throws_ok($$update public.attempts set score_total = 100$$, '42501', null, 'Owner cannot alter scores');
select throws_ok($$delete from public.attempts$$, '42501', null, 'Owner cannot delete attempts');

set local role anon;
select throws_ok($$select * from public.profiles$$, '42501', null, 'Unauthenticated users cannot read profiles');
select throws_ok($$select * from public.attempts$$, '42501', null, 'Unauthenticated users cannot read attempts');
select * from finish();
rollback;
