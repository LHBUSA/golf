// Live scoring lane: current-event snapshots from the approved ESPN core API (sports.core.api.espn.com only).
// Every snapshot is archived (provenance) and published as observed state with its fetch time. Nothing is
// inferred: positions, thru, holes and tee times are exactly what ESPN reports; missing stays null.
import {CORE,LEAGUES,getJSON,pool,idOf,archive,UpstreamBusy} from './espn.js';
import {toParNum,LIVE_VERSION,liveState} from '../../shared/live.js';
export const LIVE_PARSER='espn-golf-live/1.0.0';
const DAY=86400000;
const putJSON=(b,k,v,cache)=>b.put(k,JSON.stringify(v),{httpMetadata:{contentType:'application/json',...(cache?{cacheControl:cache}:{})}});
const getJ=async(b,k)=>{const o=await b.get(k);return o?JSON.parse(await o.text()):null;};
const STATUS={STATUS_CUT:'cut',STATUS_WITHDRAWN:'withdrawn',STATUS_WD:'withdrawn',STATUS_DISQUALIFIED:'disqualified',STATUS_DQ:'disqualified',STATUS_DNS:'dns',STATUS_DID_NOT_START:'dns'};
// Pure normalization of one competitor (status + linescores). Exported for tests.
export function normalizeCompetitor(id,st,ls,{name=null,slug=null}={}){
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
 return {espn_id:String(id),slug,name,status:STATUS[st?.type?.name]||'active',status_name:st?.type?.name||null,
  position_display:pos?.displayName||null,position_num:Number(pos?.id)||null,tied:pos?typeof pos.isTie==='boolean'?pos.isTie:null:null,
  total_to_par:total,today_to_par:started&&cur?cur.to_par:null,today_strokes:started&&cur?cur.strokes:null,
  current_round:period,thru,hole:Number.isInteger(st?.hole)?st.hole:null,start_hole:Number(st?.startHole)||null,tee_time:st?.teeTime||cur?.tee_time||null,playoff:st?.playoff??null,
  rounds:rounds.map(({holes,...r})=>r),holes:cur?.holes?.length?cur.holes:null};
}
async function names(env,league,ids,db){
 const out=new Map();if(!ids.length)return out;
 for(let i=0;i<ids.length;i+=100){const rows=await db('golf_player_identities',`select=provider_id,golf_players(slug,full_name)&source_id=eq.espn&provider_id=in.(${ids.slice(i,i+100).join(',')})`);for(const r of rows)if(r.golf_players)out.set(String(r.provider_id),{slug:r.golf_players.slug,name:r.golf_players.full_name});}
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
  if(JSON.stringify((mv.points.at(-1)?.top||[]).map(x=>[x.slug||x.name,x.pos,x.to_par,x.thru]))!==sig){mv.points.push(pt);mv.points=mv.points.slice(-400);await putJSON(env.PUBLIC,mk,mv);await putJSON(env.PRIVATE||env.RAW,`golf/live/${ed.slug}/${snap.fetched_at}.json`,snap);}
  // When ESPN reports the event final, hand the event to the ingest lane immediately.
  if(snap.event_status.completed){const items=JSON.parse(await env.STATE.get('espn:items:v1')||'{}');const k=`${snap.league}:${snap.espn_event_id}`;if(items[k]){items[k].next_at=0;await env.STATE.put('espn:items:v1',JSON.stringify(items));}}
  out.events.push({edition:ed.slug,status:snap.event_status.name,period:snap.event_status.period,players:snap.players.length,holes:snap.holes_available,state:liveState(snap,Date.now()).state});
 }
 await putJSON(env.PUBLIC,'live/v1/current.json',{version:LIVE_VERSION,as_of:new Date().toISOString(),events:current});
 return out;
}
