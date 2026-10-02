// Live scoring lane: current-event snapshots from the approved ESPN core API (sports.core.api.espn.com only).
// Every snapshot is archived (provenance) and published as observed state with its fetch time. Nothing is
// inferred: positions, thru, holes and tee times are exactly what ESPN reports; missing stays null.
import {CORE,LEAGUES,getJSON,pool,idOf,archive,UpstreamBusy} from './espn.js';
import {toParNum,LIVE_VERSION,liveState} from '../../shared/live.js';
import {stableId} from '../../shared/store.js';
import {digest} from '../../shared/http.js';
export const LIVE_PARSER='espn-golf-live/1.0.0';
const DAY=86400000;
const putJSON=(b,k,v,cache)=>b.put(k,JSON.stringify(v),{httpMetadata:{contentType:'application/json',...(cache?{cacheControl:cache}:{})}});
const getJ=async(b,k)=>{const o=await b.get(k);return o?JSON.parse(await o.text()):null;};
const STATUS={STATUS_CUT:'cut',STATUS_WITHDRAWN:'withdrawn',STATUS_WD:'withdrawn',STATUS_DISQUALIFIED:'disqualified',STATUS_DQ:'disqualified',STATUS_DNS:'dns',STATUS_DID_NOT_START:'dns'};
// Pure normalization of one competitor (status + linescores). Exported for tests.
export function normalizeCompetitor(id,st,ls,{name=null,slug=null,player_id=null}={}){
 const period=Number(st?.period)||null,thru=Number.isInteger(st?.thru)?st.thru:null;
 const rounds=(ls?.items||[]).map(r=>{const holes=(r.linescores||[]).filter(h=>Number.isFinite(h.value)).map(h=>({hole:Number(h.period),strokes:Math.round(h.value),par:Number.isFinite(h.par)?h.par:null,type:h.scoreType?.name||null}));
  const has=Number.isFinite(r.value);const rn=Number(r.period);
  const complete=has&&(holes.length>=18||(period!==null&&rn<period)||(rn===period&&thru===18));
  return {round:rn,strokes:has?Math.round(r.value):null,to_par:has?toParNum(r.displayValue):null,complete,tee_time:r.teeTime||null,start_tee:Number(r.startTee)||null,holes_posted:holes.length,holes:rn===period?holes:undefined};}).sort((a,b)=>a.round-b.round);
 const played=rounds.filter(r=>r.strokes!==null);
 const total=played.length&&played.every(r=>r.to_par!==null)?played.reduce((s,r)=>s+r.to_par,0):null;
 const cur=rounds.find(r=>r.round===period);
 const started=thru!==null&&thru>0;
 const pos=st?.position;
 return {espn_id:String(id),player_id,slug,name,status:STATUS[st?.type?.name]||'active',status_name:st?.type?.name||null,
  position_display:pos?.displayName||null,position_num:Number(pos?.id)||null,tied:pos?typeof pos.isTie==='boolean'?pos.isTie:null:null,
  total_to_par:total,today_to_par:started&&cur?cur.to_par:null,today_strokes:started&&cur?cur.strokes:null,
  current_round:period,thru,hole:Number.isInteger(st?.hole)?st.hole:null,start_hole:Number(st?.startHole)||null,tee_time:st?.teeTime||cur?.tee_time||null,playoff:st?.playoff??null,
  rounds:rounds.map(({holes,...r})=>r),holes:cur?.holes?.length?cur.holes:null};
}
async function names(env,league,ids,db){
 const out=new Map();if(!ids.length)return out;
 for(let i=0;i<ids.length;i+=100){const rows=await db('golf_player_identities',`select=provider_id,player_id,golf_players(slug,full_name)&source_id=eq.espn&provider_id=in.(${ids.slice(i,i+100).join(',')})`);for(const r of rows)if(r.golf_players)out.set(String(r.provider_id),{slug:r.golf_players.slug,name:r.golf_players.full_name,player_id:r.player_id});}
 // Unmapped athletes (identity held or new): display ESPN's name without a profile link.
 const cache=JSON.parse(await env.STATE.get('espn:names:v1')||'{}');const missing=ids.filter(id=>!out.has(id)&&!cache[id]);
 await pool(2,missing.slice(0,40),async id=>{try{const a=await getJSON(`${CORE}/leagues/${league}/athletes/${id}`);cache[id]=a.displayName||a.fullName||null;}catch(e){if(e instanceof UpstreamBusy)throw e;}});
 if(missing.length)await env.STATE.put('espn:names:v1',JSON.stringify(cache));
 for(const id of ids)if(!out.has(id)&&cache[id])out.set(id,{slug:null,name:cache[id]});
 return out;
}
export async function snapshotEvent(env,db,ed,{now=new Date()}={}){
 const league=ed.espn.league,eventId=ed.espn.event_id,base=`${CORE}/leagues/${league}/events/${eventId}/competitions/${eventId}`;
 const cs=await getJSON(`${base}/status`);
 const state=cs?.type?.state||null;
 const list=await getJSON(`${base}/competitors?limit=400`);const ids=(list.items||[]).map(i=>idOf(i.$ref)).filter(Boolean);
 const rows=await pool(3,ids,async id=>{const [st,ls]=await Promise.all([getJSON(`${base}/competitors/${id}/status`).catch(e=>{if(e instanceof UpstreamBusy)throw e;return null;}),state==='pre'?Promise.resolve(null):getJSON(`${base}/competitors/${id}/linescores`).catch(e=>{if(e instanceof UpstreamBusy)throw e;return null;})]);return {id,st,ls};});
 const nm=await names(env,league,ids,db);
 const players=rows.map(r=>normalizeCompetitor(r.id,r.st,r.ls,nm.get(String(r.id))||{}));
 const fetched_at=new Date().toISOString();
 const snap={version:LIVE_VERSION,parser:LIVE_PARSER,source:'ESPN Golf core API',league,tour:LEAGUES[league]?.label||league,espn_event_id:String(eventId),
  edition:{id:ed.id,slug:ed.slug,name:ed.name,starts_on:ed.starts_on,ends_on:ed.ends_on,division:ed.division,is_major:Boolean(ed.is_major)},
  course:ed.course?{slug:ed.course.slug,name:ed.course.name,city:ed.espn.course?.city||null,state:ed.espn.course?.state||null,country:ed.espn.course?.country||null}:null,
  event_status:{name:cs?.type?.name||null,state,completed:Boolean(cs?.type?.completed),detail:cs?.type?.detail||null,period:Number(cs?.period)||null},
  // ESPN core exposes no update timestamp for golf scoring; freshness is measured from our fetch.
  source_updated_at:null,fetched_at,holes_available:players.some(p=>p.holes?.length),players};
 const cap=await archive(env,db,`${base}/competitors?limit=400#live`,{fetched_at,status:cs,competitors:rows});
 snap.capture_id=cap.id;
 return snap;
}
// Compact leaderboard fingerprint for movement history (top 40 by position).
export function movementPoint(s){return {t:s.fetched_at,round:s.event_status.period,status:s.event_status.name,top:s.players.filter(p=>p.position_num&&p.status==='active').sort((a,b)=>a.position_num-b.position_num).slice(0,40).map(p=>({slug:p.slug,name:p.name,pos:p.position_num,tied:p.tied,to_par:p.total_to_par,thru:p.thru}))};}
export async function runLive(env,db,{now=new Date(),force=false}={}){
 const ix=await getJ(env.PUBLIC,'projection/v2/index.json');if(!ix)return {lane:'live',status:'projection_unavailable'};
 const today=now.toISOString().slice(0,10),t=now.getTime();
 const win=ix.editions.filter(e=>e.starts_on&&e.ends_on&&Date.parse(e.starts_on)<=t+DAY&&Date.parse(e.ends_on)+2*DAY>=t&&e.status!=='cancelled');
 const out={lane:'live',window:win.length,snapshots:0,skipped:[],events:[]};
 const current=[];
 for(const e of win){
  const ed=await getJ(env.PUBLIC,'projection/v2/editions/'+e.slug+'.json');if(!ed?.espn?.event_id||!ed.espn.league){out.skipped.push({edition:e.slug,reason:'no_espn_event'});continue;}
  const key='live/v1/events/'+ed.slug+'.json',prev=await getJ(env.PUBLIC,key);
  // Finished events keep their final snapshot; pre-round events refresh hourly (tee times only).
  if(prev&&!force){const ps=liveState(prev,t);if(ps.state==='final'&&prev.event_status?.completed){current.push(prev);out.skipped.push({edition:ed.slug,reason:'final_kept'});continue;}
   if(prev.event_status?.state==='pre'&&t-Date.parse(prev.fetched_at)<55*60000){current.push(prev);out.skipped.push({edition:ed.slug,reason:'pre_recent'});continue;}}
  const snap=await snapshotEvent(env,db,{...ed,slug:ed.slug},{now});
  await putJSON(env.PUBLIC,key,snap);out.snapshots++;current.push(snap);
  // History: bounded movement series; full snapshots only when the board changes.
  const mk='live/v1/movement/'+ed.slug+'.json',mv=await getJ(env.PUBLIC,mk)||{edition:ed.slug,points:[]};const pt=movementPoint(snap);
  const sig=JSON.stringify(pt.top.map(x=>[x.slug||x.name,x.pos,x.to_par,x.thru]));
  try{const ps=await persistSnapshot(env,db,snap);out.db=(out.db||[]);out.db.push(ps.stored?'stored':ps.reason);}catch(e){out.db_error=String(e.message).slice(0,160);}
  if(JSON.stringify((mv.points.at(-1)?.top||[]).map(x=>[x.slug||x.name,x.pos,x.to_par,x.thru]))!==sig){mv.points.push(pt);mv.points=mv.points.slice(-400);await putJSON(env.PUBLIC,mk,mv);await putJSON(env.PRIVATE||env.RAW,`golf/live/${ed.slug}/${snap.fetched_at}.json`,snap);}
  // When ESPN reports the event final, hand the event to the ingest lane immediately.
  if(snap.event_status.completed){const items=JSON.parse(await env.STATE.get('espn:items:v1')||'{}');const k=`${snap.league}:${snap.espn_event_id}`;if(items[k]){items[k].next_at=0;await env.STATE.put('espn:items:v1',JSON.stringify(items));}}
  out.events.push({edition:ed.slug,status:snap.event_status.name,period:snap.event_status.period,players:snap.players.length,holes:snap.holes_available,state:liveState(snap,Date.now()).state});
 }
 await putJSON(env.PUBLIC,'live/v1/current.json',{version:LIVE_VERSION,as_of:new Date().toISOString(),events:current});
 return out;
}

