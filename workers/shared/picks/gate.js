// Golf Picks lock gate: ONE implementation shared by the golf-ingest lock step, the health record, the admin
// gate route (scripts/picks-gate.mjs) and the public readiness view. Pure: no I/O.
// An event locks only when every check passes. Nothing locks after play begins.
import {firstTee} from '../live.js';
export const LOCK_MARGIN_MS=30*60000,SNAPSHOT_MAX_AGE_MS=70*60000,CONSERVATIVE_LEAD_MS=14*3600000,MIN_FIELD=30,MIN_MAPPED=0.6;
// Plain-language labels for the public readiness panel.
export const CHECK_LABEL={
 model_store_complete:'Complete-field scoring history loaded',
 field_published:'Official field published',
 field_mapped:'Field matched to verified golfer identities',
 start_time_sourced:'First-round start time sourced',
 pre_start:'Tournament not started',
 no_scores_posted:'No scores posted',
 snapshot_fresh:'Field observed within the last 70 minutes',
 before_lock_cutoff:'Before the lock cutoff'};
const OUT=new Set(['withdrawn','disqualified','dns']);
export function evaluateGate({snap,edition,now=new Date(),storeComplete=true}){
 const t=now.getTime(),active=(snap?.players||[]).filter(p=>!OUT.has(p.status)),mapped=active.filter(p=>p.slug).length;
 const ft=snap?firstTee(snap,1):null;
 // Start basis: the first sourced R1 tee time; without one, the frozen conservative rule (earliest possible local
 // midnight of the start date, UTC+14). Lock cutoff = basis - 30 min (tee) or the conservative instant itself.
 const rule=ft?'first_sourced_tee_time_minus_30m':'conservative_utc_plus_14_midnight';
 const cutoff=ft?Date.parse(ft)-LOCK_MARGIN_MS:edition?.starts_on?Date.parse(edition.starts_on+'T00:00:00Z')-CONSERVATIVE_LEAD_MS:null;
 const scored=active.some(p=>(Number.isInteger(p.thru)&&p.thru>0)||(p.rounds||[]).some(r=>r.strokes!==null&&r.strokes!==undefined));
 const checks={
  model_store_complete:{ok:Boolean(storeComplete),value:storeComplete},
  field_published:{ok:active.length>=MIN_FIELD,value:active.length},
  field_mapped:{ok:active.length>0&&mapped/active.length>=MIN_MAPPED,value:active.length?Math.round(mapped/active.length*100)/100:0},
  start_time_sourced:{ok:Boolean(ft)||(Boolean(snap)&&cutoff!==null),value:ft||(snap?'conservative pre-start rule':null)},
  pre_start:{ok:snap?.event_status?.state==='pre'&&!snap?.event_status?.completed,value:snap?.event_status?.name||null},
  no_scores_posted:{ok:Boolean(snap)&&!scored,value:snap?!scored:null},
  snapshot_fresh:{ok:Boolean(snap)&&t-Date.parse(snap.fetched_at)<=SNAPSHOT_MAX_AGE_MS,value:snap?.fetched_at||null},
  before_lock_cutoff:{ok:cutoff!==null&&t<=cutoff,value:cutoff!==null?new Date(cutoff).toISOString():null}};
 const failing=Object.entries(checks).filter(([,c])=>!c.ok).map(([k])=>k);
 return {state:failing.length?'NOT_READY':'READY',checks,failing,rule,first_tee:ft,cutoff:cutoff!==null?new Date(cutoff).toISOString():null,checked_at:now.toISOString()};
}
// Lock-step view of the same gate (reason = the most fundamental failing check).
const ORDER=['field_snapshot','snapshot_fresh','pre_start','no_scores_posted','before_lock_cutoff','field_published','field_mapped','model_store_complete','start_time_sourced'];
const REASON={snapshot_fresh:'snapshot_stale',pre_start:'event_not_pre_start',no_scores_posted:'scores_posted',field_published:'field_not_published',field_mapped:'field_not_mapped',model_store_complete:'model_store_incomplete',start_time_sourced:'start_time_not_sourced'};
export function lockDecision(g,snap){
 if(!snap)return {ok:false,reason:'no_field_snapshot'};
 if(g.state==='READY')return {ok:true,rule:g.rule,deadline:g.cutoff,first_tee:g.first_tee};
 const k=ORDER.find(x=>g.failing.includes(x));
 const reason=k==='before_lock_cutoff'?(g.first_tee?'past_lock_deadline':'hold_no_tee_time_after_conservative_deadline'):REASON[k]||k;
 return {ok:false,reason,first_tee:g.first_tee};
}
// Why an event is not ready, in one specific sentence (issue golf#9): source hold vs technical vs policy vs
// schedule. ctx (recorded by the health step): snapshot_present, observation_opens (golf-ingest observes a field
// from 00:00 UTC the day before the start date), source {competitors, status, checked_at} (read-only ESPN core
// probe), prior_field_size (last complete edition of the same tournament).
const day=iso=>iso?iso.slice(0,16).replace('T',' ')+' UTC':null;
export function readinessReason(g,ctx={}){
 if(!g)return null;
 if(g.reason==='no_upcoming_edition')return {code:'no_event',kind:'schedule',headline:'NO APPROVED FUTURE EVENT',detail:'No upcoming PGA TOUR or LPGA individual stroke-play event is on the published schedule.'};
 if(g.reason==='projection_unavailable')return {code:'projection_unavailable',kind:'technical',headline:'SCHEDULE DATA UNAVAILABLE',detail:'The published golf schedule could not be read on the last check.'};
 if(g.state==='READY')return {code:'ready',kind:'ready',headline:'READY TO LOCK',detail:`Every check passed. Selections lock on the next 10-minute run, no later than ${day(g.cutoff)}.`};
 const f=new Set(g.failing||[]),src=ctx.source||null,prior=ctx.prior_field_size?` of ~${ctx.prior_field_size} expected (last edition’s field)`:'';
 if(ctx.snapshot_present&&f.has('pre_start')&&g.checks?.pre_start?.value&&g.checks.pre_start.value!=='STATUS_SCHEDULED')return {code:'started',kind:'policy',headline:'TOURNAMENT UNDER WAY: NO PICK PERMITTED',detail:'Play has begun, so no selection can be locked for this event.'};
 if(f.has('no_scores_posted')&&ctx.snapshot_present)return {code:'scores_posted',kind:'policy',headline:'SCORES POSTED: NO PICK PERMITTED',detail:'Scores are already posted, so no selection can be locked for this event.'};
 if(f.has('before_lock_cutoff'))return {code:'past_cutoff',kind:'policy',headline:'PAST SAFE CUTOFF: NO PICK PERMITTED',detail:`The lock cutoff (${day(g.cutoff)}) has passed without every check passing.`};
 if(f.has('model_store_complete'))return {code:'model_loading',kind:'technical',headline:'MODEL HISTORY LOADING',detail:'Complete-field scoring history is still being loaded into the model.'};
 if(!ctx.snapshot_present){
  const opens=ctx.observation_opens&&Date.parse(ctx.observation_opens)>Date.parse(g.checked_at);
  if(src&&Number.isInteger(src.competitors)&&src.competitors===0)return {code:'field_unpublished',kind:'source_hold',headline:'FIELD NOT YET PUBLISHED BY SOURCE',detail:`0${prior} entrants listed by the official scoring source (checked ${day(src.checked_at)}).${opens?` Field observation opens ${day(ctx.observation_opens)}.`:''}`};
  if(src&&src.competitors>0&&opens)return {code:'awaiting_observation',kind:'schedule',headline:'FIELD PUBLISHED · OBSERVATION OPENS SOON',detail:`${src.competitors}${prior} entrants listed by the source (checked ${day(src.checked_at)}). Tee times and the full field are observed from ${day(ctx.observation_opens)}.`};
  if(opens)return {code:'awaiting_observation',kind:'schedule',headline:`FIELD CHECKS OPEN ${day(ctx.observation_opens)}`,detail:'The field and tee times are observed from 00:00 UTC the day before the start date.'};
  return {code:'feed_missing',kind:'technical',headline:'SCORING FEED NOT YET OBSERVED',detail:'The observation window is open but no field snapshot has been recorded yet.'};
 }
 if(f.has('snapshot_fresh'))return {code:'feed_stale',kind:'technical',headline:'FIELD REFRESH DELAYED',detail:`The last field observation is older than 70 minutes (${day(g.checks.snapshot_fresh.value)}).`};
 if(f.has('field_published'))return {code:'field_unpublished',kind:'source_hold',headline:'FIELD NOT YET PUBLISHED BY SOURCE',detail:`${g.checks.field_published.value}${prior} entrants listed so far; at least 30 are required.`};
 if(f.has('field_mapped'))return {code:'mapping',kind:'source_hold',headline:'MATCHING GOLFER IDENTITIES',detail:`${Math.round((g.checks.field_mapped.value||0)*100)}% of the field matched to verified identities; 60% required.`};
 if(f.has('start_time_sourced'))return {code:'no_start_time',kind:'source_hold',headline:'START TIME NOT YET SOURCED',detail:'No round-one tee time is published yet.'};
 if(f.has('pre_start'))return {code:'started',kind:'policy',headline:'TOURNAMENT UNDER WAY: NO PICK PERMITTED',detail:'Play has begun, so no selection can be locked for this event.'};
 return {code:'other',kind:'technical',headline:'CHECKS PENDING',detail:(g.failing||[]).map(k=>CHECK_LABEL[k]||k).join(', ')};
}
// Public readiness (no golfer, selection or probability).
export function readinessView(g,edition,ctx){
 if(!g)return null;
 const why=readinessReason(g,ctx||g.context||{});
 if(!edition)return {state:g.state||'NOT_READY',reason:why,edition:null,checked_at:g.checked_at||null,checks:[]};
 return {state:g.state,reason:why,observation_opens:(ctx||g.context||{}).observation_opens||null,source:(ctx||g.context||{}).source||null,edition:{name:edition.name,starts_on:edition.starts_on,ends_on:edition.ends_on||null,tour:edition.tour||null},checked_at:g.checked_at,expected_lock_by:g.cutoff,start_basis:g.first_tee?'first sourced round-one tee time':'conservative pre-start rule',first_tee:g.first_tee,
  checks:Object.entries(g.checks).map(([k,c])=>({key:k,label:CHECK_LABEL[k]||k,ok:c.ok}))};
}
