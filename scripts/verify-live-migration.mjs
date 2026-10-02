// Verifies the applied live-snapshot migration against its intent (schema, indexes, RLS, grants) and its
// behaviour (append-only, duplicate-safe). Read checks use the Management API with an owner-supplied token;
// behaviour checks use the service role. Nothing is inserted except re-sending an existing header.
// Usage: SUPABASE_ACCESS_TOKEN=... node scripts/verify-live-migration.mjs
import {store} from '../workers/shared/store.js';import {sportsEnv} from './ops.mjs';
const REF='tkmlnhmylqnttmnsnief',token=process.env.SUPABASE_ACCESS_TOKEN;if(!token)throw Error('SUPABASE_ACCESS_TOKEN required');
const q=async query=>{const r=await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`,{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({query})});if(!r.ok)throw Error('mgmt_'+r.status+' '+(await r.text()).slice(0,200));return r.json();};
const T=['golf_live_snapshots','golf_live_snapshot_rows'],res={checks:[]},ok=(name,pass,detail)=>res.checks.push({name,pass:Boolean(pass),detail});
const cols=await q(`select table_name,column_name,data_type,is_nullable from information_schema.columns where table_schema='public' and table_name in ('${T.join("','")}') order by table_name,ordinal_position`);
const want={golf_live_snapshots:['id','edition_id','captured_at','source_updated_at','status','state','round','leaderboard_hash','players','capture_id','parser_version'],golf_live_snapshot_rows:['snapshot_id','espn_id','player_id','position','tied','position_display','score_to_par','today','thru','round','status']};
for(const t of T)ok(`${t} columns`,JSON.stringify(cols.filter(c=>c.table_name===t).map(c=>c.column_name))===JSON.stringify(want[t]),cols.filter(c=>c.table_name===t).map(c=>c.column_name));
const idx=await q(`select tablename,indexname,indexdef from pg_indexes where schemaname='public' and tablename in ('${T.join("','")}')`);
for(const n of ['golf_live_snapshots_pkey','golf_live_snapshots_edition_id_captured_at_key','golf_live_snapshots_edition_time','golf_live_snapshot_rows_pkey','golf_live_snapshot_rows_player'])ok('index '+n,idx.some(i=>i.indexname===n),idx.map(i=>i.indexname));
const rls=await q(`select relname,relrowsecurity from pg_class where relname in ('${T.join("','")}')`);for(const t of T)ok(t+' RLS enabled',rls.find(r=>r.relname===t)?.relrowsecurity===true,rls);
const gr=await q(`select table_name,grantee,privilege_type from information_schema.role_table_grants where table_schema='public' and table_name in ('${T.join("','")}') and grantee in ('anon','authenticated','service_role','public')`);
for(const t of T){const sr=gr.filter(g=>g.table_name===t&&g.grantee==='service_role').map(g=>g.privilege_type).sort();ok(t+' service_role = SELECT, INSERT only',JSON.stringify(sr)===JSON.stringify(['INSERT','SELECT']),sr);ok(t+' no anon/authenticated grants',!gr.some(g=>g.table_name===t&&['anon','authenticated','public'].includes(g.grantee)),gr.filter(g=>g.table_name===t&&g.grantee!=='service_role'));}
const fn=await q(`select grantee,privilege_type from information_schema.routine_privileges where routine_name='golf_prune_live_snapshots' and grantee in ('anon','authenticated','service_role')`);ok('prune function not executable by API roles',fn.length===0,fn);
// Behaviour with the service role
const env=await sportsEnv(),db=store(env);const h=(await db('golf_live_snapshots','select=*&order=captured_at.desc&limit=1'))[0];
if(h){const raw=async(method,qs,body,prefer)=>{const r=await fetch(`${env.SPORTS_URL}/rest/v1/golf_live_snapshots${qs}`,{method,headers:{apikey:env.SPORTS_KEY,authorization:'Bearer '+env.SPORTS_KEY,'content-type':'application/json',...(prefer?{prefer}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,text:(await r.text()).slice(0,160)};};
 const dup=await raw('POST','?on_conflict=edition_id,captured_at',h,'resolution=ignore-duplicates,return=representation');ok('duplicate header ignored (no new row)',dup.status<300&&dup.text.trim()==='[]',dup);
 const up=await raw('PATCH',`?id=eq.${h.id}`,{status:'TAMPERED'});ok('UPDATE rejected (append-only)',up.status>=400,up);
 const del=await raw('DELETE',`?id=eq.${h.id}`);ok('DELETE rejected (append-only)',del.status>=400,del);
 const still=(await db('golf_live_snapshots',`select=status&id=eq.${h.id}`))[0];ok('row unchanged after attempts',still?.status===h.status,still);}
else ok('behaviour checks need at least one snapshot (run live-backfill first)',false,null);
res.pass=res.checks.every(c=>c.pass);console.log(JSON.stringify(res,null,1));
