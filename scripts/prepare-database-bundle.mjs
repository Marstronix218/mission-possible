import {readdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const dir=new URL('../supabase/migrations/',import.meta.url);
let sql=`-- Mission: Possible: schema setup for the verified empty project.\n-- Run once in the Supabase SQL Editor. No credentials are included.\nbegin;\nselect pg_advisory_xact_lock(hashtextextended('mission-possible:migrations',0));\ncreate schema if not exists supabase_migrations;\ncreate table if not exists supabase_migrations.schema_migrations(version text primary key,statements text[],name text);\ncreate table if not exists supabase_migrations.mission_checksums(version text primary key,sha256 text not null);\nrevoke all on schema supabase_migrations from public,anon,authenticated;\n`;
for(const name of (await readdir(dir)).filter(n=>/^\d+_.+\.sql$/.test(n)).sort()){
 const body=await readFile(new URL(name,dir),'utf8');const version=name.split('_')[0];const hash=createHash('sha256').update(body).digest('hex');
 sql+='\n-- '+name+'\n'+body+'\n';
 sql+=`insert into supabase_migrations.schema_migrations(version,name) values('${version}','${name.slice(version.length+1,-4)}');\n`;
 sql+=`insert into supabase_migrations.mission_checksums values('${version}','${hash}');\n`;
}
sql+="notify pgrst, 'reload schema';\ncommit;\n";
await writeFile(new URL('../supabase/setup.sql',import.meta.url),sql);
console.log('Generated supabase/setup.sql from the versioned migrations.');
