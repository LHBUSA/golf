// Golf Picks gate check + persistent health (owner, 2026-10-09). Read-only against the ledger: it never creates,
// rewrites or deletes a lock or grade. Runs as a bounded step on the existing golf-ingest full tick (no new cron)
// and records to KV picks:health:v1 + private R2 picks/v1/health/latest.json. No alert channel is bound in this
// repo, so a FAIL is recorded and surfaced (admin + aggregate on /health); it is not pushed anywhere.
import {evaluateGate} from '../../shared/picks/gate.js';
import {PREFIX,lockKey,listKeys,getJSON,verifySeal,sha256,canonical} from '../../shared/picks/ledger.js';
import {formatExcluded} from '../../shared/picks/policy.js';
import {resultFrom,STORE_KEY} from './picks.js';
import {DAY} from '../../shared/picks/model.js';
export const HEALTH_KEY='picks:health:v1',STATUS_KEY='picks:status:v1';
const pj=(b,k)=>b.get(k).then(o=>o?o.json():null).catch(()=>null);
const slugsOf=keys=>keys.map(k=>k.slice((PREFIX+'locks/').length,-5));

// Next eligible edition + the shared gate (same implementation as the lock step).
export async function gateCheck(env,now=new Date()){
 const t=now.getTime(),ix=await pj(env.PUBLIC,'projection/v2/index.json');if(!ix)return {state:'NOT_READY',reason:'projection_unavailable'};
 const locked=new Set(slugsOf(await listKeys(env.RAW,PREFIX+'locks/')));
 const next=ix.editions.filter(e=>e.starts_on&&!['completed','cancelled'].includes(e.status)&&Date.parse(e.starts_on)+DAY>t&&!formatExcluded(e.slug)&&!locked.has(e.slug)).sort((a,b)=>a.starts_on<b.starts_on?-1:1)[0];
 if(!next)return {state:'NOT_READY',reason:'no_upcoming_edition'};
 const store=await getJSON(env.RAW,STORE_KEY),want=ix.editions.filter(e=>e.coverage==='full_field'&&e.status==='completed'&&e.ends_on&&Date.parse(e.ends_on)+DAY<t);
 const have=new Set([...(store?.editions||[]).map(e=>e.slug),...(store?.skipped||[])]);
 const snap=await pj(env.PUBLIC,'live/v1/events/'+next.slug+'.json');
 const g=evaluateGate({snap,edition:next,now,storeComplete:Boolean(store)&&want.every(e=>have.has(e.slug))});
 g.checks.model_store_complete.value=`${have.size}/${want.length}`;
 return {...g,edition:{slug:next.slug,name:next.name,starts_on:next.starts_on,ends_on:next.ends_on||null,tour:next.tour?.short||next.tours?.[0]||null}};
}

// Ledger integrity: every lock re-hashed from its STORED BYTES, locked before its sourced start, graded after the
// official result. Returns PASS/FAIL with reasons; writes the record.
export async function picksHealth(env,{now=new Date(),write=true}={}){
 const t=now.getTime(),fails=[],locks=[];
 for(const slug of slugsOf(await listKeys(env.RAW,PREFIX+'locks/')).slice(0,60)){
  const o=await env.RAW.get(lockKey(slug));if(!o)continue;const text=await o.text();let doc;try{doc=JSON.parse(text);}catch{fails.push({edition:slug,fail:'lock_unparseable'});continue;}
  const sealOk=await verifySeal(doc),metaOk=!o.customMetadata?.sha256||o.customMetadata.sha256===doc.sha256;
  const start=doc.start_evidence?.first_tee||doc.freeze?.deadline||null,beforeStart=Boolean(start)&&Date.parse(doc.locked_at)<Date.parse(start);
  const revs=await listKeys(env.RAW,PREFIX+'grades/'+slug+'/'),last=revs.length?await getJSON(env.RAW,revs.at(-1)):null;
  let gradeState=last?(last.final?'final':'partial'):'none';
  if(!last&&t>Date.parse(doc.edition.ends_on)+2*DAY){const res=resultFrom(await pj(env.PUBLIC,'projection/v2/editions/'+slug+'.json'));if(res.status==='final'){gradeState='missing_after_result';fails.push({edition:slug,fail:'missing_grade_after_official_result'});}}
  if(last&&last.lock_sha256!==doc.sha256)fails.push({edition:slug,fail:'grade_references_other_lock'});
  if(!sealOk||!metaOk)fails.push({edition:slug,fail:'lock_hash_mismatch'});
  if(!beforeStart)fails.push({edition:slug,fail:'lock_not_before_start'});
  locks.push({edition:slug,lock_sha256:doc.sha256,locked_at:doc.locked_at,first_tee:doc.start_evidence?.first_tee||null,freeze_rule:doc.freeze?.rule||null,seal_verified:sealOk&&metaOk,stored_bytes_sha256:await sha256(text),locked_before_start:beforeStart,grade_revisions:revs.length,grade_state:gradeState});
 }
 const gate=await gateCheck(env,now).catch(e=>({state:'NOT_READY',reason:'gate_error:'+String(e.message).slice(0,80)}));
 const rec={schema:'golf-picks-health/1',checked_at:now.toISOString(),enabled:env.PICKS_ENABLED==='1',status:fails.length?'FAIL':'PASS',fails,locks,gate};
 if(write){await env.STATE.put(HEALTH_KEY,JSON.stringify(rec));await env.RAW.put(PREFIX+'health/latest.json',JSON.stringify(rec),{httpMetadata:{contentType:'application/json'}});
  if(!rec.enabled)await env.STATE.put(STATUS_KEY,JSON.stringify({at:now.toISOString(),lane:'picks',status:'disabled'}));}
 return rec;
}
// Public aggregate for /health: no golfer, selection, probability or hash.
export function healthAggregate(rec){
 if(!rec)return null;
 return {enabled:rec.enabled,status:rec.status,checked_at:rec.checked_at,locks:rec.locks?.length||0,fails:rec.fails?.length||0,graded_final:(rec.locks||[]).filter(l=>l.grade_state==='final').length,next_event_gate:rec.gate?.state||null,next_event:rec.gate?.edition?.name||null};
}
