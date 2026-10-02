// Applies ONE reviewed golf migration to SPORTS (tkmlnhmylqnttmnsnief) through the Supabase Management API.
// The access token is supplied by the owner at run time (SUPABASE_ACCESS_TOKEN); it is never stored or printed.
// Usage: SUPABASE_ACCESS_TOKEN=... node scripts/apply-migration.mjs supabase/migrations/<file>.sql
import fs from 'node:fs/promises';import path from 'node:path';
const REF='tkmlnhmylqnttmnsnief',file=process.argv[2],token=process.env.SUPABASE_ACCESS_TOKEN;
if(!file||!/^supabase\/migrations\/\d{14}_golf_[a-z0-9_]+\.sql$/.test(file.replace(/\\/g,'/')))throw Error('usage: node scripts/apply-migration.mjs supabase/migrations/<version>_golf_<name>.sql');
if(!token)throw Error('SUPABASE_ACCESS_TOKEN is required (owner-supplied; not stored)');
const sql=await fs.readFile(file,'utf8'),base=path.basename(file,'.sql'),[version,...rest]=base.split('_'),name=rest.join('_');
const q=async query=>{const r=await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`,{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({query})});const t=await r.text();if(!r.ok)throw Error(`management_api_${r.status}: ${t.slice(0,300)}`);return t?JSON.parse(t):null;};
const done=await q(`select 1 from supabase_migrations.schema_migrations where version='${version}'`).catch(()=>[]);
if(done?.length){console.log(`already applied: ${version}`);process.exit(0);}
await q(sql);
await q(`insert into supabase_migrations.schema_migrations(version,name,statements) values ('${version}','${name.replace(/'/g,"''")}',array[$golf$${sql}$golf$]) on conflict (version) do nothing`).catch(e=>console.warn('ledger insert skipped:',e.message));
const check=await q(`select table_name from information_schema.tables where table_schema='public' and table_name like 'golf_live_snapshot%' order by 1`);
console.log(JSON.stringify({applied:version,name,tables:check}));
