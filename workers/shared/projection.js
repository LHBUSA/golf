// Public projection: canonical SPORTS rows -> derived, versioned public documents in R2.
// Every derived number names its method, sample, cohort and coverage. Unknown stays null.
import {DNA_METHOD,COURSE_METHOD,FIT_METHOD,DIMENSIONS,HELD,playerMetrics,rankCohort,tier,mean,sd,round1,round2,percentileOf} from './dna.js';
export const PROJECTION_VERSION='golf-projection/2.0.0';
const DAY=86400000;
async function all(db,table,select,filter=''){const out=[];for(let off=0;;off+=1000){const page=await db(table,`select=${select}${filter}&order=id&limit=1000&offset=${off}`);out.push(...page);if(page.length<1000)return out;}}
export async function loadGraph(db){
 const spec={
  tours:['golf_tours','id,name,slug,division'],tournaments:['golf_tournaments','id,name,slug,major_division,organizer'],
  editions:['golf_tournament_editions','id,tournament_id,edition_key,starts_on,ends_on,status,completed_rounds,rules,capture_id'],
  editionTours:['golf_edition_tours','edition_id,tour_id'],courses:['golf_courses','id,name,slug,country_code,locality,latitude,longitude,capture_id'],
  layouts:['golf_course_layouts','id,course_id,version_label,valid_from,par,yardage,specifications'],holes:['golf_holes','id,layout_id,hole_number,par,yardage'],
  editionCourses:['golf_edition_courses','edition_id,layout_id,usage_role'],players:['golf_players','id,full_name,slug,birth_date,nationality_code,capture_id'],
  identities:['golf_player_identities','player_id,provider_id,source_id,country_name:evidence->>country_name,sex:evidence->>sex,external_ids:evidence->external_ids,birth_year:evidence->>birth_year,article:evidence->>enwiki_article,espn:evidence'],
  entries:['golf_entries','id,edition_id,player_id,status'],results:['golf_results','edition_id,entry_id,position,tied,strokes,score_to_par,finish_status,winner,winning_margin'],
  rounds:['golf_rounds','id,edition_id,round_number'],
  media:['golf_entity_media','player_id,course_id,author,licence,licence_url,attribution,source_url,sha256,width,height,identity_proof,rights_status','&rights_status=eq.approved'],
  seasonStats:['golf_player_season_stats','player_id,value,sample_size,effective_on,capture_id,golf_stat_definitions(code),golf_seasons(label,tour_id)'],
  captures:['golf_source_captures','id,source_id,source_url,captured_at,sha256,parser_version,rights_version'],
  sources:['golf_source_state','source_id,status,last_write,last_capture,last_parse,records_held,identity_conflicts,last_error,parser_version']
 };
 const keys=Object.keys(spec),data=await Promise.all(keys.map(k=>k==='sources'?db(spec[k][0],'select='+spec[k][1]):all(db,...spec[k])));
 const g=Object.fromEntries(keys.map((k,i)=>[k,data[i]]));
 // Scorecards stream into compact per-entry arrays (memory-bounded for the Worker).
 const roundNo=new Map(g.rounds.map(r=>[r.id,r.round_number]));g.cardsByEntry=new Map();g.counts={scorecards:0};
 for(let off=0;;off+=1000){const page=await db('golf_scorecards',`select=entry_id,round_id,strokes,score_to_par&or=(holes_completed.is.null,holes_completed.gte.18)&order=id&limit=1000&offset=${off}`);for(const c of page){let a=g.cardsByEntry.get(c.entry_id);if(!a){a=[];g.cardsByEntry.set(c.entry_id,a);}a.push({round:roundNo.get(c.round_id),strokes:c.strokes,to_par:c.score_to_par});g.counts.scorecards++;}if(page.length<1000)break;}
 return g;
}
const by=(rows,key)=>{const m=new Map();for(const r of rows){const k=r[key];if(!m.has(k))m.set(k,[]);m.get(k).push(r);}return m;};
const age=(birth,asOf)=>{if(!birth)return null;const b=new Date(birth+'T00:00:00Z'),a=new Date(asOf);let y=a.getUTCFullYear()-b.getUTCFullYear();if(a.getUTCMonth()<b.getUTCMonth()||(a.getUTCMonth()===b.getUTCMonth()&&a.getUTCDate()<b.getUTCDate()))y--;return y;};
const SERIES_NAMES={'masters':'Masters Tournament','pga-championship':'PGA Championship','us-open':'U.S. Open','the-open':'The Open Championship','players':'The Players Championship','chevron':'Chevron Championship','us-womens-open':'U.S. Women’s Open','womens-pga':'Women’s PGA Championship','evian':'The Evian Championship','womens-open':'Women’s Open'};
// Hole scores for one edition, keyed by entry id + round number. Scorecards first, then hole rows by
// scorecard id in bounded chunks (indexed), instead of one embedded join over the whole hole table.
export async function editionHoles(db,editionId){
 const out=new Map();
 const cards=await db('golf_scorecards',`select=id,entry_id,golf_rounds(round_number)&edition_id=eq.${editionId}&or=(holes_completed.is.null,holes_completed.gte.18)&limit=6000`);
 const byCard=new Map(cards.map(c=>[c.id,c.entry_id+':'+c.golf_rounds?.round_number]));
 const ids=[...byCard.keys()];
 for(let i=0;i<ids.length;i+=150){const chunk=ids.slice(i,i+150);
  for(let off=0;;off+=3000){const page=await db('golf_hole_scores',`select=scorecard_id,strokes,score_to_par,golf_holes(hole_number)&scorecard_id=in.(${chunk.join(',')})&order=id&limit=3000&offset=${off}`);
   for(const h of page){const k=byCard.get(h.scorecard_id);if(!k)continue;if(!out.has(k))out.set(k,[]);out.get(k).push({hole:h.golf_holes?.hole_number,strokes:h.strokes,to_par:h.score_to_par});}
   if(page.length<3000)break;}}
 for(const a of out.values())a.sort((x,y)=>x.hole-y.hole);return out;
}
// Per-edition hole maps are cached in R2 under a change signature (source fetch time + capture + status),
// so a projection only re-reads editions whose hole data can have changed.
export function holesCache(db,env){
 const memo=new Map();
 return async e=>{
  if(memo.has(e.id))return memo.get(e.id);
  const sig=[e.espn?.fetched_at||'',e.provenance?.id||'',e.status||'',e.coverage||'',e.layout?.id||''].join('|'),key='projection/cache/holes/'+e.id+'.json';
  // Editions still being played are always read fresh.
  if(e.status!=='completed'){const m=await editionHoles(db,e.id);memo.set(e.id,m);return m;}
  let m=null;
  try{const o=await env?.PUBLIC?.get(key);if(o){const c=JSON.parse(await o.text());if(c.sig===sig)m=new Map(c.entries);}}catch{}
  if(!m){m=await editionHoles(db,e.id);try{await env?.PUBLIC?.put(key,JSON.stringify({sig,entries:[...m]}),{httpMetadata:{contentType:'application/json'}});}catch{}}
  memo.set(e.id,m);return m;
 };
}
export function bioOf(x){if(!x)return null;return {source:'ESPN',espn_id:x.espn_id||null,birth_place:x.birth_place?[x.birth_place.city,x.birth_place.state,x.birth_place.country].filter(Boolean).join(', '):null,college:x.college?.name||null,turned_pro:x.turned_pro||null,tour_debut:x.debut_year||null,hand:x.hand||null,height_in:x.height_in||null,weight_lb:x.weight_lb||null,verified_at:x.verified_at||null,profile_url:x.profile_url||null};}
export function prepare(g,{asOf=new Date().toISOString(),derivatives=new Set()}={}){
 const today=asOf.slice(0,10),asOfMs=Date.parse(asOf);
 const tournaments=new Map(g.tournaments.map(t=>[t.id,t])),tours=new Map(g.tours.map(t=>[t.id,t])),courses=new Map(g.courses.map(c=>[c.id,c])),layouts=new Map(g.layouts.map(l=>[l.id,l]));
 const holesByLayout=by(g.holes,'layout_id'),ecByEdition=by(g.editionCourses,'edition_id'),toursByEdition=by(g.editionTours,'edition_id');
 const captures=new Map(g.captures.map(c=>[c.id,{id:c.id,source:c.source_id,captured_at:c.captured_at,sha256:c.sha256,parser:c.parser_version,rights:c.rights_version}]));
 const media=(kind,id)=>{const m=g.media.find(x=>x[kind+'_id']===id);if(!m)return null;return {sha256:m.sha256,width:m.width,height:m.height,author:m.author,licence:m.licence,licence_url:m.licence_url,attribution:m.attribution,source_url:m.source_url,derivatives:derivatives.has(m.sha256),restrictions:m.identity_proof?.restrictions||null};};
 const thumb=ph=>ph?{sha256:ph.sha256,width:ph.width,height:ph.height,derivatives:ph.derivatives}:null;
 const ident=new Map(g.identities.filter(i=>i.source_id!=='espn').map(i=>[i.player_id,{...i,espn:undefined}]));
 const espnIdent=new Map(g.identities.filter(i=>i.source_id==='espn').map(i=>[i.player_id,i.espn]));
 const espnToPlayer=new Map(g.identities.filter(i=>i.source_id==='espn').map(i=>[i.provider_id,i.player_id]));
 // ---- editions
 const editions=g.editions.filter(e=>!e.rules?.superseded_by).map(e=>{
  const t=tournaments.get(e.tournament_id),r=e.rules||{},ecs=ecByEdition.get(e.id)||[];
  const setup=ecs.map(x=>layouts.get(x.layout_id)).find(l=>l&&!/metadata only/i.test(l.version_label));
  const meta=ecs.map(x=>layouts.get(x.layout_id)).find(l=>l&&/metadata only/i.test(l.version_label));
  const course=courses.get((setup||meta)?.course_id)||null;
  const tourNames=(toursByEdition.get(e.id)||[]).map(x=>tours.get(x.tour_id)?.name).filter(Boolean);
  const division=r.division||t?.major_division||((toursByEdition.get(e.id)||[]).map(x=>tours.get(x.tour_id)?.division)[0])||null;
  const res=r.results||null;
  return {id:e.id,slug:(t?.slug||e.id)+'-'+e.edition_key,name:r.source_name||((e.edition_key+' '+(t?.name||'')).trim()),tournament_id:e.tournament_id,tournament:t?{id:t.id,name:t.name,slug:t.slug}:null,series_key:r.series_key||null,year:Number(e.edition_key),starts_on:e.starts_on,ends_on:e.ends_on,status:e.status,division,is_major:Boolean(r.is_major),tours:tourNames,course:course?{id:course.id,name:course.name,slug:course.slug}:null,layout:setup?{id:setup.id,label:setup.version_label,par:setup.par,yardage:setup.yardage,holes:(holesByLayout.get(setup.id)||[]).sort((a,b)=>a.hole_number-b.hole_number).map(h=>({hole:h.hole_number,par:h.par,yards:h.yardage}))}:null,coverage:r.espn?.field_size&&r.espn?.rounds_played&&e.status==='completed'?'full_field':res?.coverage||(r.winner_wikidata_id||r.espn?.winner_espn?'winner_only':'schedule_only'),espn:r.espn?{event_id:r.espn.event_id,league:r.espn.league,tour_label:r.espn.tour_label,purse_text:r.espn.purse_text,course:r.espn.course,field_size:r.espn.field_size||null,rounds_played:r.espn.rounds_played||null,defending_champion_espn:r.espn.defending_champion_espn,conflict_count:r.espn.conflict_count||0,fetched_at:r.espn.fetched_at}:null,results_source:res?{article:res.article,revision:res.revision,licence:res.licence,attribution:res.attribution,field_size:res.field_size,made_cut:res.made_cut,rows_listed:res.rows_listed,rows_stored:res.rows_stored,rows_without_identity:res.rows_without_identity,rows_with_inconsistent_scores:res.rows_with_inconsistent_scores,rounds_played:res.rounds_played,playoff:res.playoff,cut:res.cut}:null,schedule:r.schedule?{tour:r.schedule.tour,location:r.schedule.location,purse_text:r.schedule.purse_text,date_text:r.schedule.date_text}:null,par:setup?.par??res?.par??null,provenance:captures.get(e.capture_id)||null,date_precision:r.date_precision??null,source_date:r.source_date??null};
 });
 const edById=new Map(editions.map(e=>[e.id,e]));
 // ---- entries/results/rounds
 const resultByEntry=new Map(g.results.map(r=>[r.entry_id,r])),roundNo=new Map(g.rounds.map(r=>[r.id,r.round_number])),cardsByEntry=g.cardsByEntry||new Map([...by(g.scorecards||[],'entry_id')].map(([k,v])=>[k,v.map(c=>({round:roundNo.get(c.round_id),strokes:c.strokes,to_par:c.score_to_par}))]));
 const entries=g.entries.map(en=>{const r=resultByEntry.get(en.id)||{},e=edById.get(en.edition_id);const cards=(cardsByEntry.get(en.id)||[]).slice().sort((a,b)=>a.round-b.round);
  return {id:en.id,edition_id:en.edition_id,player_id:en.player_id,status:r.finish_status||en.status,position:r.position??null,tied:r.tied??null,strokes:r.strokes??null,to_par:r.score_to_par??null,winner:r.winner===true,margin:r.winning_margin??null,rounds:cards,e};}).filter(x=>x.e&&x.player_id);
 const resultsCount=g.results.length;g.entries=null;g.results=null;g.cardsByEntry=null; // release raw rows (Worker memory)
 const entriesByEdition=by(entries,'edition_id'),entriesByPlayer=by(entries,'player_id');
 // Coverage is earned by stored rows, not by a source's declared field size.
 for(const e of editions)if(e.coverage==='full_field'&&e.espn?.field_size&&!e.results_source){const n=(entriesByEdition.get(e.id)||[]).length;if(n<0.8*e.espn.field_size)e.coverage=n?'partial_field':'schedule_only';}
 // Field averages per round, full-field editions only (survivorship is handled by per-round fields).
 const fieldMean=new Map();
 for(const e of editions){if(e.coverage!=='full_field')continue;const es=entriesByEdition.get(e.id)||[];const rounds=new Map();for(const x of es)for(const c of x.rounds){if(!rounds.has(c.round))rounds.set(c.round,[]);rounds.get(c.round).push(c.strokes);}for(const [n,arr] of rounds)if(arr.length>=20)fieldMean.set(e.id+':'+n,{mean:mean(arr),n:arr.length,sd:sd(arr)});}
 const delta=(x,c)=>{const f=fieldMean.get(x.edition_id+':'+c.round);return f?f.mean-c.strokes:null;};
 // ---- players
 const players=g.players.map(p=>{const i=ident.get(p.id)||{};const es=(entriesByPlayer.get(p.id)||[]);const divs=es.map(x=>x.e.division).filter(Boolean);const division=divs.length?(divs.filter(d=>d==='women').length>divs.length/2?'women':'men'):i.sex==='female'?'women':i.sex==='male'?'men':null;
  return {id:p.id,slug:p.slug,name:p.full_name,birth_date:p.birth_date,birth_year:p.birth_date?Number(p.birth_date.slice(0,4)):i.birth_year?Number(i.birth_year):null,age:age(p.birth_date,asOf),country:i.country_name||espnIdent.get(p.id)?.citizenship||null,country_code:p.nationality_code,division:division||(espnIdent.get(p.id)?.gender==='FEMALE'?'women':espnIdent.get(p.id)?.gender==='MALE'?'men':null),external_ids:{...(i.external_ids||{}),...(espnIdent.get(p.id)?{espn:espnIdent.get(p.id).espn_id}:{})},wikidata_id:i.provider_id||null,bio:bioOf(espnIdent.get(p.id)),photo:media('player',p.id),provenance:captures.get(p.capture_id)||null};});
 const playerById=new Map(players.map(p=>[p.id,p]));
 const espnPlayer=id=>{const p=playerById.get(espnToPlayer.get(String(id)));return p?{slug:p.slug,name:p.name,photo:p.photo}:null;};
 // ---- DNA per division and window (time-safe: only editions ending on/before asOf)
 const windows=[{key:'l24m',label:'Last 24 months',from:new Date(asOfMs-730*DAY).toISOString().slice(0,10)},{key:'all',label:'All observed (2000–present)',from:'2000-01-01'}];
 const dna=new Map();
 for(const w of windows)for(const div of ['men','women']){
  const cohort=[];
  for(const p of players){if(p.division!==div)continue;
   const es=(entriesByPlayer.get(p.id)||[]).filter(x=>x.e.division===div&&x.e.coverage==='full_field'&&(x.e.ends_on||x.e.year+'-12-31')<=today&&(x.e.ends_on||x.e.year+'-12-31')>=w.from);
   if(!es.length)continue;
   const rounds=[],starts=[];
   for(const x of es){starts.push({edition_id:x.edition_id,status:x.status,position:x.position,ends:x.e.ends_on||String(x.e.year),major:x.e.is_major});for(const c of x.rounds)rounds.push({edition_id:x.edition_id,delta:delta(x,c),toPar:c.to_par,major:x.e.is_major});}
   cohort.push({player_id:p.id,metrics:playerMetrics(rounds,starts),editions:es.length});
  }
  rankCohort(cohort);for(const c of cohort){if(!dna.has(c.player_id))dna.set(c.player_id,{});dna.get(c.player_id)[w.key]={division:div,window:w,cohort:div==='women'?'Women’s majors + LPGA events with full-field leaderboards':'Men’s majors + PGA TOUR events with full-field leaderboards',editions:c.editions,metrics:c.metrics};}
 }
 // ---- course DNA
 const courseStats=new Map();
 for(const c of g.courses){
  const eds=(editions.filter(e=>e.course?.id===c.id)).sort((a,b)=>b.year-a.year),full=eds.filter(e=>e.coverage==='full_field'&&e.par);
  const roundToPar=[],spreads=[],under=[];
  for(const e of full){const es=entriesByEdition.get(e.id)||[];const cards=es.flatMap(x=>x.rounds);const tp=cards.map(r=>r.strokes-e.par);roundToPar.push(mean(tp));spreads.push(sd(cards.map(r=>r.strokes)));under.push(100*tp.filter(v=>v<0).length/(tp.length||1));}
  const winners=eds.map(e=>(entriesByEdition.get(e.id)||[]).find(x=>x.winner)).filter(x=>x&&Number.isInteger(x.to_par));
  const cuts=eds.map(e=>e.results_source?.cut?.score_to_par).filter(Number.isInteger);
  const yards=eds.map(e=>e.layout?.yardage).filter(Number.isFinite);
  courseStats.set(c.id,{editions:eds,full,scoring:round2(mean(roundToPar)),spread:round2(mean(spreads.filter(Number.isFinite))),under:round1(mean(under)),win:round1(mean(winners.map(w=>w.to_par))),winN:winners.length,cut:round1(mean(cuts)),cutN:cuts.length,yards:yards.length?{latest:eds.find(e=>e.layout?.yardage)?.layout.yardage,min:Math.min(...yards),max:Math.max(...yards),n:yards.length}:null,division:eds[0]?.division||null});
 }
 const courseCohort=div=>[...courseStats.values()].filter(s=>s.division===div&&s.full.length>=2);
 const courseDna=(id)=>{const s=courseStats.get(id);if(!s)return null;const peers=courseCohort(s.division),t=tier('editions',s.full.length);
  const dim=(code,label,value,unit,sample,direction,definition,peerValues)=>({code,label,value,unit,sample,confidence:tier('editions',sample),percentile:tier('editions',sample)==='INSUFFICIENT'?null:percentileOf(value,peerValues.filter(Number.isFinite),direction),cohort_size:peerValues.filter(Number.isFinite).length,definition});
  return {method:COURSE_METHOD,division:s.division,edition_range:s.full.length?[s.full.at(-1).year,s.full[0].year]:null,full_field_editions:s.full.length,confidence:t,layout_versions:s.editions.filter(e=>e.layout).map(e=>({edition:e.slug,year:e.year,label:e.layout.label,par:e.layout.par,yardage:e.layout.yardage,holes:e.layout.holes.length})),
   dimensions:[dim('difficulty','Scoring difficulty',s.scoring,'field average strokes to par per round',s.full.length,'higher','Mean round score relative to published par across all players in full-field editions at this course. Higher = harder.',peers.map(p=>p.scoring)),
    dim('spread','Scoring spread',s.spread,'standard deviation of round scores',s.full.length,'higher','Average within-edition spread of round scores; higher separates the field more.',peers.map(p=>p.spread)),
    dim('birdie_window','Under-par rounds',s.under,'% of rounds under par',s.full.length,'higher','Share of all observed rounds under par in full-field editions.',peers.map(p=>p.under)),
    {code:'winning_score',label:'Winning score',value:s.win,unit:'average winner total to par',sample:s.winN,confidence:tier('editions',s.winN),percentile:null,definition:'Mean published winning total relative to par, all editions with leaderboards.'},
    {code:'cut_line',label:'Cut line',value:s.cut,unit:'average 36-hole cut to par',sample:s.cutN,confidence:tier('editions',s.cutN),percentile:null,definition:'Mean published cut line relative to par.'},
    {code:'length',label:'Length',value:s.yards?.latest??null,unit:'yards (latest published setup)',sample:s.yards?.n||0,confidence:s.yards?'SOURCED':'INSUFFICIENT',percentile:null,range:s.yards,definition:'Published championship setup yardage; each edition is a separate layout version.'}],
    };};
 // ---- per-player course history + fit
 function courseHistory(pid,courseId,before=null){
  const es=(entriesByPlayer.get(pid)||[]).filter(x=>x.e.course?.id===courseId&&(!before||(x.e.ends_on||x.e.year+'-12-31')<before));
  const full=es.filter(x=>x.e.coverage==='full_field'),made=full.filter(x=>x.status==='finished'),ds=full.flatMap(x=>x.rounds.map(c=>delta(x,c))).filter(Number.isFinite);
  const positions=es.map(x=>x.position).filter(Number.isInteger);
  return {appearances_observed:es.length,full_field_starts:full.length,cuts_made:made.length,wins:es.filter(x=>x.winner).length,top10:es.filter(x=>x.position&&x.position<=10).length,best_finish:positions.length?Math.min(...positions):null,avg_finish_made_cuts:round1(mean(made.map(x=>x.position).filter(Number.isInteger))),rounds:ds.length,scoring_vs_field:round2(mean(ds)),confidence:tier('rounds',ds.length),editions:es.map(x=>({slug:x.e.slug,year:x.e.year,position:x.position,tied:x.tied,status:x.status,to_par:x.to_par}))};
 }
 function fit(pid,courseId){
  const s=courseStats.get(courseId),d=dna.get(pid),ch=courseHistory(pid,courseId);if(!s)return null;
  const comps=[];
  comps.push({code:'course_history',label:'Course history',player:{value:ch.scoring_vs_field,unit:'strokes vs field per round here',sample:ch.rounds,confidence:ch.confidence,starts:ch.full_field_starts,best:ch.best_finish},course:null,interpretation:ch.confidence==='INSUFFICIENT'?'Insufficient observed rounds at this course.':ch.scoring_vs_field>0.5?'Observed scoring here is better than the field.':ch.scoring_vs_field<-0.5?'Observed scoring here trails the field.':'Observed scoring here is close to the field.'});
  // Difficulty alignment: player's field-adjusted scoring on setups at least as hard as this course.
  if(Number.isFinite(s.scoring)){const hard=s.scoring>=1;const es=(entriesByPlayer.get(pid)||[]).filter(x=>x.e.coverage==='full_field'&&x.e.par);const pick=es.filter(x=>{const cs=courseStats.get(x.e.course?.id);return cs&&Number.isFinite(cs.scoring)&&(hard?cs.scoring>=1:cs.scoring<1);});const ds=pick.flatMap(x=>x.rounds.map(c=>delta(x,c))).filter(Number.isFinite);
   comps.push({code:'difficulty',label:hard?'Difficult-setup performance':'Scoring-setup performance',course:{value:s.scoring,unit:'field strokes to par per round',editions:s.full.length},player:{value:round2(mean(ds)),unit:'strokes vs field on comparable setups',sample:ds.length,confidence:tier('rounds',ds.length)},interpretation:tier('rounds',ds.length)==='INSUFFICIENT'?'Insufficient comparable rounds.':mean(ds)>0.5?'Player has outscored fields on comparable setups.':mean(ds)<-0.5?'Player has trailed fields on comparable setups.':'Neutral on comparable setups.'});}
  if(s.yards){const long=s.division==='women'?6600:7400,isLong=s.yards.latest>=long;const es=(entriesByPlayer.get(pid)||[]).filter(x=>x.e.coverage==='full_field'&&x.e.layout?.yardage&&(isLong?x.e.layout.yardage>=long:x.e.layout.yardage<long));const ds=es.flatMap(x=>x.rounds.map(c=>delta(x,c))).filter(Number.isFinite);
   comps.push({code:'length',label:isLong?'Long-setup performance':'Shorter-setup performance',course:{value:s.yards.latest,unit:'yards (latest setup)'},player:{value:round2(mean(ds)),unit:'strokes vs field on comparable lengths',sample:ds.length,confidence:tier('rounds',ds.length)},interpretation:tier('rounds',ds.length)==='INSUFFICIENT'?'Insufficient comparable rounds.':mean(ds)>0.5?'Outscored fields on comparable lengths.':mean(ds)<-0.5?'Trailed fields on comparable lengths.':'Neutral on comparable lengths.'});}
  const form=d?.l24m?.metrics?.form;if(form)comps.push({code:'recent_form',label:'Recent form',player:{value:form.value,unit:'strokes vs field, last 10 full-field starts',sample:form.sample,confidence:form.confidence,percentile:form.percentile},course:null,interpretation:form.confidence==='INSUFFICIENT'?'Insufficient recent rounds.':'Percentile within division cohort shown; descriptive only.'});
  return {method:FIT_METHOD,overall_score:null,overall_reason:'No composite score: weights are not validated or backtested.',prediction:false,components:comps};
 }
 // ---- ESPN season statistics + Bag DNA (performance in bag-related areas; equipment gets no credit)
 const statsByPlayer=new Map();
 for(const r of g.seasonStats||[]){const code=r.golf_stat_definitions?.code,season=Number(r.golf_seasons?.label),tour=tours.get(r.golf_seasons?.tour_id)?.name;if(!code||!season)continue;const m=statsByPlayer.get(r.player_id)||{};const k=season+'|'+tour;(m[k]||={season,tour,as_of:r.effective_on,capture_id:r.capture_id,values:{}}).values[code]=Number(r.value);if(r.effective_on>m[k].as_of)m[k].as_of=r.effective_on;statsByPlayer.set(r.player_id,m);}
 const BAG=[['driver','Driver',[['yardsPerDrive','Distance','yards','higher'],['driveAccuracyPct','Accuracy','% fairways','higher']]],['irons','Irons / approach',[['greensInRegPct','Greens in regulation','% holes','higher']]],['short_game','Short game (sand)',[['savePct','Sand saves','% saved','higher']]],['putter','Putter',[['puttsGirAvg','Putts per GIR','putts','lower']]],['scoring','Scoring',[['scoringAverage','Scoring average','strokes','lower'],['birdiesPerRound','Birdies per round','birdies','higher']]]];
 const BAG_MIN_ROUNDS=20,bagPop=new Map();
 for(const [pid,m] of statsByPlayer)for(const v of Object.values(m)){if(!(v.values.roundsPlayed>=BAG_MIN_ROUNDS))continue;const k=v.season+'|'+v.tour;(bagPop.get(k)||bagPop.set(k,[]).get(k)).push(v.values);}
 function bagDna(pid){
  const m=statsByPlayer.get(pid);if(!m)return null;
  const latest=Object.values(m).filter(v=>v.values.roundsPlayed>=BAG_MIN_ROUNDS).sort((a,b)=>b.season-a.season)[0];
  if(!latest)return {available:false,reason:'Fewer than '+BAG_MIN_ROUNDS+' rounds in any ESPN season statistics in coverage.'};
  const pop=bagPop.get(latest.season+'|'+latest.tour)||[];
  const cats=BAG.map(([code,label,comps])=>{const parts=comps.map(([c,l,unit,dir])=>{const v=latest.values[c];const cohort=pop.map(x=>x[c]).filter(Number.isFinite);return {code:c,label:l,unit,value:Number.isFinite(v)?v:null,rank:latest.values[c+'_rank']??null,percentile:Number.isFinite(v)?percentileOf(v,cohort,dir):null,population:cohort.length};});
   const ok=parts.every(x=>x.percentile!==null);return {code,label,percentile:ok?Math.round(mean(parts.map(x=>x.percentile))):null,components:parts};});
  return {available:true,method:'golf-bag-dna/1.0.0',season:latest.season,tour:latest.tour,as_of:latest.as_of,source:'ESPN season statistics',population:pop.length,qualification:'>= '+BAG_MIN_ROUNDS+' rounds in the season',categories:cats,formula:'Each component is a mid-rank percentile within the same tour and season population; a category is the mean of its component percentiles.',disclosure:'Bag DNA grades the golfer’s observed performance profile. Equipment shown reflects the latest verified bag snapshot and is not assigned causal credit for performance.'};
 }
 const seasonStatsOf=pid=>{const m=statsByPlayer.get(pid);if(!m)return [];return Object.values(m).sort((a,b)=>b.season-a.season).map(v=>({season:v.season,tour:v.tour,as_of:v.as_of,source:'ESPN',values:Object.fromEntries(Object.entries(v.values).filter(([k])=>!k.endsWith('_rank'))),ranks:Object.fromEntries(Object.entries(v.values).filter(([k])=>k.endsWith('_rank')).map(([k,x])=>[k.slice(0,-5),x]))}));};
 // ---- par-type scoring from full-field hole-by-hole data (field-relative per hole)
 const entryPlayer=new Map(entries.map(x=>[x.id,x.player_id])),parAcc=new Map();const since24=new Date(asOfMs-730*DAY).toISOString().slice(0,10);
 function addEditionHoles(e,holeMap){
  if(e.coverage!=='full_field'||!holeMap.size||(e.ends_on||'')>today)return;
  const byHole=new Map();for(const [k,hs] of holeMap){const rnd=k.split(':').pop();for(const h of hs){const kk=rnd+':'+h.hole;(byHole.get(kk)||byHole.set(kk,[]).get(kk)).push(h.strokes);}}
  const avg=new Map([...byHole].filter(([,a])=>a.length>=20).map(([k,a])=>[k,mean(a)]));
  const recent=(e.ends_on||'')>=since24;
  for(const [k,hs] of holeMap){const [entry,rnd]=k.split(':');const pid=entryPlayer.get(entry);if(!pid)continue;const acc=parAcc.get(pid)||parAcc.set(pid,{all:{3:[0,0],4:[0,0],5:[0,0]},l24m:{3:[0,0],4:[0,0],5:[0,0]}}).get(pid);
   for(const h of hs){const f=avg.get(rnd+':'+h.hole),par=h.strokes-h.to_par;if(f===undefined||![3,4,5].includes(par))continue;const d=f-h.strokes;acc.all[par][0]+=d;acc.all[par][1]++;if(recent){acc.l24m[par][0]+=d;acc.l24m[par][1]++;}}}
 }
 function finalizePar(){
  for(const w of ['l24m','all'])for(const div of ['men','women'])for(const par of [3,4,5]){
   const rows=[];for(const [pid,acc] of parAcc){const d=dna.get(pid)?.[w];if(!d||d.division!==div)continue;const [sum,n]=acc[w][par];rows.push({pid,value:n?round2(sum/n):null,n});}
   const values=rows.filter(r=>r.value!==null&&tier('holes',r.n)!=='INSUFFICIENT').map(r=>r.value);
   for(const r of rows){const conf=tier('holes',r.n);dna.get(r.pid)[w].metrics['par'+par]={value:r.value,sample:r.n,basis:'holes',confidence:conf,cohort_size:values.length,percentile:conf==='INSUFFICIENT'?null:percentileOf(r.value,values,'higher')};}
  }
 }
 // ---- per-player visual series (descriptive, observed coverage only)
 function playerVisuals(es){
  const ended=x=>(x.e.ends_on||x.e.year+'-12-31')<=today;
  const full=es.filter(x=>x.e.coverage==='full_field'&&ended(x));
  const since=new Date(asOfMs-730*DAY).toISOString().slice(0,10);
  const form=full.filter(x=>(x.e.ends_on||'')>=since).map(x=>{const ds=x.rounds.map(c=>delta(x,c)).filter(Number.isFinite);return {slug:x.e.slug,name:x.e.name,ends_on:x.e.ends_on,major:x.e.is_major,position:x.position,tied:x.tied,status:x.status,rounds:ds.length,vs_field:ds.length?round2(mean(ds)):null};}).sort((a,b)=>String(a.ends_on).localeCompare(String(b.ends_on))).slice(-40);
  const roundProfile=w=>[1,2,3,4].map(n=>{const ds=full.filter(x=>!w||(x.e.ends_on||'')>=w).flatMap(x=>x.rounds.filter(c=>c.round===n).map(c=>delta(x,c))).filter(Number.isFinite);return {round:n,vs_field:ds.length?round2(mean(ds)):null,sample:ds.length,confidence:tier('rounds',ds.length)};});
  const dist=w=>{const xs=full.filter(x=>!w||(x.e.ends_on||'')>=w);const pos=x=>x.status==='finished'?x.position:null;return {starts:xs.length,wins:xs.filter(x=>x.winner).length,top5:xs.filter(x=>pos(x)&&pos(x)<=5).length,top10:xs.filter(x=>pos(x)&&pos(x)<=10).length,top25:xs.filter(x=>pos(x)&&pos(x)<=25).length,made_cut:xs.filter(x=>x.status==='finished').length,missed_cut:xs.filter(x=>x.status==='cut').length,wd_dq:xs.filter(x=>['withdrawn','disqualified'].includes(x.status)).length,unknown:xs.filter(x=>x.status==='unknown').length};};
  const majors={};for(const x of es.filter(x=>x.e.is_major&&x.e.series_key&&ended(x))){const m=majors[x.e.series_key]||={series_key:x.e.series_key,appearances:0,wins:0,top5:0,top10:0,best:null,rounds:0,_d:[],recent:[]};m.appearances++;if(x.winner)m.wins++;const p=x.status==='finished'?x.position:null;if(p&&p<=5)m.top5++;if(p&&p<=10)m.top10++;if(p&&(m.best===null||p<m.best))m.best=p;if(x.e.coverage==='full_field')for(const c of x.rounds){const d=delta(x,c);if(Number.isFinite(d)){m._d.push(d);m.rounds++;}}if(m.recent.length<5)m.recent.push({slug:x.e.slug,year:x.e.year,position:x.position,tied:x.tied,status:x.status});}
  for(const m of Object.values(majors)){m.vs_field=m._d.length?round2(mean(m._d)):null;m.confidence=tier('rounds',m.rounds);delete m._d;}
  const rounds=es.filter(ended).flatMap(x=>x.rounds.map(c=>({slug:x.e.slug,name:x.e.name,year:x.e.year,round:c.round,strokes:c.strokes,to_par:c.to_par,vs_field:round2(delta(x,c))})));
  const lowest=rounds.filter(r=>Number.isFinite(r.to_par)).sort((a,b)=>a.to_par-b.to_par||a.strokes-b.strokes)[0]||null;
  const best=rounds.filter(r=>Number.isFinite(r.vs_field)).sort((a,b)=>b.vs_field-a.vs_field).slice(0,5);
  return {method:'golf-visuals/1.0.0',window_note:'Full-field events in coverage; not career totals.',form,round_profile:{all:roundProfile(null),l24m:roundProfile(since)},finish_distribution:{all:dist(null),l24m:dist(since)},major_profile:Object.values(majors),lowest_round:lowest,best_rounds:best,courses_played:new Set(es.map(x=>x.e.course?.id).filter(Boolean)).size};
 }
 // ---- player documents
 const pubEntry=x=>({edition:{slug:x.e.slug,name:x.e.name,year:x.e.year,division:x.e.division,is_major:x.e.is_major,coverage:x.e.coverage,course:x.e.course,series_key:x.e.series_key,ends_on:x.e.ends_on},position:x.position,tied:x.tied,status:x.status,to_par:x.to_par,strokes:x.strokes,winner:x.winner,rounds:x.rounds.map(c=>({round:c.round,strokes:c.strokes,to_par:c.to_par,vs_field:round2(delta(x,c))}))});
 function playerDoc(p){
  const es=(entriesByPlayer.get(p.id)||[]).sort((a,b)=>String(b.e.ends_on||b.e.year).localeCompare(String(a.e.ends_on||a.e.year)));
  const majors=es.filter(x=>x.e.is_major),mFull=majors.filter(x=>x.e.coverage==='full_field'),mBoards=majors.filter(x=>x.e.coverage!=='winner_only');
  const majorPositions=mBoards.map(x=>x.position).filter(Number.isInteger);
  const seasons=new Map();for(const x of es){const y=x.e.year;if(!seasons.has(y))seasons.set(y,[]);seasons.get(y).push(x);}
  const seasonRows=[...seasons].sort((a,b)=>b[0]-a[0]).map(([y,xs])=>{const full=xs.filter(x=>x.e.coverage==='full_field');const ds=full.flatMap(x=>x.rounds.map(c=>delta(x,c))).filter(Number.isFinite);return {season:y,events_observed:xs.length,full_field_starts:full.length,wins:xs.filter(x=>x.winner).length,top10:xs.filter(x=>x.position&&x.position<=10).length,cuts_made:full.filter(x=>x.status==='finished').length,rounds:ds.length,scoring_vs_field:round2(mean(ds)),avg_to_par_per_round:round2(mean(full.flatMap(x=>x.rounds.map(c=>c.to_par)).filter(Number.isFinite)))};});
  const courseIds=[...new Set(es.map(x=>x.e.course?.id).filter(Boolean))];
  const history=courseIds.map(cid=>({course:{id:cid,name:courses.get(cid)?.name,slug:courses.get(cid)?.slug},...courseHistory(p.id,cid)})).sort((a,b)=>b.appearances_observed-a.appearances_observed);
  const summary={wins_observed:es.filter(x=>x.winner).length,events_observed:es.length,full_field_starts:es.filter(x=>x.e.coverage==='full_field').length,major_wins:majors.filter(x=>x.winner).length,major_appearances_observed:majors.length,major_full_field_starts:mFull.length,major_top10:mBoards.filter(x=>x.position&&x.position<=10).length,best_major_finish:majorPositions.length?Math.min(...majorPositions):null,last_event:es[0]?{slug:es[0].e.slug,name:es[0].e.name,year:es[0].e.year,position:es[0].position,tied:es[0].tied,status:es[0].status}:null};
  return {...p,summary,dna:dna.get(p.id)||null,results:es.map(pubEntry),seasons:seasonRows,course_history:history,visuals:playerVisuals(es),season_stats:seasonStatsOf(p.id),bag_dna:bagDna(p.id)};
 }
 // ---- edition documents (leaderboards, rounds, scorecards, field intelligence)
 function editionDoc(e,holeMap=new Map()){
  const es=(entriesByEdition.get(e.id)||[]).sort((a,b)=>(a.position??999)-(b.position??999)||(a.status==='finished'?0:1)-(b.status==='finished'?0:1)||(a.strokes??999)-(b.strokes??999));
  const start=e.starts_on||(e.year+'-01-01');
  const board=es.map(x=>{const p=playerById.get(x.player_id);return {player:p?{slug:p.slug,name:p.name,country:p.country,country_code:p.country_code,photo:x.winner?p.photo:thumb(p.photo)}:null,position:x.position,tied:x.tied,status:x.status,to_par:x.to_par,strokes:x.strokes,winner:x.winner,margin:x.margin,rounds:x.rounds.map(c=>({round:c.round,strokes:c.strokes,to_par:c.to_par,vs_field:round2(delta(x,c))})),holes:x.rounds.flatMap(c=>{const hs=holeMap.get(x.id+':'+c.round);return hs?[{round:c.round,scores:hs}]:[];})};});
  // Leader after each round from published round scores (complete only for full-field editions).
  const timeline=[];if(e.coverage==='full_field')for(let n=1;n<=(e.results_source?.rounds_played||0);n++){const totals=es.filter(x=>x.rounds.length>=n&&x.rounds.slice(0,n).every((c,i)=>c.round===i+1)).map(x=>({x,total:x.rounds.slice(0,n).reduce((s,c)=>s+c.strokes,0)}));if(!totals.length)continue;const best=Math.min(...totals.map(t=>t.total)),leaders=totals.filter(t=>t.total===best);const f=fieldMean.get(e.id+':'+n);timeline.push({after_round:n,leaders:leaders.map(t=>({slug:playerById.get(t.x.player_id)?.slug,name:playerById.get(t.x.player_id)?.name})),total:best,to_par:e.par?best-e.par*n:null,field_average:round2(f?.mean),players_in_round:f?.n||null});}
  // Field intelligence: time-safe pre-event context (only results that ended before this edition started).
  let field=null;
  if(es.length>=20){
   const prior=pid=>(entriesByPlayer.get(pid)||[]).filter(x=>(x.e.ends_on||x.e.year+'-12-31')<start);
   const rows=es.map(x=>{const pr=prior(x.player_id),full=pr.filter(y=>y.e.coverage==='full_field'&&(y.e.ends_on||'')>=new Date(Date.parse(start)-365*DAY).toISOString().slice(0,10));const ds=full.flatMap(y=>y.rounds.map(c=>delta(y,c))).filter(Number.isFinite);const ch=e.course?courseHistory(x.player_id,e.course.id,start):null;return {slug:playerById.get(x.player_id)?.slug,name:playerById.get(x.player_id)?.name,photo:thumb(playerById.get(x.player_id)?.photo),major_wins_before:pr.filter(y=>y.winner&&y.e.is_major).length,series_appearances_before:pr.filter(y=>y.e.tournament_id===e.tournament_id).length,form:round2(mean(ds)),form_rounds:ds.length,course_vs_field:ch?.scoring_vs_field??null,course_rounds:ch?.rounds||0,finish:x.position,status:x.status};});
   field={method:'golf-field-context/1.0.0',time_safe:'uses only results that ended before '+start,players:rows.length,major_champions:rows.filter(r=>r.major_wins_before>0).sort((a,b)=>b.major_wins_before-a.major_wins_before).slice(0,12),recent_form_leaders:rows.filter(r=>tier('rounds',r.form_rounds)!=='INSUFFICIENT').sort((a,b)=>b.form-a.form).slice(0,10),course_history_leaders:rows.filter(r=>r.course_rounds>=8).sort((a,b)=>b.course_vs_field-a.course_vs_field).slice(0,10),first_observed_appearances:e.year>=2002?rows.filter(r=>r.series_appearances_before===0).length:null};
  }
  const champions=editions.filter(x=>x.tournament_id===e.tournament_id&&x.id!==e.id).sort((a,b)=>b.year-a.year).slice(0,15).map(x=>{const w=(entriesByEdition.get(x.id)||[]).find(y=>y.winner);const p=w&&playerById.get(w.player_id);return {slug:x.slug,year:x.year,winner:p?{slug:p.slug,name:p.name}:null,to_par:w?.to_par??null};});
  // Preview context for upcoming / this-week editions: entrants ranked by their own public DNA percentile.
  let matchups_to_watch=[];
  if(e.status!=='completed'&&es.length>=4){const ranked=es.map(x=>({p:playerById.get(x.player_id),d:dna.get(x.player_id)?.l24m})).filter(r=>r.p&&r.d&&r.d.division===e.division&&r.d.metrics.scoring.percentile!==null&&r.d.metrics.scoring.confidence!=='INSUFFICIENT').sort((a,b)=>b.d.metrics.scoring.percentile-a.d.metrics.scoring.percentile).slice(0,4);
   for(let i=0;i<ranked.length;i++)for(let j=i+1;j<ranked.length&&matchups_to_watch.length<3;j++){const [x,y]=[ranked[i].p,ranked[j].p].sort((m,n)=>m.slug.localeCompare(n.slug));matchups_to_watch.push({a:{slug:x.slug,name:x.name,photo:thumb(x.photo)},b:{slug:y.slug,name:y.name,photo:thumb(y.photo)},reason:'Highest 24-month scoring-vs-field percentiles in this field'});}}
  return {...e,leaderboard:board,timeline,field,past_editions:champions,fit:null,defending_champion:e.espn?.defending_champion_espn?espnPlayer(e.espn.defending_champion_espn):null,matchups_to_watch};
 }
 // ---- course documents
 const contenderEdition=c=>(courseStats.get(c.id)?.editions||[]).find(e=>e.coverage==='full_field'&&e.layout?.holes?.length)||null;
 function courseDoc(c,holeMap=new Map()){const s=courseStats.get(c.id),eds=(s?.editions||[]);const meta=g.layouts.find(l=>l.course_id===c.id&&/metadata only/i.test(l.version_label));
  const pids=new Set();for(const e of eds)for(const x of entriesByEdition.get(e.id)||[])pids.add(x.player_id);
  const leaders=[...pids].map(pid=>({p:playerById.get(pid),h:courseHistory(pid,c.id)})).filter(r=>r.p&&r.h.rounds>=8).sort((a,b)=>b.h.scoring_vs_field-a.h.scoring_vs_field).slice(0,20).map(r=>({slug:r.p.slug,name:r.p.name,photo:thumb(r.p.photo),...r.h,editions:undefined,fit:fit(r.p.id,c.id)}));
  const lastFull=contenderEdition(c);const contender=lastFull?.layout?.holes?.length?(()=>{const out=lastFull.layout.holes.map(h=>({hole:h.hole,par:h.par,yards:h.yards,scores:[]}));for(const x of entriesByEdition.get(lastFull.id)||[])for(const c of x.rounds){const hs=holeMap.get(x.id+':'+c.round);if(hs)for(const h of hs){const o=out[h.hole-1];if(o)o.scores.push(h.to_par);}}return {edition:lastFull.slug,year:lastFull.year,basis:'hole-by-hole scorecards observed for this edition (sources: Wikipedia leaders cards and/or ESPN field cards)',holes:out.map(o=>({hole:o.hole,par:o.par,yards:o.yards,sample:o.scores.length,avg_to_par:round2(mean(o.scores))}))};})():null;
  return {id:c.id,slug:c.slug,name:c.name,locality:c.locality,country_code:c.country_code,country:meta?.specifications?.country_name||null,latitude:c.latitude,longitude:c.longitude,description:meta?.specifications?.description||null,architects:meta?.specifications?.architects||[],opened_year:meta?.specifications?.opened_year||null,wikidata_id:meta?.specifications?.wikidata_id||null,photo:media('course',c.id),provenance:captures.get(c.capture_id)||null,
   editions:eds.map(e=>{const w=(entriesByEdition.get(e.id)||[]).find(x=>x.winner);const p=w&&playerById.get(w.player_id);return {slug:e.slug,name:e.name,year:e.year,division:e.division,is_major:e.is_major,coverage:e.coverage,par:e.par,yardage:e.layout?.yardage||null,winner:p?{slug:p.slug,name:p.name}:null,to_par:w?.to_par??null};}),
   dna:courseDna(c.id),player_history:leaders,contender_hole_scoring:contender};}
 const pSummary=d=>({slug:d.slug,name:d.name,country:d.country,country_code:d.country_code,division:d.division,age:d.age,photo:thumb(d.photo),...d.summary,scoring:d.dna?.l24m?.metrics?.scoring?{value:d.dna.l24m.metrics.scoring.value,percentile:d.dna.l24m.metrics.scoring.percentile,confidence:d.dna.l24m.metrics.scoring.confidence}:null,form:d.dna?.l24m?.metrics?.form?{value:d.dna.l24m.metrics.form.value,percentile:d.dna.l24m.metrics.form.percentile,confidence:d.dna.l24m.metrics.form.confidence}:null});
 function finalize({playerSummaries,courseSummaries,stats}){
 // ---- index (directories, search, home)
 const edSummary=e=>{const w=(entriesByEdition.get(e.id)||[]).find(x=>x.winner);const p=w&&playerById.get(w.player_id);return {id:e.id,slug:e.slug,name:e.name,tournament:e.tournament,series_key:e.series_key,year:e.year,starts_on:e.starts_on,ends_on:e.ends_on,status:e.status,division:e.division,is_major:e.is_major,tours:e.tours,course:e.course,coverage:e.coverage,winner:p?{slug:p.slug,name:p.name,photo:thumb(p.photo)}:null,winner_to_par:w?.to_par??null,location:e.schedule?.location||null};};
 const edList=editions.map(edSummary).sort((a,b)=>String(b.ends_on||b.year).localeCompare(String(a.ends_on||a.year)));
 const current=edList.filter(e=>e.status==='in_progress'),upcoming=edList.filter(e=>e.status==='scheduled'&&(e.starts_on||e.ends_on||'')>=today).sort((a,b)=>String(a.starts_on||a.ends_on).localeCompare(String(b.starts_on||b.ends_on))).slice(0,12);
 const recent=edList.filter(e=>e.status==='completed'&&e.winner&&(e.ends_on||'')<=today&&e.ends_on).slice(0,16);
 const coverage={players:players.length,players_with_results:stats.with_results,players_with_rounds:stats.with_rounds,players_with_photo:players.filter(p=>p.photo).length,tournaments:g.tournaments.length,editions:editions.length,editions_with_leaderboards:editions.filter(e=>!['winner_only','schedule_only'].includes(e.coverage)).length,full_field_editions:editions.filter(e=>e.coverage==='full_field').length,courses:g.courses.length,courses_with_photo:courseSummaries.filter(c=>c.photo).length,results:resultsCount,rounds:g.counts?.scorecards??(g.scorecards||[]).length,hole_scores:stats.hole_scores??null,men_majors:editions.filter(e=>e.is_major&&e.division==='men').length,women_majors:editions.filter(e=>e.is_major&&e.division==='women').length,pga_tour_events:editions.filter(e=>e.tours.includes('PGA Tour')).length,lpga_events:editions.filter(e=>e.tours.includes('LPGA Tour')).length,dna_eligible:{men:[...dna.values()].filter(d=>d.l24m?.division==='men'&&d.l24m.metrics.scoring.confidence!=='INSUFFICIENT').length,women:[...dna.values()].filter(d=>d.l24m?.division==='women'&&d.l24m.metrics.scoring.confidence!=='INSUFFICIENT').length},live_scoring:'espn_core_snapshots',tee_times:'espn_core',official_rankings:false,shot_statistics:false};
 const index={version:PROJECTION_VERSION,as_of:asOf,methods:{dna:DNA_METHOD,course:COURSE_METHOD,fit:FIT_METHOD},dimensions:DIMENSIONS,sources:[{id:'wikidata',name:'Wikidata',licence:'CC0 1.0',role:'identities, championship editions, winners, venues'},{id:'wikipedia',name:'Wikipedia',licence:'CC BY-SA 4.0',role:'leaderboards, round scores, fields, cut lines, course setups, tour schedules',attribution:'Results text and data adapted from Wikipedia contributors; the redistributed results dataset is available under CC BY-SA 4.0.'},{id:'espn',name:'ESPN',licence:'owner-approved source',role:'event fields, round and hole-by-hole scores, tee times, athlete biographies, season statistics'},{id:'commons',name:'Wikimedia Commons',licence:'per image (CC0 / CC BY / CC BY-SA)',role:'player and course photographs with per-image attribution'}],source_state:g.sources,coverage,
  current,upcoming,recent,editions:edList,players:playerSummaries.sort((a,b)=>b.events_observed-a.events_observed||a.name.localeCompare(b.name)),courses:courseSummaries.sort((a,b)=>b.editions_hosted-a.editions_hosted),
  series:Object.entries(SERIES_NAMES).map(([key,name])=>{const eds=edList.filter(e=>e.series_key===key);return {key,name,division:eds[0]?.division||null,editions:eds.length,first_year:eds.at(-1)?.year||null,latest:eds[0]||null};})};
 // Featured comparisons: same-division pairs only, canonical slug order (A vs B == B vs A).
 const brief=p=>({slug:p.slug,name:p.name,photo:thumb(p.photo),country:p.country,division:p.division});
 const pair=(x,y,reason)=>{const [a,b]=[x,y].sort((m,n)=>m.slug.localeCompare(n.slug));return {a:brief(a),b:brief(b),reason};};
 const featured=[];
 for(const div of ['men','women']){
  const RANK={HIGH:3,MEDIUM:2,LIMITED:1};const top=index.players.filter(p=>p.division===div&&RANK[p.scoring?.confidence]&&p.scoring.percentile!==null).sort((a,b)=>RANK[b.scoring.confidence]-RANK[a.scoring.confidence]||b.scoring.percentile-a.scoring.percentile).slice(0,4);
  for(let i=0;i<top.length;i++)for(let j=i+1;j<top.length&&featured.filter(f=>f.a.division===div).length<4;j++)featured.push(pair(top[i],top[j],div==='men'?'Men’s scoring-vs-field leaders (24 months)':'Women’s scoring-vs-field leaders (24 months)'));
  const champs=[...new Map(edList.filter(e=>e.is_major&&e.division===div&&e.winner).map(e=>[e.winner.slug,index.players.find(p=>p.slug===e.winner.slug)])).values()].filter(Boolean).slice(0,2);
  if(champs.length===2)featured.push(pair(champs[0],champs[1],div==='men'?'Latest men’s major champions':'Latest women’s major champions'));
 }
 // Schedule rail data: current and next season tour events with factual context (state is computed at view time).
 const yearNow=Number(today.slice(0,4));
 const prevWinner=e=>{const prev=editions.find(x=>x.tournament_id===e.tournament_id&&x.year===e.year-1);const w=prev&&(entriesByEdition.get(prev.id)||[]).find(y=>y.winner);const p=w&&playerById.get(w.player_id);return p?{slug:p.slug,name:p.name,photo:thumb(p.photo),basis:'previous edition champion in coverage'}:null;};
 index.schedule={as_of:asOf,note:'Dates, courses and purses from tour schedules (Wikipedia) and ESPN event records. No live scoring.',events:editions.filter(e=>(e.tours.includes('PGA Tour')||e.tours.includes('LPGA Tour'))&&e.year>=yearNow-1&&e.year<=yearNow+1).map(e=>{const w=(entriesByEdition.get(e.id)||[]).find(x=>x.winner);const wp=w&&playerById.get(w.player_id);return {slug:e.slug,name:e.name,tours:e.tours,division:e.division,is_major:e.is_major,starts_on:e.starts_on,ends_on:e.ends_on,status:e.status,course:e.course?{name:e.course.name,slug:e.course.slug}:e.espn?.course?{name:e.espn.course.name,slug:null}:null,location:e.espn?.course?[e.espn.course.city,e.espn.course.state,e.espn.course.country].filter(Boolean).join(', '):e.schedule?.location||null,purse_text:e.espn?.purse_text||e.schedule?.purse_text||null,par:e.par??e.espn?.course?.par??null,yardage:e.layout?.yardage??e.espn?.course?.yards??null,field_count:e.status!=='scheduled'?(e.espn?.field_size||null):null,defending_champion:e.espn?.defending_champion_espn?{...espnPlayer(e.espn.defending_champion_espn),basis:'ESPN event record'}:prevWinner(e),winner:wp?{slug:wp.slug,name:wp.name,photo:thumb(wp.photo)}:null,winner_to_par:w?.to_par??null};}).filter(e=>e.ends_on).sort((a,b)=>a.ends_on.localeCompare(b.ends_on))};
 index.media_credits=g.media.map(m=>({entity:m.player_id?playerById.get(m.player_id)?.slug&&('/player/'+playerById.get(m.player_id).slug):m.course_id?('/course/'+(courses.get(m.course_id)?.slug)):null,name:m.player_id?playerById.get(m.player_id)?.name:courses.get(m.course_id)?.name,author:m.author,licence:m.licence,licence_url:m.licence_url,source_url:m.source_url,derivatives:derivatives.has(m.sha256)})).filter(m=>m.entity);
 index.featured_matchups=[...new Map(featured.map(f=>[f.a.slug+'|'+f.b.slug,f])).values()];
 return {index,summary:{as_of:asOf,...coverage}};
 }
 const courseSummary=c=>({slug:c.slug,name:c.name,locality:c.locality,country:c.country,country_code:c.country_code,photo:thumb(c.photo),editions_hosted:c.editions.length,first_year:c.editions.at(-1)?.year||null,last_year:c.editions[0]?.year||null,majors_hosted:c.editions.filter(e=>e.is_major).length,divisions:[...new Set(c.editions.map(e=>e.division).filter(Boolean))],difficulty:c.dna?.dimensions?.[0]?.value??null});
 const keepPlayer=d=>d.results.length||d.summary.wins_observed;
 return {players,editions,courses:g.courses,playerDoc,editionDoc,courseDoc,contenderEdition,pSummary,courseSummary,keepPlayer,finalize,addEditionHoles,finalizePar};
}
// Synchronous full build (tests and small graphs): hole scores, if supplied, come from g.holeScores + g.scorecards.
export function compute(g,opts={}){
 const c=prepare(g,opts);
 const holeMapFor=edId=>{const m=new Map();if(!g.holeScores)return m;const sc=new Map((g.scorecards||[]).map(x=>[x.id,x]));const rn=new Map(g.rounds.map(r=>[r.id,r.round_number])),hn=new Map(g.holes.map(h=>[h.id,h.hole_number]));for(const h of g.holeScores){const x=sc.get(h.scorecard_id);if(!x||x.edition_id&&x.edition_id!==edId)continue;const k=x.entry_id+':'+rn.get(x.round_id);if(!m.has(k))m.set(k,[]);m.get(k).push({hole:hn.get(h.hole_id),strokes:h.strokes,to_par:h.score_to_par});}return m;};
 const editions=c.editions.map(e=>{const hm=holeMapFor(e.id);c.addEditionHoles(e,hm);return c.editionDoc(e,hm);});c.finalizePar();const players=c.players.map(c.playerDoc),courses=c.courses.map(x=>{const ce=c.contenderEdition(x);return c.courseDoc(x,ce?holeMapFor(ce.id):new Map());});
 const f=c.finalize({playerSummaries:players.filter(c.keepPlayer).map(c.pSummary),courseSummaries:courses.map(c.courseSummary),stats:{with_results:players.filter(d=>d.results.length).length,with_rounds:players.filter(d=>d.results.some(r=>r.rounds.length)).length,hole_scores:(g.holeScores||[]).length}});
 return {...f,players,editions,courses};
}
async function sha(text){const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return [...new Uint8Array(h)].map(b=>b.toString(16).padStart(2,'0')).join('');}
// Streaming publisher: each document is built, hashed, written if changed, then dropped.
export async function buildProjection(db,env){
 const g=await loadGraph(db);const derivatives=new Set();
 if(env.PUBLIC){let cursor;do{const l=await env.PUBLIC.list({prefix:'media/',cursor,limit:1000});for(const o of l.objects){const m=o.key.match(/^media\/([0-9a-f]{64})\/640\.webp$/);if(m)derivatives.add(m[1]);}cursor=l.truncated?l.cursor:null;}while(cursor);}
 const c=prepare(g,{derivatives}),prefix='projection/v2/';
 let old={};try{old=JSON.parse(await (await env.PUBLIC.get(prefix+'manifest.json'))?.text()||'{}').docs||{};}catch{}
 const next={};let written=0,pending=[];
 const put=async(k,v)=>{const text=JSON.stringify(v),h=await sha(text);next[k]=h;if(old[k]!==h){pending.push(env.PUBLIC.put(prefix+k,text,{httpMetadata:{contentType:'application/json'}}).then(()=>written++));if(pending.length>=20){await Promise.all(pending);pending=[];}}};
 const playerSummaries=[],stats={with_results:0,with_rounds:0,hole_scores:0};
 const wxToday=new Date().toISOString().slice(0,10);
 const holesOf=holesCache(db,env);
 for(const e of c.editions){const hm=e.layout?.holes?.length&&e.coverage!=='winner_only'?await holesOf(e):new Map();for(const a of hm.values())stats.hole_scores+=a.length;c.addEditionHoles(e,hm);const doc=c.editionDoc(e,hm);
  if(e.status!=='completed'&&(e.ends_on||'')>=wxToday){try{const o=await env.PUBLIC.get('weather/v1/forecast/'+e.id+'.json');if(o){const w=JSON.parse(await o.text());doc.weather={...w,hours:w.hours.filter(h=>h.t.slice(0,10)>=(e.starts_on||wxToday)&&h.t.slice(0,10)<=e.ends_on)};}}catch{}}
  await put('editions/'+e.slug+'.json',doc);}
 c.finalizePar();
 for(const p of c.players){const d=c.playerDoc(p);if(d.results.length)stats.with_results++;if(d.results.some(r=>r.rounds.length))stats.with_rounds++;if(c.keepPlayer(d))playerSummaries.push(c.pSummary(d));await put('players/'+d.slug+'.json',d);}
 const courseSummaries=[];
 for(const x of c.courses){const ce=c.contenderEdition(x);const d=c.courseDoc(x,ce?await holesOf(ce):new Map());courseSummaries.push(c.courseSummary(d));await put('courses/'+d.slug+'.json',d);}
 const f=c.finalize({playerSummaries,courseSummaries,stats});
 await put('index.json',f.index);await put('schedule.json',f.index.schedule);await Promise.all(pending);
 await env.PUBLIC.put(prefix+'manifest.json',JSON.stringify({version:PROJECTION_VERSION,as_of:f.index.as_of,docs:next,summary:f.summary}),{httpMetadata:{contentType:'application/json'}});
 return {summary:{...f.summary,published:{written,total:Object.keys(next).length}}};
}
