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
// Approved Phase 2 runtime: only golf-ingest is scheduled; bindings are golf-scoped resources only.
const allowed={'golf-ingest':{crons:['* * * * *'],kv:['STATE'],r2:['RAW:golf-source','PUBLIC:golf-public']},'golf-api':{crons:null,kv:[],r2:['PUBLIC:golf-public']},'golf-news':{crons:['*/15 * * * *'],kv:['STATE'],r2:['PUBLIC:golf-public','PRIVATE:golf-news-private']}};
for(const name of Object.keys(allowed)){const config=JSON.parse(await fs.readFile('workers/'+name+'/wrangler.jsonc','utf8')),a=allowed[name];assert(config.workers_dev===false);assert(config.preview_urls===false);assert.deepEqual(config.triggers?.crons??null,a.crons,name+' cron');assert.deepEqual((config.kv_namespaces||[]).map(k=>k.binding),a.kv,name+' kv');assert.deepEqual((config.r2_buckets||[]).map(b=>b.binding+':'+b.bucket_name).sort(),[...a.r2].sort(),name+' r2');}
try{const workflows=await walk('.github/workflows');assert(!workflows.length);}catch(e){if(e.code!=='ENOENT')throw e;}
console.log('Guard passed: source rights, graph isolation/RLS, browser boundaries, no checkout, no deployment automation.');
