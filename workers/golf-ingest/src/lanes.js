// Production lanes. Each lane = one approved source, one durable lease, bounded work per run.
import {SourceBlockedError} from '../../shared/http.js';
import {stableId} from '../../shared/store.js';
import {capture,qid} from './capture.js';
import {fetchSeries,fetchEditions,fetchPlayers,fetchVenues,SERIES} from './wdqs.js';
import {parseEditionArticle,parseSeasonArticle,WP_PARSER} from './wikipedia.js';
import {planCatalog,planResults,planPlayer,Plan,slug,TOURS,tourId,seriesByQid,editionStatus} from './plan.js';
import {writePlan} from './writer.js';
export const RESULTS_FROM=2000;
const ITEMS='items:v1';
const DAY=86400000;
export async function loadItems(env){try{return JSON.parse(await env.STATE.get(ITEMS)||'{}');}catch{return {};}}
export async function saveItems(env,items){await env.STATE.put(ITEMS,JSON.stringify(items));}
async function all(db,table,select,extra=''){const out=[];for(let off=0;;off+=1000){const page=await db(table,`select=${select}${extra}&order=id&limit=1000&offset=${off}`);out.push(...page);if(page.length<1000)return out;}}
async function existingEditions(db){return new Map((await all(db,'golf_tournament_editions','id,tournament_id,edition_key,starts_on,ends_on,status,format,rules')).map(e=>[e.id,e]));}
async function existingPlayerIds(db){return new Map((await all(db,'golf_player_identities','player_id,provider_id','&source_id=eq.wikidata')).map(r=>[r.provider_id,r.player_id]));}
const wpApi=params=>'https://en.wikipedia.org/w/api.php?'+new URLSearchParams({format:'json',formatversion:'2',...params});
// Article title -> Wikidata QID through documented page properties (sitelinks), redirects followed.
export async function resolveTitles(env,db,titles){
 const map=new Map(),uniq=[...new Set(titles.filter(Boolean))];
 for(let i=0;i<uniq.length;i+=50){
  const chunk=uniq.slice(i,i+50),c=await capture(env,db,'wikipedia',wpApi({action:'query',prop:'pageprops',ppprop:'wikibase_item',redirects:'1',titles:chunk.join('|')}),{parser:WP_PARSER});
  const b=JSON.parse(c.text).query||{},alias=new Map();
  for(const n of b.normalized||[])alias.set(n.from,n.to);for(const r of b.redirects||[])alias.set(r.from,r.to);
  const byTitle=new Map((b.pages||[]).filter(p=>p.pageprops?.wikibase_item).map(p=>[p.title,p.pageprops.wikibase_item]));
  for(const t of chunk){let x=t;for(let k=0;k<3&&alias.has(x);k++)x=alias.get(x);if(byTitle.has(x))map.set(t,byTitle.get(x));}
 }
 return map;
}
async function fetchArticle(env,db,title){
 const c=await capture(env,db,'wikipedia',wpApi({action:'parse',page:title,prop:'text|revid|displaytitle',redirects:'1',disablelimitreport:'1'}),{parser:WP_PARSER,maxBytes:5000000});
 const b=JSON.parse(c.text);if(b.error?.code==='missingtitle')return {missing:true,capture:c};if(!b.parse?.text)throw Error('invalid_parse_response');
 return {html:b.parse.text,capture:{...c,title:b.parse.title,revision:String(b.parse.revid)}};
}
async function revisions(env,db,titles){
 const out=new Map();for(let i=0;i<titles.length;i+=50){const chunk=titles.slice(i,i+50);
  const c=await capture(env,db,'wikipedia',wpApi({action:'query',prop:'revisions',rvprop:'ids',redirects:'1',titles:chunk.join('|')}),{parser:WP_PARSER});
  const b=JSON.parse(c.text).query||{},alias=new Map([...(b.normalized||[]),...(b.redirects||[])].map(x=>[x.from,x.to]));
  const rev=new Map((b.pages||[]).map(p=>[p.title,p.missing?'missing':String(p.revisions?.[0]?.revid||'')]));
  for(const t of chunk){let x=t;for(let k=0;k<3&&alias.has(x);k++)x=alias.get(x);out.set(t,rev.get(x)||null);}}
 return out;
}
async function ensurePlayers(env,db,qids,known){
 const missing=[...new Set(qids)].filter(q=>q&&!known.has(q));if(!missing.length)return new Map();
 const {players}=await fetchPlayers(env,db,missing);return new Map(players.map(p=>[p.qid,p]));
}
async function courseFor(env,db,titleMap,candidates,venueQid){
 const tried=[];for(const t of candidates){const q=titleMap.get(t);if(q)tried.push(q);}if(venueQid)tried.push(venueQid);
 for(const q of [...new Set(tried)]){
  const id=await stableId('golf_courses:'+q);
  if((await db('golf_courses','select=id&id=eq.'+id)).length)return {id,qid:q,plan:null};
  const [v]=await fetchVenues(env,db,[q]);if(!v?.golf_venue||!v.name)continue;
  const plan=new Plan();await plan.add('golf_courses',v.qid,v.capture_id,{name:v.name,slug:slug(v.name,v.qid),country_code:v.country_code,locality:v.locality,latitude:v.latitude,longitude:v.longitude});
  await plan.add('golf_course_layouts',v.qid+':metadata',v.capture_id,{course_id:id,version_label:'Venue metadata only; tournament routing unavailable',par:null,yardage:null,routing_basis:null,specifications:{coverage:'venue identity only',wikidata_id:v.qid,description:v.description,country_name:v.country_name,architects:v.architects,opened_year:v.opened_year,image:v.image,enwiki_article:v.article,entity_modified:v.modified}});
  return {id,qid:q,plan};
 }
 return null;
}
async function state(db,source,patch){await db('golf_source_state','source_id=eq.'+source,{method:'PATCH',headers:{prefer:'return=minimal'},body:JSON.stringify(patch)});}
async function holdQueue(db,plan){
 // Identity review queue rows for unresolved people; never merged by name.
 const rows=[];for(const h of plan.held.filter(h=>h.kind==='player'&&h.capture_id&&h.provider_id))rows.push({table:'golf_identity_queue',row:{id:await stableId('golf_identity_queue:'+h.provider_id),capture_id:h.capture_id,source_id:h.provider_id.startsWith('Q')?'wikidata':'wikipedia',provider_id:h.provider_id,candidates:[],evidence:h,status:'pending'}});
 return rows;
}
export async function runCatalog(env,db,now=new Date()){
 const series=await fetchSeries(env,db),{capture:edCapture,editions}=await fetchEditions(env,db);
 for(const e of editions)e.capture_id=edCapture.id;
 const venues=await fetchVenues(env,db,[...new Set(editions.flatMap(e=>e.venues))]);
 const {players}=await fetchPlayers(env,db,[...new Set(editions.flatMap(e=>e.winners))]);
 await state(db,'wikidata',{last_parse:new Date().toISOString()});
 const plan=await planCatalog({series,editions,players,venues,existing:{editions:await existingEditions(db)}},now);
 plan.rows.push(...await holdQueue(db,plan));
 const counts=await writePlan(db,plan.rows);
 const items=await loadItems(env);let queued=0;
 for(const e of editions)if(e.article&&e.year>=RESULTS_FROM&&seriesByQid.has(e.series)){const k='edition:'+e.qid;if(!items[k]){items[k]={kind:'edition',source:'wikipedia',title:e.article,edition_qid:e.qid,status:'pending',next_at:0};queued++;}else items[k].title=e.article;}
 await saveItems(env,items);
 return {lane:'catalog',editions:editions.length,players:players.length,venues:venues.length,read:plan.rows.length,...counts,held:plan.held.length,identity_conflicts:plan.held.filter(h=>h.kind==='player').length,queued};
}
// Tour season articles: current schedule, dates, sanctioning and winners for PGA TOUR and LPGA.
export async function runSchedule(env,db,now=new Date()){
 const year=now.getUTCFullYear(),today=now.toISOString().slice(0,10),items=await loadItems(env),existing=await existingEditions(db),known=await existingPlayerIds(db);
 const out={lane:'schedule',seasons:[],events:0,inserted:0,updated:0,unchanged:0,held:0,queued:0},plannedTournaments=new Map();
 const wdEditions=new Map([...existing.values()].filter(e=>e.rules?.wikidata_id&&e.rules?.series_key).map(e=>[e.rules.series_key+':'+e.edition_key,e]));
 for(const y of [year,year-1,year-2])for(const tour of ['pga-tour','lpga']){
  const title=`${y} ${tour==='pga-tour'?'PGA Tour':'LPGA Tour'}`,art=await fetchArticle(env,db,title);if(art.missing){out.seasons.push({title,status:'missing'});continue;}
  const events=parseSeasonArticle(art.html,y),cap=art.capture.id;out.events+=events.length;
  const titleMap=await resolveTitles(env,db,[...events.map(e=>e.title),...events.map(e=>e.winner?.title)]);
  const facts=await ensurePlayers(env,db,events.map(e=>e.winner?.title&&titleMap.get(e.winner.title)),known);
  const plan=new Plan(),seenEd=new Set(),tid=await tourId(tour);
  for(const ev of events){
   if(!ev.title){plan.hold({kind:'schedule_event',provider_id:title+':'+ev.name,reason:'event_without_linked_article'});continue;}
   const sq=titleMap.get(ev.title)||null,cfg=sq?seriesByQid.get(sq):null;
   let eid,edKey;
   if(cfg){const wd=wdEditions.get(cfg.key+':'+y);if(!wd){plan.hold({kind:'schedule_event',provider_id:ev.title,reason:'major_edition_not_in_catalog'});continue;}eid=wd.id;edKey=wd.rules.wikidata_id;}
   else{
    const tKey=sq||'enwiki:'+ev.title;edKey='wp:'+tKey+':'+y;if(seenEd.has(edKey)){plan.hold({kind:'schedule_event',provider_id:edKey,reason:'series_listed_twice_in_season'});continue;}seenEd.add(edKey);
    // One name per series per run: the most recent season's article title wins (sponsor renames).
    let tId=plannedTournaments.get(tKey);
    if(!tId){tId=await plan.add('golf_tournaments',tKey,cap,{name:ev.title.replace(/ \([^)]*\)$/,''),slug:slug(ev.title.replace(/ \([^)]*\)$/,''),sq||'wp'),major_division:null,organizer:'Not supplied by source'});plannedTournaments.set(tKey,tId);}
    const old=existing.get(await stableId('golf_tournament_editions:'+edKey));
    const wq=ev.winner?.title?titleMap.get(ev.winner.title):null,wf=wq?facts.get(wq):null;let wpid=wq?known.get(wq):null;
    if(wq&&!wpid&&wf){wpid=await planPlayer(plan,wf,'tour_schedule_winner');if(wpid)known.set(wq,wpid);}
    const starts_on=old?.starts_on||ev.starts_on,ends_on=ev.ends_on||old?.ends_on||null;
    const rules={...(old?.rules||{}),source_name:`${y} ${ev.name}`,schedule:{article:art.capture.title,revision:art.capture.revision,tour,date_text:ev.date_text,location:ev.location,purse_text:ev.purse_text,winner_title:ev.winner?.title||null,winner_text:ev.winner_text},series_key:null,division:TOURS[tour].division,is_major:false,enwiki_article:old?.rules?.enwiki_article||null,winner_wikidata_id:wpid?wq:null};
    eid=await plan.add('golf_tournament_editions',edKey,cap,{tournament_id:tId,edition_key:String(y),starts_on,ends_on,status:editionStatus({winner:wpid,starts_on,ends_on,year:y,cancelled:ev.cancelled},today),format:'stroke',rules});
    if(wpid&&!old?.rules?.results){const entry=await plan.add('golf_entries',edKey+':'+wq,cap,{edition_id:eid,player_id:wpid,status:'finished'});await plan.add('golf_results',edKey+':winner',cap,{edition_id:eid,entry_id:entry,position:1,tied:null,strokes:null,score_to_par:null,finish_status:'finished',winner:true,winning_margin:null});}
    // Edition article candidate: verified after fetch against this schedule's winner.
    const k='event:'+edKey;if(!items[k]&&!ev.cancelled){items[k]={kind:'event',source:'wikipedia',title:`${y} ${ev.title.replace(/ \([^)]*\)$/,'')}`,edition_key:edKey,expected_winner:ev.winner?.title||null,status:'pending',next_at:0};out.queued++;}
    else if(items[k])items[k].expected_winner=ev.winner?.title||null;
   }
   await plan.add('golf_edition_tours',edKey+':'+tour,cap,{edition_id:eid,tour_id:tid});
  }
  plan.rows.push(...await holdQueue(db,plan));
  const c=await writePlan(db,plan.rows);out.inserted+=c.inserted;out.updated+=c.updated;out.unchanged+=c.unchanged;out.held+=plan.held.length;out.seasons.push({title,revision:art.capture.revision,events:events.length});
 }
 await saveItems(env,items);return out;
}
function nextCheck(item,edition,now){
 const t=now.getTime(),end=edition?.ends_on?Date.parse(edition.ends_on):null;
 if(item.status==='missing')return t+7*DAY;
 if(item.status==='error')return t+(item.attempts>=3?7*DAY:12*3600000);
 if(end&&t-end<45*DAY)return t+6*3600000;
 if(!end&&edition?.status!=='completed')return t+12*3600000;
 return t+30*DAY;
}
export async function runResults(env,db,{budgetMs=240000,limit=60,now=new Date()}={}){
 const started=Date.now(),items=await loadItems(env),existing=await existingEditions(db),known=await existingPlayerIds(db);
 const t=now.getTime(),due=Object.entries(items).filter(([,i])=>i.source==='wikipedia'&&(i.next_at||0)<=t).sort((a,b)=>(a[1].checked_at?1:0)-(b[1].checked_at?1:0)||(a[1].next_at||0)-(b[1].next_at||0)).slice(0,limit);
 const out={lane:'results',due:due.length,processed:0,skipped_same_revision:0,missing:0,held:0,errors:0,inserted:0,updated:0,unchanged:0,rows:0,hole_scorecards:0};
 // Cheap revision check first: unchanged articles are not refetched.
 const recheck=due.filter(([,i])=>i.revision&&i.status==='ok').map(([,i])=>i.title),revs=recheck.length?await revisions(env,db,recheck):new Map();
 for(const [key,item] of due){
  if(Date.now()-started>budgetMs)break;
  const edId=await stableId('golf_tournament_editions:'+(item.edition_qid||item.edition_key)),old=existing.get(edId);
  if(!old){item.status='held';item.detail={reason:'edition_not_in_canonical_graph'};item.next_at=t+DAY;continue;}
  if(item.revision&&item.status==='ok'&&revs.get(item.title)===item.revision){item.checked_at=new Date().toISOString();item.next_at=nextCheck(item,old,now);out.skipped_same_revision++;continue;}
  // A run that dies mid-item (resource limit) leaves this marker; the retry counts as a failed attempt.
  if(item.in_progress){item.attempts=(item.attempts||0)+1;item.status='error';item.detail={error:'previous_attempt_did_not_complete'};delete item.in_progress;if(item.attempts>=3){item.next_at=t+7*DAY;items[key]=item;await saveItems(env,items);continue;}}
  item.in_progress=new Date().toISOString();items[key]=item;await saveItems(env,items);
  console.log(JSON.stringify({lane:'results',item:key,title:item.title}));
  try{
   const art=await fetchArticle(env,db,item.title);item.checked_at=new Date().toISOString();
   if(art.missing){item.status='missing';item.next_at=nextCheck(item,old,now);out.missing++;continue;}
   const parsed=parseEditionArticle(art.html,{winnerTitle:item.expected_winner||null});
   const titles=[...parsed.rows.map(r=>r.player.title),...(parsed.infobox?.courses||[])];
   const titleMap=await resolveTitles(env,db,titles);
   // Event articles found by title convention must agree with the tour schedule's winner.
   if(item.kind==='event'){const w=parsed.rows.find(r=>r.position===1&&!r.tied&&r.status==='finished');if(!item.expected_winner||!w||w.player.title!==item.expected_winner){item.status='held';item.detail={reason:'article_does_not_match_schedule_winner'};item.next_at=t+7*DAY;out.held++;continue;}}
   if(!parsed.rows.length){item.status='held';item.detail={reason:'no_leaderboard_table'};item.revision=art.capture.revision;item.next_at=t+30*DAY;out.held++;continue;}
   const qids=[...new Set(parsed.rows.map(r=>titleMap.get(r.player.title)).filter(Boolean))],facts=await ensurePlayers(env,db,qids,known);
   for(const q of qids)if(known.has(q)&&!facts.has(q))facts.set(q,{qid:q,existing:true});
   const course=await courseFor(env,db,titleMap,parsed.infobox?.courses||[],old.rules?.venue_wikidata_id);
   const tname=(await db('golf_tournaments','select=name&id=eq.'+old.tournament_id))[0]?.name||'';
   const edition={id:edId,key:item.edition_qid||item.edition_key,year:Number(old.edition_key),winnerQid:old.rules?.winner_wikidata_id||null,old,name:tname,tournament_id:old.tournament_id,starts_on:old.starts_on,ends_on:old.ends_on,rulesPatch:item.kind==='event'?{enwiki_article:art.capture.title}:{}};
   const {plan,summary}=await planResults({edition,parsed,capture:art.capture,titleToQid:titleMap,facts:new Map([...facts].map(([q,f])=>[q,f.existing?{...f,_id:known.get(q)}:f])),course},now);
   if(summary.status==='held'){item.status='held';item.detail=summary;item.revision=art.capture.revision;item.next_at=t+7*DAY;out.held++;continue;}
   // Existing players keep their stored identity rows (no rewrite); new ones are planned from facts.
   if(course?.plan)plan.rows.unshift(...course.plan.rows);
   plan.rows.push(...await holdQueue(db,plan));
   const c=await writePlan(db,plan.rows);
   for(const r of plan.rows)if(r.table==='golf_player_identities')known.set(r.row.provider_id,r.row.player_id);
   out.inserted+=c.inserted;out.updated+=c.updated;out.unchanged+=c.unchanged;out.rows+=plan.rows.length;out.held+=plan.held.length;out.hole_scorecards+=summary.hole_scorecards;out.processed++;
   item.status='ok';item.revision=art.capture.revision;item.attempts=0;item.detail={coverage:summary.coverage,listed:summary.listed,stored:summary.stored,held:summary.held};item.next_at=nextCheck(item,old,now);
  }catch(e){
   if(e instanceof SourceBlockedError){item.status='blocked';await saveItems(env,items);throw e;}
   item.status='error';item.attempts=(item.attempts||0)+1;item.detail={error:String(e.message).slice(0,300)};item.next_at=nextCheck(item,old,now);out.errors++;
  }finally{delete item.in_progress;items[key]=item;await saveItems(env,items);}
 }
 await saveItems(env,items);return out;
}
