import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {it,expect} from 'vitest';
it('applies the SQL Editor bundle transactionally and records every migration',async()=>{
 const db=new PGlite();
 try{
  await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;");
  const sql=await readFile(new URL('../supabase/setup.sql',import.meta.url),'utf8');
  await db.exec(sql.replace('alter publication supabase_realtime add table public.classroom_updates;',''));
  const {rows}=await db.query<{version:string}>('select version from supabase_migrations.schema_migrations order by version');
  expect(rows.map(r=>r.version)).toEqual(['20261114000000','20261114000100','20261114000200','20261114000300']);
  const check=await db.query<{def:string}>("select pg_get_constraintdef(oid) as def from pg_constraint where conname='classrooms_mission_slug_check'");
  expect(check.rows).toHaveLength(1);
  for(const slug of ['los-angeles','hilo','new-york-city']) expect(check.rows[0].def).toContain(slug);
  expect((await db.query("select tablename from pg_tables where schemaname='public' and tablename in ('profiles','attempts','classrooms','classroom_members')")).rows).toHaveLength(4);
 }finally{await db.close()}
},30000);
