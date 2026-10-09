// Golf Picks V1 lane: a BOUNDED step inside the existing 10-minute golf-ingest tick (no new cron, no new resource).
// 1) keep the compact model store current (full_field completed editions only), 2) lock eligible tournaments
// before the first sourced tee time, 3) append grade revisions after the official result, 4) weekly calibration.
// Everything is written to the PRIVATE golf-source bucket (env.RAW) under picks/v1/. Never to golf-public.
import {compactEdition,cutApplied,RatingBook,byEnd,fieldModel,PARAMS,MODEL_VERSION,DAY} from '../../shared/picks/model.js';
import {forecast,POLICY_VERSION,GRADE_VERSION,formatExcluded} from '../../shared/picks/policy.js';
import {lockKey,gradeKey,INDEX_KEY,PREFIX,seal,createOnly,getJSON,listKeys,gradeRevision,joinLock,trackRecord,sha256,canonical,LEDGER_VERSION} from '../../shared/picks/ledger.js';
import {firstTee} from '../../shared/live.js';
export const STORE_KEY=PREFIX+'model/editions.json';
const STATUS_KEY='picks:status:v1';
export const LOCK_MARGIN_MS=30*60000,SNAPSHOT_MAX_AGE_MS=70*60000,CONSERVATIVE_LEAD_MS=14*3600000;
const pj=(b,k)=>b.get(k).then(o=>o?o.json():null).catch(()=>null);

// Pre-start proof from one observed snapshot. Returns {ok, rule, deadline, first_tee, reason}.
export function lockGate(snap,edition,now){
 const t=now.getTime();
 if(!snap)return {ok:false,reason:'no_field_snapshot'};
 if(t-Date.parse(snap.fetched_at)>SNAPSHOT_MAX_AGE_MS)return {ok:false,reason:'snapshot_stale'};
 const st=snap.event_status||{};
 if(st.state!=='pre'||st.completed)return {ok:false,reason:'event_not_pre_start'};
 const scored=(snap.players||[]).some(p=>(Number.isInteger(p.thru)&&p.thru>0)||(p.rounds||[]).some(r=>r.strokes!==null&&r.strokes!==undefined));
 if(scored)return {ok:false,reason:'scores_posted'};
 const ft=firstTee(snap,1);
 if(ft){const d=Date.parse(ft)-LOCK_MARGIN_MS;return t<=d?{ok:true,rule:'first_sourced_tee_time_minus_30m',deadline:new Date(d).toISOString(),first_tee:ft}:{ok:false,reason:'past_lock_deadline',first_tee:ft};}
 // No sourced tee time: freeze before the earliest possible local midnight of the start date (UTC+14), else HOLD.
 const d=Date.parse(edition.starts_on+'T00:00:00Z')-CONSERVATIVE_LEAD_MS;
 return t<=d?{ok:true,rule:'conservative_utc_plus_14_midnight',deadline:new Date(d).toISOString(),first_tee:null}:{ok:false,reason:'hold_no_tee_time_after_conservative_deadline'};
}

async function refreshStore(env,ix,{limit=40}={}){
 const store=await getJSON(env.RAW,STORE_KEY)||{schema:'golf-picks-model-store/1',editions:[]};
 const have=new Set(store.editions.map(e=>e.slug)),today=Date.now();
 const want=ix.editions.filter(e=>e.coverage==='full_field'&&e.status==='completed'&&e.ends_on&&Date.parse(e.ends_on)+DAY<today);
 const missing=want.filter(e=>!have.has(e.slug)).slice(0,limit);let added=0;
 for(const e of missing){const d=await pj(env.PUBLIC,'projection/v2/editions/'+e.slug+'.json');const c=compactEdition(d);if(c){store.editions.push(c);added++;}else{store.skipped=[...new Set([...(store.skipped||[]),e.slug])];}}
 const complete=want.every(e=>have.has(e.slug)||store.editions.some(x=>x.slug===e.slug)||(store.skipped||[]).includes(e.slug));
 if(added){store.editions.sort(byEnd);store.updated_at=new Date().toISOString();await env.RAW.put(STORE_KEY,JSON.stringify(store),{httpMetadata:{contentType:'application/json'}});}
 return {store,added,complete,wanted:want.length};
}

async function marketSnapshot(env,editionId){
 // Read-only, existing propsports-markets route; stored verbatim per venue. Golf is RULE_MISMATCH (owner,
 // 2026-10-05): venues are never combined, compared or called an edge.
 if(!env.MARKETS?.fetch)return {status:'not_captured',reason:'markets_binding_absent'};
 try{const r=await env.MARKETS.fetch('https://propsports-markets/v1/market-intelligence/event/golf/'+editionId,{signal:AbortSignal.timeout(6000)});
  if(!r.ok)return {status:'not_captured',reason:'http_'+r.status};const text=await r.text();if(text.length>400000)return {status:'not_captured',reason:'too_large'};
  return {status:'captured',fetched_at:new Date().toISOString(),comparability:'RULE_MISMATCH',use:'separate venue benchmark only; never combined',sha256:await sha256(text),body:JSON.parse(text)};}
 catch(e){return {status:'not_captured',reason:String(e.message).slice(0,80)};}
}