// ---------------- durable observations (golf_live_snapshots / _rows): insert-only, change-only, capped.
export const SNAPSHOT_CAP=600;
export async function snapshotRows(snap){
 const sig=JSON.stringify(snap.players.map(p=>[p.espn_id,p.position_num,p.total_to_par,p.today_to_par,p.thru,p.status]).sort());
 const hash=await digest(new TextEncoder().encode(sig));
 const id=await stableId('live:'+snap.edition.id+':'+snap.fetched_at);
 const small=v=>Number.isInteger(v)?v:null;
 return {hash,header:{id,edition_id:snap.edition.id,captured_at:snap.fetched_at,source_updated_at:snap.source_updated_at,status:snap.event_status.name||'unknown',state:snap.event_status.state,round:small(snap.event_status.period),leaderboard_hash:hash,players:snap.players.length,capture_id:snap.capture_id||null,parser_version:snap.parser||'espn-golf-live/1.0.0'},
  rows:snap.players.map(p=>({snapshot_id:id,espn_id:p.espn_id,player_id:p.player_id||null,position:small(p.position_num),tied:typeof p.tied==='boolean'?p.tied:null,position_display:p.position_display,score_to_par:small(p.total_to_par),today:small(p.today_to_par),thru:small(p.thru),round:small(p.current_round),status:p.status}))};
}
export async function persistSnapshot(env,db,snap){
 if(await env.STATE.get('live:db:missing'))return {stored:false,reason:'tables_not_migrated'};
 const r=await snapshotRows(snap),k='live:db:last:'+snap.edition.id,last=JSON.parse(await env.STATE.get(k)||'null');
 if(last?.hash===r.hash)return {stored:false,reason:'unchanged'};
 if((last?.count||0)>=SNAPSHOT_CAP)return {stored:false,reason:'cap_reached'};
 try{
  await db('golf_live_snapshots','on_conflict=edition_id,captured_at',{method:'POST',headers:{prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify(r.header)});
  for(let i=0;i<r.rows.length;i+=200)await db('golf_live_snapshot_rows','on_conflict=snapshot_id,espn_id',{method:'POST',headers:{prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify(r.rows.slice(i,i+200))});
 }catch(e){if(/PGRST205|42P01|does not exist|Could not find the table/.test(e.message)){await env.STATE.put('live:db:missing','1',{expirationTtl:3600});return {stored:false,reason:'tables_not_migrated'};}throw e;}
 await env.STATE.put(k,JSON.stringify({hash:r.hash,count:(last?.count||0)+1,at:snap.fetched_at}));
 return {stored:true,rows:r.rows.length};
}
// Replays the archived change snapshots (R2 golf-source golf/live/...) into the tables once they exist.
export async function backfillSnapshots(env,db,{limit=200}={}){
 await env.STATE.delete('live:db:missing');
 const done=new Set(JSON.parse(await env.STATE.get('live:db:backfilled')||'[]'));let cursor,stored=0,seen=0,skipped=0;
 do{const l=await env.RAW.list({prefix:'golf/live/',cursor,limit:500});cursor=l.truncated?l.cursor:undefined;
  for(const o of l.objects){if(done.has(o.key))continue;if(seen>=limit){cursor=undefined;break;}seen++;
   const snap=JSON.parse(await (await env.RAW.get(o.key)).text());
   const r=await persistSnapshot(env,db,snap);if(r.reason==='tables_not_migrated')return {lane:'live-backfill',status:'tables_not_migrated'};
   r.stored?stored++:skipped++;done.add(o.key);}
 }while(cursor);
 await env.STATE.put('live:db:backfilled',JSON.stringify([...done]));
 return {lane:'live-backfill',seen,stored,skipped};
}

// R2 change log vs database: every archived board change must exist in the DB with identical normalized rows.
export async function reconcileSnapshots(env,db,{limit=400}={}){
 const out={lane:'live-reconcile',r2_snapshots:0,db_headers_found:0,missing_in_db:0,row_mismatches:0,rows_compared:0,by_edition:{},samples:[]};let cursor;
 do{const l=await env.RAW.list({prefix:'golf/live/',cursor,limit:500});cursor=l.truncated?l.cursor:undefined;
  for(const o of l.objects){if(out.r2_snapshots>=limit){cursor=undefined;break;}out.r2_snapshots++;
   const snap=JSON.parse(await (await env.RAW.get(o.key)).text()),r=await snapshotRows(snap);
   const e=out.by_edition[snap.edition.slug]||(out.by_edition[snap.edition.slug]={r2:0,db:0,rows:0,mismatches:0});e.r2++;
   const h=(await db('golf_live_snapshots',`select=id&id=eq.${r.header.id}`))[0];if(!h){out.missing_in_db++;continue;}out.db_headers_found++;e.db++;
   const dbRows=[];for(let off=0;;off+=1000){const pg=await db('golf_live_snapshot_rows',`select=espn_id,position,tied,score_to_par,today,thru,round,status&snapshot_id=eq.${h.id}&order=espn_id&limit=1000&offset=${off}`);dbRows.push(...pg);if(pg.length<1000)break;}
   const m=new Map(dbRows.map(x=>[x.espn_id,x]));
   for(const x of r.rows){out.rows_compared++;e.rows++;const d=m.get(x.espn_id);const same=d&&['position','tied','score_to_par','today','thru','round','status'].every(k=>(d[k]??null)===(x[k]??null));if(!same){out.row_mismatches++;e.mismatches++;}}
   if(out.samples.length<3){const p=snap.players.filter(x=>x.position_num).sort((a,b)=>a.position_num-b.position_num)[out.samples.length*5];if(p){const d=m.get(p.espn_id);out.samples.push({edition:snap.edition.slug,captured_at:snap.fetched_at,player:p.name,r2:{position:p.position_display,to_par:p.total_to_par,thru:p.thru},db:d?{position:d.position,tied:d.tied,to_par:d.score_to_par,thru:d.thru}:null});}}
  }}while(cursor);
 return out;
}
