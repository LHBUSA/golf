import {store} from '../../shared/store.js';
import {adminAllowed} from '../../shared/admin.js';
import {SourceBlockedError} from '../../shared/http.js';
import {ingestWikidata} from './wikidata.js';
import {runCatalog,runSchedule,runResults,loadItems} from './lanes.js';
import {runMedia} from './media.js';
import {runEspn,discover as espnDiscover} from './espn-lane.js';
import {runEspnStats} from './espn-stats.js';
import {runWeather} from './weather.js';
import {runLive,backfillSnapshots,reconcileSnapshots} from './live.js';
import {runVideo} from './video.js';
import {runHeadshots} from './headshots.js';
import {writePlan} from './writer.js';
import {buildProjection} from '../../shared/projection.js';
const json=(b,s=200)=>Response.json(b,{status:s,headers:{'cache-control':'no-store'}});
// lane -> approved source, cadence. Each source is independently disable-able in golf_sources.
export const LANES={catalog:{source:'wikidata',cadenceMs:86400000},schedule:{source:'wikipedia',cadenceMs:6*3600000},results:{source:'wikipedia',cadenceMs:15*60000},media:{source:'commons',cadenceMs:86400000},espn:{source:'espn',cadenceMs:10*60000},live:{source:'espn-live',cadenceMs:9*60000},weather:{source:'nws',cadenceMs:3*3600000},video:{source:'youtube',cadenceMs:30*60000},headshots:{source:'espn',cadenceMs:6*3600000}};
const LANE_KEY='lanes:v1';
async function laneState(env){try{return JSON.parse(await env.STATE.get(LANE_KEY)||'{}');}catch{return {};}}
async function mediaSubjects(db){
 const rows=async(t,s,f)=>{const out=[];for(let o=0;;o+=1000){const p=await db(t,`select=${s}${f}&order=id&limit=1000&offset=${o}`);out.push(...p);if(p.length<1000)return out;}};
 const ids=await rows('golf_player_identities','player_id,provider_id,image:evidence->>image','&source_id=eq.wikidata');
 const layouts=await rows('golf_course_layouts','course_id,qid:specifications->>wikidata_id,image:specifications->>image','&specifications->>image=not.is.null');
 return [...layouts.map(l=>({kind:'course',entity_id:l.course_id,qid:l.qid,file:l.image})),...ids.map(i=>({kind:'player',entity_id:i.player_id,qid:i.provider_id,file:i.image}))].filter(s=>s.file);
}
export async function runLane(lane,env,db,opts={}){
 const cfg=['espn-discover','espn-stats'].includes(lane)?LANES.espn:['live-backfill','live-reconcile'].includes(lane)?LANES.live:LANES[lane];if(!cfg)throw Error('unknown_lane');
 const src=(await db('golf_sources','id=eq.'+cfg.source))[0];
 if(src?.verdict!=='APPROVED'||src.automated_access!==true)return {lane,status:'source_disabled'};
 if(!await db('rpc/golf_claim_source','',{method:'POST',body:JSON.stringify({p_source:cfg.source})}))return {lane,status:'source_blocked_or_busy'};
 const started=new Date().toISOString();
 try{
  let result;
  if(lane==='catalog')result=await runCatalog(env,db);
  else if(lane==='schedule')result=await runSchedule(env,db);
  else if(lane==='results')result=await runResults(env,db,{budgetMs:opts.budgetMs||200000,limit:opts.limit||40});
  else if(lane==='espn')result=await runEspn(env,db,{budgetMs:opts.budgetMs||200000,limit:opts.limit||25,force:opts.events||null});
  else if(lane==='espn-discover')result=await espnDiscover(env,{leagues:opts.leagues,seasons:opts.seasons});
  else if(lane==='weather')result=await runWeather(env,db);
  else if(lane==='headshots')result=await runHeadshots(env,db,{limit:opts.limit||250});
  else if(lane==='video')result=await runVideo(env,db);
  else if(lane==='live-reconcile')result=await reconcileSnapshots(env,db,{limit:opts.limit||400});
  else if(lane==='live-backfill')result=await backfillSnapshots(env,db,{limit:opts.limit||200});
  else if(lane==='live')result=await runLive(env,db,{force:Boolean(opts.force)});
  else if(lane==='espn-stats')result=await runEspnStats(env,db,{league:opts.leagues?.[0]||'pga',season:opts.seasons?.[0]||new Date().getUTCFullYear(),limit:opts.limit||250});
  else {const {rows,out}=await runMedia(env,db,await mediaSubjects(db),{limit:opts.limit||40});const c=rows.length?await writePlan(db,rows):{inserted:0,updated:0,unchanged:0};result={...out,...c};}
  const ls=await laneState(env);ls[lane]={last_ok:Date.now(),started,result};await env.STATE.put(LANE_KEY,JSON.stringify(ls));
  const prev=(await db('golf_source_state','source_id=eq.'+cfg.source))[0]||{};
  await db('golf_source_state','source_id=eq.'+cfg.source,{method:'PATCH',headers:{prefer:'return=minimal'},body:JSON.stringify({status:'ok',lease_until:null,last_parse:new Date().toISOString(),last_write:(result.inserted||result.updated)?new Date().toISOString():prev.last_write,records_processed:(result.rows??result.read??0),records_inserted:result.inserted||0,records_updated:result.updated||0,records_held:result.held||0,identity_conflicts:result.identity_conflicts||0,last_error:null})});
  if(result.inserted||result.updated)await env.STATE.put('projection:dirty','1');
  return {status:'ok',...result};
 }catch(error){
  const prev=(await db('golf_source_state','source_id=eq.'+cfg.source))[0]||{};
  await db('golf_source_state','source_id=eq.'+cfg.source,{method:'PATCH',headers:{prefer:'return=minimal'},body:JSON.stringify({status:error instanceof SourceBlockedError?'blocked':'error',lease_until:null,last_error:String(error.message).slice(0,500),source_errors:(prev.source_errors||0)+1})});
  return {lane,status:error instanceof SourceBlockedError?'blocked':'error',error:String(error.message).slice(0,500)};
 }
}
// One projection at a time: a run holds a 20-minute KV lease so cron ticks never stack heavy reads on SPORTS.
export async function project(env,db){
 const cur=JSON.parse(await env.STATE.get('projection:lease')||'null');if(cur&&cur.until>Date.now())return {status:'projection_running',since:cur.started};
 const started=new Date().toISOString(),token=crypto.randomUUID();await env.STATE.put('projection:lease',JSON.stringify({token,started,until:Date.now()+20*60000}),{expirationTtl:1200});
 try{const p=await buildProjection(db,env);await env.STATE.put('projection:last',started);await env.STATE.delete('projection:dirty');return p.summary;}
 finally{const c=JSON.parse(await env.STATE.get('projection:lease')||'null');if(c?.token===token)await env.STATE.delete('projection:lease');}
}
async function tick(env){
 const db=store(env);if(!db||!env.RAW||!env.STATE||!env.PUBLIC)return {status:'unconfigured'};
 const ls=await laneState(env),now=Date.now(),due=l=>!ls[l]?.last_ok||now-ls[l].last_ok>=LANES[l].cadenceMs;
 // Live scoring first: it is the most time-sensitive lane and holds its own lease.
 const live=await runLane('live',env,db).catch(e=>({status:'error',error:e.message}));
 const lane=due('catalog')?'catalog':due('schedule')?'schedule':due('weather')?'weather':due('video')?'video':due('headshots')?'headshots':due('media')?'media':'results';
 const result=await runLane(lane,env,db);
 // ESPN has its own lease, so it runs every tick alongside the most-due lane.
 const espn=await runLane('espn',env,db,{budgetMs:180000}).catch(e=>({status:'error',error:e.message}));
 // Season-stat backfill rides the same ESPN lease after the event lane: always when no event is due, and on
 // every third tick otherwise (one worker, sequential, no competing loop).
 let stats=null;if(espn?.status==='ok'&&(!espn.due||new Date().getUTCMinutes()%30<10)){const q=JSON.parse(await env.STATE.get('espn:stats:queue')||'["pga:2026","pga:2025"]');if(q.length){const [lg,yr]=q[0].split(':');stats=await runLane('espn-stats',env,db,{leagues:[lg],seasons:[Number(yr)],limit:150}).catch(e=>({status:'error',error:e.message}));if(stats?.status==='complete'){q.shift();await env.STATE.put('espn:stats:queue',JSON.stringify(q));}}}
 // Rebuild when a lane wrote since the last projection (KV flag or durable source-state timestamps).
 const last=await env.STATE.get('projection:last')||'',writes=(await db('golf_source_state','select=last_write')).map(r=>r.last_write||'').sort().at(-1)||'';
 let projection=null;if(await env.STATE.get('projection:dirty')||Date.parse(writes)>Date.parse(last||0))projection=await project(env,db);
 return {live,lane,result,espn,stats,projection};
}
export default {
 async fetch(request,env={}){
  const url=new URL(request.url),path=url.pathname,db=store(env);
  if(path==='/health'){
   if(!db||!env.STATE)return json({mode:'unconfigured'},503);
   const [states,sources,ls,items]=await Promise.all([db('golf_source_state','select=*'),db('golf_sources','select=id,verdict,automated_access'),laneState(env),loadItems(env)]);
   const tally={};for(const i of Object.values(items))tally[i.status]=(tally[i.status]||0)+1;
   return json({mode:'production_ingestion',publication_enabled:false,scoring_feed:'espn-live',sources:states.map(s=>({...s,verdict:sources.find(x=>x.id===s.source_id)?.verdict,automated_access:sources.find(x=>x.id===s.source_id)?.automated_access,source_age_seconds:s.last_write?Math.floor((Date.now()-Date.parse(s.last_write))/1000):null})),lanes:Object.fromEntries(Object.entries(LANES).map(([k,v])=>[k,{source:v.source,cadence_seconds:v.cadenceMs/1000,last_ok:ls[k]?.last_ok?new Date(ls[k].last_ok).toISOString():null,next_run_after:ls[k]?.last_ok?new Date(ls[k].last_ok+v.cadenceMs).toISOString():'due',last_result:ls[k]?.result||null}])),items:tally});
  }
  if(request.method!=='POST')return json({error:'not_found'},404);
  if(!await adminAllowed(request,env))return json({error:'unauthorized'},401);
  if(!db||!env.RAW)return json({error:'infrastructure_unavailable'},503);
  if(path==='/admin/bootstrap'){
   const source=(await db('golf_sources','id=eq.wikidata'))[0];
   if(source?.verdict!=='APPROVED'||source.automated_access!==true)return json({error:'source_disabled'},409);
   if(!await db('rpc/golf_claim_source','',{method:'POST',body:JSON.stringify({p_source:'wikidata'})}))return json({error:'source_blocked_or_busy'},409);
   try{return json(await ingestWikidata(env,db));}
   catch(error){await db('golf_source_state','source_id=eq.wikidata',{method:'PATCH',body:JSON.stringify({status:error instanceof SourceBlockedError?'blocked':'error',lease_until:null,last_error:error.message})});return json({error:'ingestion_failed',reason:error.message},502);}
  }
  if(path==='/admin/run'){const lane=url.searchParams.get('lane');if(lane==='project')return json(await project(env,db));if(!LANES[lane]&&!['espn-discover','espn-stats','live-backfill','live-reconcile'].includes(lane))return json({error:'unknown_lane'},400);const list=k=>(url.searchParams.get(k)||'').split(',').filter(Boolean);return json(await runLane(lane,env,db,{limit:Number(url.searchParams.get('limit'))||undefined,budgetMs:Number(url.searchParams.get('budget'))||undefined,leagues:list('leagues'),seasons:list('seasons').map(Number),events:list('events').length?list('events'):undefined}));}
  if(path==='/admin/tick')return json(await tick(env));
  // Derivatives are produced offline from the archived original and stored under its content hash.
  if(path==='/admin/media-derivative'){
   const key=url.searchParams.get('key')||'';if(!/^media\/[0-9a-f]{64}\/(160|320|640|960)\.(avif|webp|jpg)$/.test(key))return json({error:'invalid_key'},400);
   const type=key.endsWith('.avif')?'image/avif':key.endsWith('.jpg')?'image/jpeg':'image/webp',body=await request.arrayBuffer();if(body.byteLength>2000000||!body.byteLength)return json({error:'invalid_body'},400);
   await env.PUBLIC.put(key,body,{httpMetadata:{contentType:type,cacheControl:'public, max-age=31536000, immutable'}});return json({stored:key,bytes:body.byteLength});
  }
  return json({error:'not_found'},404);
 },
 async scheduled(event,env,ctx){ctx.waitUntil(tick(env).then(r=>console.log(JSON.stringify({worker:'golf-ingest',cron:event.cron,...r}))).catch(e=>console.error(JSON.stringify({worker:'golf-ingest',error:e.message}))));}
};