export async function lockEdition(env,e,{now,store}){
 const snap=await pj(env.PUBLIC,'live/v1/events/'+e.slug+'.json');
 const gate=lockGate(snap,e,now);if(!gate.ok)return {edition:e.slug,status:'hold',reason:gate.reason};
 const doc=await pj(env.PUBLIC,'projection/v2/editions/'+e.slug+'.json');
 const entrants=(snap.players||[]).filter(p=>!['withdrawn','disqualified','dns'].includes(p.status)).map(p=>({slug:p.slug||('espn-'+p.espn_id),name:p.name,mapped:Boolean(p.slug)}));
 const at=Date.parse(e.starts_on);const cutoff=store.editions.filter(x=>Date.parse(x.ends_on)+DAY<=at);
 const book=new RatingBook(PARAMS);for(const x of cutoff)book.update(x);
 const field=fieldModel(book,entrants,at).map((p,i)=>entrants[i].mapped?p:{...p,rounds:0});
 const tslug=doc?.tournament?.slug||e.tournament?.slug||null,prior=cutoff.filter(x=>x.tournament&&x.tournament===tslug).at(-1)||null;
 const edition={slug:e.slug,name:e.name,id:e.id,starts_on:e.starts_on,ends_on:e.ends_on,division:e.division,is_major:Boolean(e.is_major),tour:e.tour?.short||e.tours?.[0]||null,course:e.course?.name||null};
 if(formatExcluded(e.slug))return {edition:e.slug,status:'hold',reason:'format_not_individual_stroke_play'};
 const fc=forecast({edition,field,priorHadCut:prior?cutApplied(prior.rows):null,rounds:prior?.rounds_played===3?3:4,seed:e.slug+'|'+MODEL_VERSION});
 if(!fc.eligible)return {edition:e.slug,status:'hold',reason:'field_or_rating_coverage_below_policy'};
 const lockedAt=new Date();
 const lock=await seal({schema:'golf-picks-lock/1',ledger:LEDGER_VERSION,label:'RESEARCH',edition,locked_at:lockedAt.toISOString(),
  start_evidence:{first_tee:gate.first_tee,event_state:snap.event_status?.state,status_name:snap.event_status?.name||null,scores_posted:false,snapshot_fetched_at:snap.fetched_at,snapshot_capture_id:snap.capture_id||null,source:'ESPN core competitor status/tee times observed by golf-ingest'},
  freeze:{rule:gate.rule,deadline:gate.deadline},
  feature_cutoff:{editions_ended_before:e.starts_on,editions_used:cutoff.length,latest_edition_used:cutoff.at(-1)?.slug||null,store_sha256:await sha256(canonical(cutoff.map(x=>x.slug)))},
  model:{version:MODEL_VERSION,params:PARAMS,inputs:'full_field round scores only; no strokes-gained, rankings, odds or weather'},policy:POLICY_VERSION,grade_policy:GRADE_VERSION,
  field:{entrants:entrants.length,unmapped:entrants.filter(x=>!x.mapped).length},forecast:fc,market:await marketSnapshot(env,e.id)});
 const w=await createOnly(env.RAW,lockKey(e.slug),lock);
 return w.created?{edition:e.slug,status:'locked',sha256:lock.sha256,locked_at:lock.locked_at,first_tee:gate.first_tee,selections:fc.selections.length}:{edition:e.slug,status:'already_locked'};
}

