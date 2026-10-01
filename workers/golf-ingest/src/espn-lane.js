// ESPN lane: discovery queue -> event bundles -> identity resolution -> field-level merge into golf_*.
import {stableId} from '../../shared/store.js';
import {SourceBlockedError} from '../../shared/http.js';
import {Plan,slug} from './plan.js';
import {writePlan} from './writer.js';
import {CORE,LEAGUES,getJSON,pool,archive,fetchEventBundle,parseEventBundle,resolveAthlete,athleteFacts,norm,idOf,ESPN_PARSER} from './espn.js';
const KEY='espn:items:v1',XW='espn:xwalk:v1',DAY=86400000;
async function kv(env,k,d){try{return JSON.parse(await env.STATE.get(k)||'null')??d;}catch{return d;}}
async function all(db,table,select,filter=''){const out=[];for(let o=0;;o+=1000){const p=await db(table,`select=${select}${filter}&order=id&limit=1000&offset=${o}`);out.push(...p);if(p.length<1000)return out;}}
// Which events get hole-by-hole rows (bounded for the shared database): PGA from 2025, and majors.
export const holesPolicy=(league,season,isMajor)=>isMajor||(league==='pga'&&season>=2025)||(league==='champions-tour'&&season>=2026)||(league==='ntw'&&season>=2026);
export async function discover(env,{leagues,seasons}){
 const items=await kv(env,KEY,{});let added=0;
 for(const L of leagues)for(const y of seasons){
  let types=[];try{types=(await getJSON(`${CORE}/leagues/${L}/seasons/${y}/types?limit=10`)).items?.map(i=>idOf(i.$ref))||[];}catch(e){if(e instanceof SourceBlockedError)throw e;continue;}
  for(const t of types){let ev;try{ev=await getJSON(`${CORE}/leagues/${L}/seasons/${y}/types/${t}/events?limit=300`);}catch(e){if(e instanceof SourceBlockedError)throw e;continue;}
   for(const i of ev.items||[]){const id=idOf(i.$ref),k=`${L}:${id}`;if(!items[k]){items[k]={league:L,season:y,event_id:id,status:'pending',next_at:0};added++;}}}
 }
 await env.STATE.put(KEY,JSON.stringify(items));return {added,total:Object.keys(items).length};
}
const dist=(a,b)=>a&&b?Math.abs(Date.parse(a)-Date.parse(b))/DAY:99;
const tokens=s=>new Set(norm(s).split(' ').filter(w=>w.length>3&&!['championship','tournament','classic','open','golf','presented','invitational'].includes(w)));
export function matchEdition(ev,league,editions){
 const tourName=LEAGUES[league]?.tour==='pga-tour'?'PGA Tour':LEAGUES[league]?.tour==='lpga'?'LPGA Tour':null;
 const live=editions.filter(e=>!e.rules?.superseded_by);
 const yr=Number((ev.ends_on||ev.starts_on||'').slice(0,4)),tk=tokens(ev.name);
 const near=live.filter(e=>e.year===yr&&dist(e.ends_on,ev.ends_on)<=1.01&&[...tokens(e.rules?.source_name||'')].some(w=>tk.has(w)));
 // Canonical (Wikidata) editions win: majors and The Players carry wikidata_id.
 const wd=near.filter(e=>e.rules?.wikidata_id);
 const exact=live.find(e=>e.rules?.espn?.event_id===ev.espn_id);
 if(wd.length===1)return {match:wd[0],supersede:near.filter(e=>e!==wd[0]&&(e.rules?.espn?.event_id===ev.espn_id||!e.rules?.wikidata_id)).map(e=>e.id)};
 if(exact)return {match:exact,supersede:[]};
 const cands=near.filter(e=>!tourName||e.tours?.includes(tourName)||e.rules?.division===LEAGUES[league].division);
 return {match:cands.length===1?cands[0]:null,supersede:[]};
}
export async function runEspn(env,db,{budgetMs=200000,limit=20,now=new Date(),force=null}={}){
 const started=Date.now(),items=await kv(env,KEY,{}),xw=await kv(env,XW,{tournament:{},course:{},college:{}});
 const t=now.getTime();for(const k of force||[])if(items[k]){items[k].next_at=0;items[k].checked_at=null;}
 const due=Object.entries(items).filter(([,i])=>(i.next_at||0)<=t).sort((a,b)=>(force?.includes(b[0])?1:0)-(force?.includes(a[0])?1:0)||(a[1].checked_at?1:0)-(b[1].checked_at?1:0)||b[1].season-a[1].season).slice(0,limit);
 const out={lane:'espn',due:due.length,processed:0,held:0,errors:0,inserted:0,updated:0,unchanged:0,conflicts:0,new_players:0,resolved_players:0,held_identities:0};
 if(!due.length)return out;
 // Canonical indexes, loaded once per run.
 const editionRows=await all(db,'golf_tournament_editions','id,tournament_id,edition_key,starts_on,ends_on,status,rules');
 const etours=await all(db,'golf_edition_tours','edition_id,tour_id');const tourIds={'pga-tour':await stableId('golf_tours:Q910409'),lpga:await stableId('golf_tours:Q17162079')};
 const editions=editionRows.map(e=>({...e,year:Number(e.edition_key),tours:etours.filter(x=>x.edition_id===e.id).map(x=>x.tour_id===tourIds['pga-tour']?'PGA Tour':x.tour_id===tourIds.lpga?'LPGA Tour':null).filter(Boolean)}));
 const years=new Map((await all(db,'golf_player_identities','player_id,birth_year:evidence->>birth_year','&source_id=eq.wikidata')).map(r=>[r.player_id,Number(r.birth_year)||null]));
 const players=(await all(db,'golf_players','id,full_name,birth_date')).map(p=>({...p,birth_year:p.birth_date?Number(p.birth_date.slice(0,4)):years.get(p.id)||null}));const byName=new Map();for(const p of players){const k=norm(p.full_name);byName.set(k,[...(byName.get(k)||[]),p]);}
 const crosswalk=new Map((await all(db,'golf_player_identities','player_id,provider_id','&source_id=eq.espn')).map(r=>[r.provider_id,r.player_id]));
 const courses=await all(db,'golf_courses','id,name');const courseByName=new Map();for(const c of courses){const k=norm(c.name);courseByName.set(k,[...(courseByName.get(k)||[]),c]);}
 for(const [key,item] of due){
  if(Date.now()-started>budgetMs)break;
  if(item.in_progress){item.attempts=(item.attempts||0)+1;delete item.in_progress;if(item.attempts>=3){item.status='error';item.next_at=t+7*DAY;items[key]=item;continue;}}
  item.in_progress=new Date().toISOString();items[key]=item;await env.STATE.put(KEY,JSON.stringify(items));
  try{
   const bundle=await fetchEventBundle(item.league,item.event_id);
   const cap=await archive(env,db,`${CORE}/leagues/${item.league}/events/${item.event_id}#bundle`,bundle);
   const p=parseEventBundle(bundle),ev=p.event;
   // Athletes not yet crosswalked: profile + college (cached), archived as one bundle.
   const unknown=p.rows.map(r=>r.espn_id).filter(id=>!crosswalk.has(id));
   const profiles=await pool(3,unknown,async id=>{try{return await getJSON(`${CORE}/leagues/${item.league}/athletes/${id}`);}catch(e){if(e instanceof SourceBlockedError)throw e;return null;}});
   for(const a of profiles){const cid=idOf(a?.college?.$ref);if(cid&&!xw.college[cid]){try{const c=await getJSON(`${CORE.replace('/sports/golf','')}/colleges/${cid}`);xw.college[cid]={id:cid,name:c.name||c.shortName||null,mascot:c.mascot||null};}catch{xw.college[cid]={id:cid,name:null};}}}
   const acap=unknown.length?await archive(env,db,`${CORE}/leagues/${item.league}/athletes#bundle:${item.event_id}`,{athletes:profiles,colleges:Object.fromEntries(profiles.map(a=>idOf(a?.college?.$ref)).filter(Boolean).map(c=>[c,xw.college[c]]))}):null;
   const facts=new Map(profiles.filter(Boolean).map(a=>{const f=athleteFacts(a,xw.college[idOf(a.college?.$ref)]);return [f.espn_id,f];}));
   const {match,supersede}=matchEdition(ev,item.league,editions);
   const plan=new Plan(),cfg=LEAGUES[item.league],isMajor=Boolean(match?.rules?.is_major);
   // Tournament + edition identity.
   let edId,edKey,tId;
   if(match){edId=match.id;tId=match.tournament_id;edKey=null;if(ev.tournament_id&&!xw.tournament[item.league+':'+ev.tournament_id])xw.tournament[item.league+':'+ev.tournament_id]=tId;}
   else{
    tId=xw.tournament[item.league+':'+ev.tournament_id]||null;
    if(!tId){const tn=ev.name.replace(/^\d{4}\s+/,'');tId=await plan.add('golf_tournaments','espn:'+item.league+':'+ev.tournament_id,cap.id,{name:tn,slug:slug(tn,'e'+item.league.replace(/[^a-z]/g,'')+ev.tournament_id),major_division:null,organizer:'Not supplied by source'});xw.tournament[item.league+':'+ev.tournament_id]=tId;}
    edKey='espn:'+item.league+':'+ev.espn_id;
   }
   const old=match||{};
   const espnRules={event_id:ev.espn_id,league:item.league,tour_label:cfg.label,tournament_id:ev.tournament_id,purse:ev.purse,purse_text:ev.purse_text,defending_champion_espn:ev.defending_champion_espn,winner_espn:ev.winner_espn,course:p.course?{espn_id:p.course.espn_id,name:p.course.name,city:p.course.city,state:p.course.state,country:p.course.country,par:p.course.par,yards:p.course.yards}:null,capture_id:cap.id,parser:ESPN_PARSER,fetched_at:bundle.fetched_at,status:ev.status_name,rounds_played:ev.rounds_played,field_size:p.rows.length,conflicts:[]};
   const status=ev.completed?'completed':ev.status_name==='STATUS_IN_PROGRESS'?'in_progress':ev.status_name==='STATUS_SCHEDULED'?'scheduled':old.status||'unknown';
   // Field-level merge on the edition row: keep existing values; fill nulls from ESPN.
   const edRow={tournament_id:tId,edition_key:String(item.season&&match?old.edition_key:(ev.ends_on||ev.starts_on||String(item.season)).slice(0,4)),starts_on:old.starts_on||ev.starts_on,ends_on:old.ends_on||ev.ends_on,status:old.status==='completed'?'completed':status,format:'stroke',completed_rounds:ev.rounds_played||null,rules:{...(old.rules||{}),...(match?{}:{source_name:ev.name,division:cfg.division,is_major:false,series_key:null}),espn:espnRules}};
   if(match){plan.rows.push({table:'golf_tournament_editions',row:{id:edId,capture_id:cap.id,...edRow}});
    // Duplicates of the canonical edition are retired by pointer (no deletes); their rows stay for audit.
    for(const dupId of supersede){const d=editions.find(x=>x.id===dupId);if(!d)continue;d.rules={...(d.rules||{}),superseded_by:edId,superseded_reason:'duplicate of canonical edition (same event, dates and name)'};plan.rows.push({table:'golf_tournament_editions',row:{id:d.id,capture_id:cap.id,tournament_id:d.tournament_id,edition_key:d.edition_key,starts_on:d.starts_on,ends_on:d.ends_on,status:d.status,format:'stroke',rules:d.rules}});}
    if(ev.tournament_id)xw.tournament[item.league+':'+ev.tournament_id]=tId;}
   else edId=await plan.add('golf_tournament_editions',edKey,cap.id,edRow);
   if(cfg.tour&&!etours.some(x=>x.edition_id===edId&&x.tour_id===tourIds[cfg.tour])){await plan.add('golf_edition_tours',(edKey||edId)+':'+cfg.tour,cap.id,{edition_id:edId,tour_id:tourIds[cfg.tour]});etours.push({edition_id:edId,tour_id:tourIds[cfg.tour]});}
   // Course + setup layout.
   let courseId=null,layoutId=null;const ecs=match?await db('golf_edition_courses','select=layout_id,golf_course_layouts(id,course_id,version_label,par)&edition_id=eq.'+edId):[];
   const setup=ecs.map(x=>x.golf_course_layouts).find(l=>l&&!/metadata only/i.test(l.version_label));
   if(p.course){
    courseId=setup?.course_id||ecs[0]?.golf_course_layouts?.course_id||xw.course[p.course.espn_id]||null;
    if(!courseId){const same=courseByName.get(norm(p.course.name))||[];if(same.length===1)courseId=same[0].id;}
    if(!courseId){courseId=await plan.add('golf_courses','espn:course:'+p.course.espn_id,cap.id,{name:p.course.name,slug:slug(p.course.name,'ec'+p.course.espn_id),country_code:null,locality:[p.course.city,p.course.state].filter(Boolean).join(', ')||null,latitude:null,longitude:null});courseByName.set(norm(p.course.name),[{id:courseId,name:p.course.name}]);}
    xw.course[p.course.espn_id]=courseId;
    if(setup){layoutId=setup.id;if(setup.par&&p.course.par&&setup.par!==p.course.par)espnRules.conflicts.push({field:'layout.par',existing:setup.par,espn:p.course.par});}
    else{layoutId=await plan.add('golf_course_layouts',(edKey||edId)+':espn-setup',cap.id,{course_id:courseId,version_label:`${item.season} ${ev.name.replace(/^\d{4}\s+/,'')} setup (ESPN)`,valid_from:ev.starts_on,valid_to:ev.ends_on,par:p.course.par,yardage:p.course.yards,routing_basis:null,specifications:{source:'espn',event_id:ev.espn_id,espn_course_id:p.course.espn_id,routing:'not sourced; no hole routing or hazards inferred'}});
     await plan.add('golf_edition_courses',(edKey||edId)+':espn-setup',cap.id,{edition_id:edId,layout_id:layoutId,usage_role:'championship setup per ESPN event course'});}
   }
   const holeRows=layoutId?await db('golf_holes','select=id,hole_number,par&layout_id=eq.'+layoutId):[];const holeId=new Map(holeRows.map(h=>[h.hole_number,h]));
   const writeHoles=holesPolicy(item.league,item.season,isMajor)&&layoutId&&p.course?.holes?.length===18;
   if(writeHoles&&!holeRows.length)for(const h of p.course.holes)holeId.set(h.hole,{id:await plan.add('golf_holes',(edKey||edId)+':espn-setup:'+h.hole,cap.id,{layout_id:layoutId,hole_number:h.hole,par:h.par,yardage:h.yards,routing:null,routing_observed:false}),par:h.par});
   // Existing rows for this edition (reused, never clobbered).
   const [eEntries,eResults,eRounds,eCards]=match?await Promise.all([db('golf_entries','select=id,player_id,status&edition_id=eq.'+edId+'&limit=1000'),db('golf_results','select=*,golf_source_captures(source_id)&edition_id=eq.'+edId+'&limit=1000'),db('golf_rounds','select=id,round_number&edition_id=eq.'+edId),db('golf_scorecards','select=id,entry_id,round_id,strokes,holes_completed,golf_source_captures(source_id)&edition_id=eq.'+edId+'&limit=5000')]):[[],[],[],[]];
   const entryByPlayer=new Map(eEntries.map(x=>[x.player_id,x])),resultByEntry=new Map(eResults.map(r=>[r.entry_id,r])),roundId=new Map(eRounds.map(r=>[r.round_number,r.id]));
   const cardKey=new Map(eCards.map(c=>[c.entry_id+':'+c.round_id,c]));
   const editionPlayers=new Set(eEntries.map(x=>x.player_id)),crossed=new Set(crosswalk.values());
   // Result-level corroboration inside an edition another source already describes.
   const resultMatch=r=>{if(!eResults.length||r.finish_status!=='finished')return {n:0};const m=eResults.filter(x=>x.finish_status==='finished'&&x.position===r.position&&(x.strokes===null||x.strokes===r.total));const free=m.map(x=>eEntries.find(e=>e.id===x.entry_id)).filter(e=>e&&!crossed.has(e.player_id));return {n:m.length,free};};
   for(let n=1;n<=ev.rounds_played;n++)if(!roundId.has(n))roundId.set(n,await plan.add('golf_rounds',(edKey||edId)+':espn:R'+n,cap.id,{edition_id:edId,round_number:n,status:ev.completed?'completed':'unknown',started_at:null,completed_at:null,regulation_holes:18}));
   const groups=new Map();
   for(const r of p.rows){
    const f=facts.get(r.espn_id)||{espn_id:r.espn_id,name:null};
    let pid=crosswalk.get(r.espn_id);
    if(pid&&match&&!editionPlayers.has(pid)&&eResults.length){const rm=resultMatch(r);if(rm.free?.length){plan.hold({kind:'player',provider_id:'espn:'+r.espn_id+':'+edId,reason:'possible_duplicate_identity',capture_id:cap.id,detail:{espn_player:pid,existing_candidates:rm.free.map(e=>e.player_id)}});out.held_identities++;continue;}}
    if(!pid&&match){const rm=resultMatch(r);if(rm.free?.length===1&&rm.n===1){pid=rm.free[0].player_id;out.resolved_players++;await plan.add('golf_player_identities','espn:'+r.espn_id,acap?.id||cap.id,{player_id:pid,source_id:'espn',provider_id:r.espn_id,evidence:{basis:'same edition + identical finishing position and total in another source',league:item.league,...f,profile_url:`${CORE}/leagues/${item.league}/athletes/${r.espn_id}`},verified_at:new Date().toISOString().slice(0,10)+'T00:00:00Z'});crosswalk.set(r.espn_id,pid);crossed.add(pid);}
     else if(rm.n>0&&!(byName.get(norm(f.name||''))||[]).length){plan.hold({kind:'player',provider_id:'espn:'+r.espn_id,reason:'ambiguous_result_match_in_described_edition',capture_id:cap.id,detail:{name:f.name}});out.held_identities++;continue;}}
    if(!pid){
     if(!f.name){plan.hold({kind:'player',provider_id:'espn:'+r.espn_id,reason:'espn_profile_unavailable',capture_id:cap.id});out.held_identities++;continue;}
     const res=resolveAthlete(f,{crosswalk,byName,editionPlayers});
     if(res.status==='hold'){plan.hold({kind:'player',provider_id:'espn:'+r.espn_id,reason:'espn_identity_'+res.reason,capture_id:acap?.id||cap.id,detail:{name:f.name,birth_date:f.birth_date,candidates:res.candidates}});out.held_identities++;continue;}
     if(res.status==='new'){pid=await plan.add('golf_players','espn:'+r.espn_id,acap?.id||cap.id,{full_name:f.name,slug:slug(f.name,'e'+r.espn_id),birth_date:f.birth_date,nationality_code:null,identity_status:'verified'});out.new_players++;byName.set(norm(f.name),[...(byName.get(norm(f.name))||[]),{id:pid,full_name:f.name,birth_date:f.birth_date}]);}
     else{pid=res.player_id;out.resolved_players++;}
     await plan.add('golf_player_identities','espn:'+r.espn_id,acap?.id||cap.id,{player_id:pid,source_id:'espn',provider_id:r.espn_id,evidence:{basis:res.basis,league:item.league,...f,profile_url:`${CORE}/leagues/${item.league}/athletes/${r.espn_id}`},verified_at:new Date().toISOString().slice(0,10)+'T00:00:00Z'});
     crosswalk.set(r.espn_id,pid);crossed.add(pid);
    }
    const oldEntry=entryByPlayer.get(pid);
    const entryId=oldEntry?.id||await plan.add('golf_entries',(edKey||edId)+':p:'+pid,cap.id,{edition_id:edId,player_id:pid,status:r.finish_status});
    if(!oldEntry)entryByPlayer.set(pid,{id:entryId});
    const oldRes=resultByEntry.get(entryId);
    const espnRes={edition_id:edId,entry_id:entryId,position:r.position??null,tied:r.tied??null,strokes:r.finish_status==='finished'?r.total:null,score_to_par:r.finish_status==='finished'&&r.rounds.length?r.rounds.reduce((s,x)=>s+(x.to_par??0),0):null,finish_status:r.finish_status,winner:r.winner?true:r.finish_status==='finished'?false:null,winning_margin:null};
    if(oldRes){
     if(oldRes.golf_source_captures?.source_id!=='espn')for(const k of ['position','strokes','finish_status'])if(oldRes[k]!==null&&espnRes[k]!==null&&oldRes[k]!==espnRes[k]){espnRules.conflicts.push({entry:entryId,field:k,existing:oldRes[k],espn:espnRes[k]});}
     const own=oldRes.golf_source_captures?.source_id==='espn';
     const merged={...espnRes};if(!own)for(const k of Object.keys(merged))if(oldRes[k]!==null&&oldRes[k]!==undefined&&!(k==='finish_status'&&oldRes[k]==='unknown'))merged[k]=oldRes[k];
     plan.rows.push({table:'golf_results',row:{id:oldRes.id,capture_id:own?cap.id:oldRes.capture_id,...merged}});
    }else await plan.add('golf_results',(edKey||edId)+':r:'+pid,cap.id,espnRes);
    for(const rd of r.rounds){
     const rid=roundId.get(rd.round);if(!rid||!layoutId)continue;const oc=cardKey.get(entryId+':'+rid);
     const ownCard=oc&&oc.golf_source_captures?.source_id==='espn';
     if(ownCard&&(oc.strokes!==rd.strokes||oc.holes_completed<18))plan.rows.push({table:'golf_scorecards',row:{id:oc.id,capture_id:cap.id,edition_id:edId,round_id:rid,entry_id:entryId,layout_id:layoutId,strokes:rd.strokes,score_to_par:rd.to_par,holes_completed:rd.holes.length||18,status:'completed'}});
     else if(oc&&oc.strokes!==rd.strokes){espnRules.conflicts.push({entry:entryId,round:rd.round,field:'round_strokes',existing:oc.strokes,espn:rd.strokes});continue;}
     const cid=oc?.id||await plan.add('golf_scorecards',(edKey||edId)+':'+pid+':R'+rd.round,cap.id,{edition_id:edId,round_id:rid,entry_id:entryId,layout_id:layoutId,strokes:rd.strokes,score_to_par:rd.to_par,holes_completed:rd.holes.length||18,status:'completed'});
     if(writeHoles&&rd.holes.length===18&&holeId.size===18&&rd.holes.reduce((s,h)=>s+h.strokes,0)===rd.strokes)for(const h of rd.holes){const H=holeId.get(h.hole);if(!H)continue;if(H.par&&h.par&&H.par!==h.par)continue;await plan.add('golf_hole_scores',cid+':H'+h.hole,cap.id,{scorecard_id:cid,layout_id:layoutId,hole_id:H.id,strokes:h.strokes,score_to_par:h.par?h.strokes-h.par:null,status:'completed'});}
     if(rd.tee_time){const gk=rd.round+':'+(rd.group||rd.tee_time+'@'+(rd.start_tee||1));let gid=groups.get(gk);if(!gid){gid=await plan.add('golf_groups',edId+':'+gk,cap.id,{edition_id:edId,round_number:rd.round,source_group_key:gk});groups.set(gk,gid);}
      await plan.add('golf_tee_times',gid+':'+entryId,cap.id,{group_id:gid,edition_id:edId,entry_id:entryId,tee_at:rd.tee_time,starting_hole:rd.start_tee||null});}
    }
   }
   espnRules.conflict_count=espnRules.conflicts.length;espnRules.conflicts=espnRules.conflicts.slice(0,40);out.conflicts+=espnRules.conflict_count;
   for(const h of plan.held.filter(h=>h.kind==='player'&&h.capture_id))plan.rows.push({table:'golf_identity_queue',row:{id:await stableId('golf_identity_queue:'+h.provider_id),capture_id:h.capture_id,source_id:'espn',provider_id:h.provider_id,candidates:h.detail?.candidates||[],evidence:h,status:'pending'}});
   const c=await writePlan(db,plan.rows);out.inserted+=c.inserted;out.updated+=c.updated;out.unchanged+=c.unchanged;out.processed++;
   if(!match)editions.push({id:edId,tournament_id:tId,edition_key:edRow.edition_key,starts_on:edRow.starts_on,ends_on:edRow.ends_on,rules:edRow.rules,year:Number(edRow.edition_key),tours:cfg.tour?[cfg.tour==='pga-tour'?'PGA Tour':'LPGA Tour']:[]});
   item.status=ev.completed?'ok':'open';item.checked_at=new Date().toISOString();item.matched=Boolean(match);item.detail={rows:p.rows.length,conflicts:espnRules.conflict_count,holes:Boolean(writeHoles)};
   // Live events refresh every 30 minutes while rounds are being played; scheduled ones every 6 hours.
   const playing=!ev.completed&&ev.rounds_played>0||(!ev.completed&&ev.starts_on&&Date.parse(ev.starts_on)<=t&&Date.parse(ev.ends_on||ev.starts_on)+DAY>=t);
   item.next_at=ev.completed?t+(Date.parse(ev.ends_on||0)>t-30*DAY?2*DAY:60*DAY):playing?t+30*60000:t+6*3600000;item.attempts=0;
  }catch(e){
   if(e instanceof SourceBlockedError){delete item.in_progress;item.status='blocked';items[key]=item;await env.STATE.put(KEY,JSON.stringify(items));await env.STATE.put(XW,JSON.stringify(xw));throw e;}
   // Upstream 5xx after a bounded retry: back off this item and end the run (circuit breaker).
   if(e.name==='UpstreamBusy'||/source_http_5\d\d/.test(e.message)){item.status='pending';item.detail={backoff:String(e.message).slice(0,120)};item.next_at=t+15*60000;out.upstream_busy=true;out.errors++;items[key]=item;break;}
   item.status='error';item.attempts=(item.attempts||0)+1;item.detail={error:String(e.message).slice(0,300)};item.next_at=t+(item.attempts>=3?7*DAY:3600000);out.errors++;
  }finally{delete item.in_progress;items[key]=item;await env.STATE.put(KEY,JSON.stringify(items));await env.STATE.put(XW,JSON.stringify(xw));}
 }
 return out;
}
