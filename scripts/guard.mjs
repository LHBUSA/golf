import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const sources=JSON.parse(await fs.readFile('data/source-registry/sources.json','utf8')).sources;
assert(sources.find(s=>s.id==='owgr').verdict==='REJECT');
assert(sources.filter(s=>s.automated_access!=='disabled').every(s=>s.verdict==='APPROVED'));
const schema=JSON.parse(await fs.readFile('data/schema/tables.json','utf8'));
const sql=await fs.readFile('supabase/migrations/20260930150300_golf_foundation_draft.sql','utf8');
for(const table of schema.tables){assert(table.startsWith('golf_'));assert(sql.includes('create table public.'+table+' ('));assert(sql.includes('alter table public.'+table+' enable row level security'));assert(sql.includes('revoke all on table public.'+table+' from public, anon, authenticated'));}
assert(!/create policy|security definer/i.test(sql));assert(sql.includes('app.golf_target_project'));assert(sql.includes('pbe_sport_entitlements'));
async function walk(dir){const paths=[];for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=dir+'/'+e.name;paths.push(...(e.isDirectory()?await walk(p):[p]));}return paths;}
for(const path of await walk('src')){const text=await fs.readFile(path,'utf8');assert(!/service_role|supabase\.co|buy\.stripe\.com|Golf Pro \$/i.test(text),path);assert(!/fetch\s*\(\s*['"]https?:/i.test(text),path);}
for(const name of ['golf-api','golf-ingest','golf-news']){const config=JSON.parse(await fs.readFile('workers/'+name+'/wrangler.jsonc','utf8'));assert(config.workers_dev===false);assert(config.preview_urls===false);assert(!config.triggers);assert(!config.kv_namespaces);assert(!config.r2_buckets);}
try{const workflows=await walk('.github/workflows');assert(!workflows.length);}catch(e){if(e.code!=='ENOENT')throw e;}
console.log('Guard passed: source rights, graph isolation/RLS, browser boundaries, no checkout, no deployment automation.');