// Official result for grading: the projection edition once completed with a leaderboard that lists missed cuts.
export function resultFrom(doc){
 if(!doc||doc.status!=='completed'||!doc.leaderboard?.length)return {status:'pending'};
 if(!['full_field','partial_field'].includes(doc.coverage))return {status:'pending',reason:'incomplete_leaderboard'};
 const c=compactEdition({...doc,coverage:'full_field'});
 return {status:'final',rounds_completed:Math.max(0,...c.rows.map(r=>r.r.filter(v=>v!==null).length)),rows:c.rows};
}
async function gradeAll(env,{now,limit=3}){
 const locks=(await listKeys(env.RAW,PREFIX+'locks/')).map(k=>k.slice((PREFIX+'locks/').length,-5));const out=[];
 for(const slug of locks){if(out.length>=limit)break;
  const revs=await listKeys(env.RAW,PREFIX+'grades/'+slug+'/'),prev=revs.length?await getJSON(env.RAW,revs.at(-1)):null;
  // Final grades are re-checked for corrections for 14 days after the first final revision.
  if(prev?.final&&now-Date.parse(prev.graded_at)>14*DAY)continue;
  const lock=await getJSON(env.RAW,lockKey(slug));if(!lock||now<Date.parse(lock.edition.ends_on))continue;
  const doc=await pj(env.PUBLIC,'projection/v2/editions/'+slug+'.json'),res=resultFrom(doc);if(res.status==='pending')continue;
  const rev=await gradeRevision(lock,res,prev,{now:new Date(now),source:{projection_as_of:doc?.provenance?.captured_at||null,provenance_sha256:doc?.provenance?.sha256||null,coverage:doc.coverage}});
  if(!rev){continue;}const w=await createOnly(env.RAW,gradeKey(slug,rev.revision),rev);out.push({edition:slug,revision:rev.revision,created:w.created});
 }
 return out;
}
// Derived member index (overwritable cache, rebuilt from the immutable ledger).
async function rebuildIndex(env){
 const slugs=(await listKeys(env.RAW,PREFIX+'locks/')).map(k=>k.slice((PREFIX+'locks/').length,-5));const items=[];
 for(const slug of slugs){const lock=await getJSON(env.RAW,lockKey(slug));if(!lock)continue;const revs=await listKeys(env.RAW,PREFIX+'grades/'+slug+'/');const g=revs.length?await getJSON(env.RAW,revs.at(-1)):null;items.push(joinLock(lock,g));}
 items.sort((a,b)=>a.edition.starts_on<b.edition.starts_on?1:-1);
 const doc={schema:'golf-picks-index/1',built_at:new Date().toISOString(),model:MODEL_VERSION,policy:POLICY_VERSION,items,record:trackRecord(items)};
 await env.RAW.put(INDEX_KEY,JSON.stringify(doc),{httpMetadata:{contentType:'application/json',cacheControl:'private, no-store'}});return items.length;
}
// Weekly challenger report: rolling calibration of graded selections. Reviewed by people; never auto-reweights.
async function weekly(env,now){
 const d=new Date(now);const wk=`${d.getUTCFullYear()}-${String(Math.ceil(((d-Date.UTC(d.getUTCFullYear(),0,1))/DAY+new Date(Date.UTC(d.getUTCFullYear(),0,1)).getUTCDay()+1)/7)).padStart(2,'0')}`;
 const key=PREFIX+'reports/'+wk+'.json';if(await env.RAW.head(key))return null;
 const ix=await getJSON(env.RAW,INDEX_KEY);if(!ix)return null;
 const rep=await seal({schema:'golf-picks-weekly/1',week:wk,generated_at:new Date(now).toISOString(),model:MODEL_VERSION,policy:POLICY_VERSION,record:{families:ix.record.families,by_tour:ix.record.by_tour},note:'Rolling calibration for human review. No automatic reweighting or promotion.'});
 return (await createOnly(env.RAW,key,rep)).created?wk:null;
}
export async function runPicks(env,{now=new Date(),budgetMs=60000}={}){
 if(env.PICKS_ENABLED!=='1')return {lane:'picks',status:'disabled'};
 if(!env.RAW||!env.PUBLIC||!env.STATE)return {lane:'picks',status:'unconfigured'};
 const t0=Date.now(),out={lane:'picks',model:MODEL_VERSION,locks:[],grades:[]};
 const ix=await pj(env.PUBLIC,'projection/v2/index.json');if(!ix)return {...out,status:'projection_unavailable'};
 const s=await refreshStore(env,ix);out.store={editions:s.store.editions.length,added:s.added,complete:s.complete};
 const locked=new Set((await listKeys(env.RAW,PREFIX+'locks/')).map(k=>k.slice((PREFIX+'locks/').length,-5)));
 const t=now.getTime(),cands=ix.editions.filter(e=>e.starts_on&&!locked.has(e.slug)&&e.status!=='cancelled'&&e.status!=='completed'&&Date.parse(e.starts_on)-t<=3*DAY&&Date.parse(e.starts_on)-t>=-DAY);
 for(const e of cands){if(Date.now()-t0>budgetMs)break;if(!s.complete){out.locks.push({edition:e.slug,status:'hold',reason:'model_store_incomplete'});continue;}
  try{out.locks.push(await lockEdition(env,e,{now,store:s.store}));}catch(err){out.locks.push({edition:e.slug,status:'error',error:String(err.message).slice(0,160)});}}
 if(Date.now()-t0<budgetMs)out.grades=await gradeAll(env,{now:t}).catch(err=>[{status:'error',error:String(err.message).slice(0,160)}]);
 if(out.locks.some(l=>l.status==='locked')||out.grades.some(g=>g.created)||!await env.RAW.head(INDEX_KEY))out.index=await rebuildIndex(env);
 if(new Date(t).getUTCDay()===1)out.weekly=await weekly(env,t).catch(()=>null);
 out.ms=Date.now()-t0;await env.STATE.put(STATUS_KEY,JSON.stringify({at:new Date().toISOString(),...out}));
 return out;
}
