// Pure planners: parsed source observations + verified identities -> canonical rows.
// Canonical IDs are deterministic (stableId) so reruns are idempotent and corrections are updates.
import {stableId} from '../../shared/store.js';
import {SERIES} from './wdqs.js';
import {finalRoundHoles,WP_PARSER} from './wikipedia.js';
export const slug=(name,id)=>name.normalize('NFKD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+'-'+String(id).toLowerCase().replace(/[^a-z0-9]+/g,'');
export const TOURS={'pga-tour':{qid:'Q910409',division:'men'},'lpga':{qid:'Q17162079',division:'women'}};
export const tourId=key=>stableId('golf_tours:'+TOURS[key].qid);
export const seriesByQid=new Map(SERIES.map(s=>[s.qid,s]));
const ID=(table,key)=>stableId(table+':'+key);
export class Plan{constructor(){this.rows=[];this.held=[];}async add(table,key,capture_id,fields){const id=await ID(table,key);this.rows.push({table,row:{id,capture_id,...fields}});return id;}hold(item){this.held.push(item);}}
// A person enters the canonical graph only as a distinct Wikidata human classified as a golfer.
// Golf context (linked from a leaderboard row, or asserted as a championship winner) can stand in for a
// missing golf classification on Wikidata; the entity must still be a distinct human with a name.
export function playerEligible(f,context=null){return Boolean(f&&f.qid&&f.name&&f.human&&(f.golfer||context));}
export async function planPlayer(plan,f,context=null){
 if(!playerEligible(f,context)){plan.hold({kind:'player',provider_id:f?.qid,reason:'identity_requires_human_golfer',capture_id:f?.capture_id});return null;}
 const id=await plan.add('golf_players',f.qid,f.capture_id,{full_name:f.name,slug:slug(f.name,f.qid),birth_date:f.birth_date,nationality_code:f.country?.iso||null,identity_status:'verified'});
 await plan.add('golf_player_identities',f.qid,f.capture_id,{player_id:id,source_id:'wikidata',provider_id:f.qid,evidence:{basis:f.golfer?'distinct Wikidata human entity classified as golfer (sport or occupation); no cross-source name merge':'distinct Wikidata human entity in golf context ('+context+'); no cross-source name merge',name_source:f.name_source||'wikidata_label',entity_modified:f.modified,country_name:f.country?.label||null,country_qid:f.country?.qid||null,citizenships:f.citizenships,sport_countries:f.sport_countries,sex:f.sex,birth_year:f.birth_year,external_ids:f.external_ids,image:f.image,enwiki_article:f.article,reference_status:'source assertions; references retained in capture, not independently reverified'},verified_at:'2026-10-01T00:00:00Z'});
 return id;
}
export function editionStatus({winner,starts_on,ends_on,year,cancelled},today){
 if(cancelled)return 'cancelled';if(winner)return 'completed';
 if(starts_on&&starts_on>today)return 'scheduled';if(!starts_on&&ends_on&&ends_on>today)return 'scheduled';
 if(starts_on&&ends_on&&starts_on<=today&&ends_on>=today)return 'in_progress';
 if(!starts_on&&!ends_on&&year>Number(today.slice(0,4)))return 'scheduled';
 return 'unknown';
}
export async function planCatalog({series,editions,players,venues,existing},now=new Date()){
 const plan=new Plan(),today=now.toISOString().slice(0,10),pmap=new Map(players.map(p=>[p.qid,p])),vmap=new Map(venues.map(v=>[v.qid,v]));
 const tids=new Map(),pids=new Map(),cids=new Map(),seenKey=new Set();
 for(const s of series){const cfg=seriesByQid.get(s.qid);if(!cfg||!s.name){plan.hold({kind:'tournament',provider_id:s.qid,reason:'missing_series_label'});continue;}
  tids.set(s.qid,await plan.add('golf_tournaments',s.qid,s.capture_id,{name:s.name,slug:slug(s.name,s.qid),major_division:cfg.major_from?cfg.division:null,organizer:s.organizer||'Not supplied by source'}));}
 for(const v of venues){if(!v.golf_venue||!v.name){plan.hold({kind:'course',provider_id:v.qid,reason:'venue_not_verified_as_golf_course'});continue;}
  const cid=await plan.add('golf_courses',v.qid,v.capture_id,{name:v.name,slug:slug(v.name,v.qid),country_code:v.country_code,locality:v.locality,latitude:v.latitude,longitude:v.longitude});cids.set(v.qid,cid);
  await plan.add('golf_course_layouts',v.qid+':metadata',v.capture_id,{course_id:cid,version_label:'Venue metadata only; tournament routing unavailable',par:null,yardage:null,routing_basis:null,specifications:{coverage:'venue identity only',wikidata_id:v.qid,description:v.description,country_name:v.country_name,architects:v.architects,opened_year:v.opened_year,image:v.image,enwiki_article:v.article,entity_modified:v.modified}});}
 for(const p of players){const id=await planPlayer(plan,p,'championship_winner_assertion');if(id)pids.set(p.qid,id);}
 for(const e of editions){
  const cfg=seriesByQid.get(e.series),tid=tids.get(e.series);if(!cfg||!tid)continue;
  const key=e.series+':'+e.year;if(seenKey.has(key)){plan.hold({kind:'edition',provider_id:e.qid,reason:'duplicate_series_year'});continue;}seenKey.add(key);
  const old=existing.editions.get(await ID('golf_tournament_editions',e.qid));
  const winner=e.winners.length===1&&pids.has(e.winners[0])?e.winners[0]:null,venue=e.venues.filter(v=>cids.has(v));
  const starts_on=e.starts_on||old?.starts_on||null,ends_on=e.ends_on||old?.ends_on||null,point=e.points.length===1?e.points[0]:null;
  const rules={...(old?.rules||{}),source_name:e.label,wikidata_id:e.qid,venue_wikidata_id:venue.length===1?venue[0]:null,winner_wikidata_id:winner,date_precision:point?.precision??null,source_date:point?.time??null,coverage:old?.rules?.results?'see results coverage':'catalog edition; winner assertion where supplied',source_revision:e.modified,series_key:cfg.key,division:cfg.division,is_major:Boolean(cfg.major_from&&e.year>=cfg.major_from),enwiki_article:e.article};
  delete rules.claim_references;
  if(e.winners.length>1)plan.hold({kind:'edition_winner',provider_id:e.qid,reason:'multiple_winner_assertions'});
  const eid=await plan.add('golf_tournament_editions',e.qid,e.capture_id,{tournament_id:tid,edition_key:String(e.year),starts_on,ends_on,status:editionStatus({winner,starts_on,ends_on,year:e.year},today),format:old?.format&&old.format!=='other'?old.format:'stroke',rules});
  if(venue.length===1)await plan.add('golf_edition_courses',e.qid+':'+venue[0],e.capture_id,{edition_id:eid,layout_id:await ID('golf_course_layouts',venue[0]+':metadata'),usage_role:'source-reported venue; layout unverified'});
  // Winner rows from the catalog only seed editions the results lane has not described yet.
  if(winner&&!old?.rules?.results){const entry=await plan.add('golf_entries',e.qid+':'+winner,e.capture_id,{edition_id:eid,player_id:pids.get(winner),status:'finished'});await plan.add('golf_results',e.qid+':winner',e.capture_id,{edition_id:eid,entry_id:entry,position:1,tied:null,strokes:null,score_to_par:null,finish_status:'finished',winner:true,winning_margin:null});}
 }
 return plan;
}
// Results for one edition article. `edition` = {id,key,year,winnerQid,old,name,venueQid}. Identity maps are verified.
export async function planResults({edition,parsed,capture,titleToQid,facts,course},now=new Date()){
 const plan=new Plan(),cap=capture.id,today=now.toISOString().slice(0,10);
 const resolved=parsed.rows.map(r=>{const q=r.player.title?titleToQid.get(r.player.title):null,f=q?facts.get(q):null;return {...r,qid:q||null,fact:f||null};});
 // Tied first place (playoff) is resolved only by the Wikidata champion assertion, matched by QID.
 const tiedFirst=resolved.filter(r=>r.status==='finished'&&r.position===1&&r.tied);
 if(tiedFirst.length>1&&edition.winnerQid&&tiedFirst.some(r=>r.qid===edition.winnerQid)){const losers=tiedFirst.filter(r=>r.qid!==edition.winnerQid);for(const r of tiedFirst){if(r.qid===edition.winnerQid){r.tied=false;r.playoff='won';}else{r.position=2;r.tied=losers.length>1;r.playoff='lost';}}parsed.playoff=true;}
 const firsts=resolved.filter(r=>r.status==='finished'&&r.position===1&&!r.tied);
 if(edition.winnerQid&&firsts.length===1&&firsts[0].qid!==edition.winnerQid){plan.hold({kind:'edition_results',provider_id:edition.key,reason:'winner_conflict_between_sources',detail:{wikidata:edition.winnerQid,article:firsts[0].qid}});return {plan,summary:{status:'held',reason:'winner_conflict'}};}
 const pids=new Map();
 for(const r of resolved){
  if(!r.player.title){plan.hold({kind:'player',provider_id:'enwiki-unlinked:'+edition.key+':'+r.player.name,reason:'leaderboard_row_without_linked_identity',capture_id:cap,detail:{name:r.player.name,place:r.place_text}});continue;}
  if(!r.qid){plan.hold({kind:'player',provider_id:'enwiki:'+r.player.title,reason:'article_without_wikidata_item',capture_id:cap});continue;}
  if(pids.has(r.qid))continue;
  if(r.fact?.existing){pids.set(r.qid,r.fact._id);continue;}
  const id=await planPlayer(plan,r.fact||{qid:r.qid,capture_id:cap},'linked_from_leaderboard_row');if(id)pids.set(r.qid,id);
 }
 const old=edition.old||{},ib=parsed.infobox||{};
 const par=parsed.course?.par??ib.par??null,yards=parsed.course?.yards??ib.yards??null;
 const starts_on=old.starts_on||ib.starts_on||edition.starts_on||null,ends_on=old.ends_on||ib.ends_on||edition.ends_on||null;
 const listed=resolved.length,stored=resolved.filter(r=>pids.has(r.qid)).length,inconsistent=resolved.filter(r=>r.score_consistent===false).length;
 const results={source:'wikipedia',article:capture.title,revision:capture.revision,capture_id:cap,parser:WP_PARSER,coverage:parsed.coverage,rounds_played:parsed.rounds_played,playoff:parsed.playoff,field_size:ib.field_size??null,made_cut:ib.made_cut??null,rows_listed:listed,rows_stored:stored,rows_without_identity:listed-stored,rows_with_inconsistent_scores:inconsistent,cut:parsed.cut,par,yardage:yards,course_table:Boolean(parsed.course),hole_scorecards:0,licence:'CC BY-SA 4.0',attribution:`Wikipedia contributors, "${capture.title}" (revision ${capture.revision})`};
 const winnerRow=resolved.find(r=>r.status==='finished'&&r.position===1&&!r.tied&&pids.has(r.qid));
 const status=edition.cancelled?'cancelled':winnerRow||edition.winnerQid?'completed':editionStatus({winner:null,starts_on,ends_on,year:edition.year},today);
 const eid=edition.id;
 plan.rows.push({table:'golf_tournament_editions',row:{id:eid,capture_id:cap,tournament_id:old.tournament_id||edition.tournament_id,edition_key:String(edition.year),starts_on,ends_on,status,format:'stroke',completed_rounds:parsed.rounds_played||null,rules:{...(old.rules||{}),...(edition.rulesPatch||{}),results}}});
 let layout=null;const holeIds=[];
 if(course){
  layout=await plan.add('golf_course_layouts',edition.key+':setup',cap,{course_id:course.id,version_label:`${edition.year} ${edition.name} championship setup`,valid_from:starts_on,valid_to:ends_on,par,yardage:yards,routing_basis:null,specifications:{source:'wikipedia',article:capture.title,revision:capture.revision,hole_table:Boolean(parsed.course),par_source:parsed.course?'course table':ib.par?'infobox':null,yardage_source:parsed.course?.yards?'course table':ib.yards?'infobox':null,routing:'not sourced; no hole routing or hazards inferred'}});
  if(parsed.course)for(const h of parsed.course.holes)holeIds[h.hole]=await plan.add('golf_holes',edition.key+':setup:'+h.hole,cap,{layout_id:layout,hole_number:h.hole,par:h.par,yardage:h.yards,routing:null,routing_observed:false});
  await plan.add('golf_edition_courses',edition.key+':setup',cap,{edition_id:eid,layout_id:layout,usage_role:'championship setup published in source article'});
 }
 const rounds=[];for(let n=1;n<=parsed.rounds_played;n++)rounds[n]=await plan.add('golf_rounds',edition.key+':R'+n,cap,{edition_id:eid,round_number:n,status:'completed',started_at:null,completed_at:null,regulation_holes:18});
 const holeRows=new Map(finalRoundHoles(parsed).map(h=>[h.player_title,h]));
 const finishers=resolved.filter(r=>r.status==='finished'&&Number.isInteger(r.total)&&r.score_consistent);
 for(const r of resolved){
  const pid=pids.get(r.qid);if(!pid)continue;
  const isWinner=r===winnerRow,entry=await plan.add('golf_entries',edition.key+':'+r.qid,cap,{edition_id:eid,player_id:pid,status:r.status==='unknown'?'unknown':r.status});
  const consistent=r.score_consistent===true&&r.rounds.length>0;
  const second=isWinner?finishers.filter(x=>x!==r).sort((a,b)=>a.total-b.total)[0]:null;
  await plan.add('golf_results',isWinner||(edition.winnerQid===r.qid&&r.position===1)?edition.key+':winner':edition.key+':'+r.qid,cap,{edition_id:eid,entry_id:entry,position:r.position,tied:r.tied,strokes:consistent&&r.rounds.length===parsed.rounds_played&&r.status==='finished'?r.total:null,score_to_par:r.status==='finished'?r.to_par:null,finish_status:r.status,winner:isWinner?true:r.status==='finished'?false:null,winning_margin:isWinner&&second&&consistent&&parsed.coverage!=='top_finishers'?(r.playoff==='won'?0:second.total-r.total):isWinner&&r.playoff==='won'?0:null});
  if(!consistent||!layout){if(!consistent&&r.rounds.length)plan.hold({kind:'round_scores',provider_id:edition.key+':'+r.qid,reason:'published_round_scores_do_not_sum_to_total',capture_id:cap});continue;}
  for(let i=0;i<r.rounds.length&&i<parsed.rounds_played;i++){
   const n=i+1,strokes=r.rounds[i];if(strokes<55||strokes>99)continue;
   const sc=await plan.add('golf_scorecards',edition.key+':'+r.qid+':R'+n,cap,{edition_id:eid,round_id:rounds[n],entry_id:entry,layout_id:layout,strokes,score_to_par:par?strokes-par:null,holes_completed:18,status:'completed'});
   const h=holeRows.get(r.player.title);
   if(h&&n===h.round&&holeIds[1]){results.hole_scorecards++;for(let k=0;k<18;k++)await plan.add('golf_hole_scores',edition.key+':'+r.qid+':R'+n+':H'+(k+1),cap,{scorecard_id:sc,layout_id:layout,hole_id:holeIds[k+1],strokes:h.strokes[k],score_to_par:h.strokes[k]-parsed.course.holes[k].par,status:'completed'});}
  }
 }
 return {plan,summary:{status:'ok',coverage:parsed.coverage,listed,stored,held:plan.held.length,hole_scorecards:results.hole_scorecards}};
}
