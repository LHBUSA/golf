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
  identities:['golf_player_identities','player_id,provider_id,country_name:evidence->>country_name,sex:evidence->>sex,external_ids:evidence->external_ids,birth_year:evidence->>birth_year,article:evidence->>enwiki_article','&source_id=eq.wikidata'],
  entries:['golf_entries','id,edition_id,player_id,status'],results:['golf_results','edition_id,entry_id,position,tied,strokes,score_to_par,finish_status,winner,winning_margin'],
  rounds:['golf_rounds','id,edition_id,round_number'],scorecards:['golf_scorecards','id,entry_id,round_id,strokes,score_to_par'],holeScores:['golf_hole_scores','scorecard_id,hole_id,strokes,score_to_par'],
  media:['golf_entity_media','player_id,course_id,author,licence,licence_url,attribution,source_url,sha256,width,height,identity_proof,rights_status','&rights_status=eq.approved'],
  captures:['golf_source_captures','id,source_id,source_url,captured_at,sha256,parser_version,rights_version'],
  sources:['golf_source_state','source_id,status,last_write,last_capture,last_parse,records_held,identity_conflicts,last_error,parser_version']
 };
 const keys=Object.keys(spec),data=await Promise.all(keys.map(k=>k==='sources'?db(spec[k][0],'select='+spec[k][1]):all(db,...spec[k])));
 return Object.fromEntries(keys.map((k,i)=>[k,data[i]]));
}
const by=(rows,key)=>{const m=new Map();for(const r of rows){const k=r[key];if(!m.has(k))m.set(k,[]);m.get(k).push(r);}return m;};
const age=(birth,asOf)=>{if(!birth)return null;const b=new Date(birth+'T00:00:00Z'),a=new Date(asOf);let y=a.getUTCFullYear()-b.getUTCFullYear();if(a.getUTCMonth()<b.getUTCMonth()||(a.getUTCMonth()===b.getUTCMonth()&&a.getUTCDate()<b.getUTCDate()))y--;return y;};
const SERIES_NAMES={'masters':'Masters Tournament','pga-championship':'PGA Championship','us-open':'U.S. Open','the-open':'The Open Championship','players':'The Players Championship','chevron':'Chevron Championship','us-womens-open':'U.S. Women’s Open','womens-pga':'Women’s PGA Championship','evian':'The Evian Championship','womens-open':'Women’s Open'};
export function compute(g,{asOf=new Date().toISOString(),derivatives=new Set()}={}){
 const today=asOf.slice(0,10),asOfMs=Date.parse(asOf);
 const tournaments=new Map(g.tournaments.map(t=>[t.id,t])),tours=new Map(g.tours.map(t=>[t.id,t])),courses=new Map(g.courses.map(c=>[c.id,c])),layouts=new Map(g.layouts.map(l=>[l.id,l]));
 const holesByLayout=by(g.holes,'layout_id'),ecByEdition=by(g.editionCourses,'edition_id'),toursByEdition=by(g.editionTours,'edition_id');
 const captures=new Map(g.captures.map(c=>[c.id,{id:c.id,source:c.source_id,captured_at:c.captured_at,sha256:c.sha256,parser:c.parser_version,rights:c.rights_version}]));
 const media=(kind,id)=>{const m=g.media.find(x=>x[kind+'_id']===id);if(!m)return null;return {sha256:m.sha256,width:m.width,height:m.height,author:m.author,licence:m.licence,licence_url:m.licence_url,attribution:m.attribution,source_url:m.source_url,derivatives:derivatives.has(m.sha256),restrictions:m.identity_proof?.restrictions||null};};
 const thumb=ph=>ph?{sha256:ph.sha256,width:ph.width,height:ph.height,derivatives:ph.derivatives}:null;
 const ident=new Map(g.identities.map(i=>[i.player_id,i]));
 // ---- editions
 const editions=g.editions.map(e=>{
  const t=tournaments.get(e.tournament_id),r=e.rules||{},ecs=ecByEdition.get(e.id)||[];
  const setup=ecs.map(x=>layouts.get(x.layout_id)).find(l=>l&&!/metadata only/i.test(l.version_label));
  const meta=ecs.map(x=>layouts.get(x.layout_id)).find(l=>l&&/metadata only/i.test(l.version_label));
  const course=courses.get((setup||meta)?.course_id)||null;
  const tourNames=(toursByEdition.get(e.id)||[]).map(x=>tours.get(x.tour_id)?.name).filter(Boolean);
  const division=r.division||t?.major_division||((toursByEdition.get(e.id)||[]).map(x=>tours.get(x.tour_id)?.division)[0])||null;
  const res=r.results||null;
  return {id:e.id,slug:(t?.slug||e.id)+'-'+e.edition_key,name:r.source_name||((e.edition_key+' '+(t?.name||'')).trim()),tournament_id:e.tournament_id,tournament:t?{id:t.id,name:t.name,slug:t.slug}:null,series_key:r.series_key||null,year:Number(e.edition_key),starts_on:e.starts_on,ends_on:e.ends_on,status:e.status,division,is_major:Boolean(r.is_major),tours:tourNames,course:course?{id:course.id,name:course.name,slug:course.slug}:null,layout:setup?{id:setup.id,label:setup.version_label,par:setup.par,yardage:setup.yardage,holes:(holesByLayout.get(setup.id)||[]).sort((a,b)=>a.hole_number-b.hole_number).map(h=>({hole:h.hole_number,par:h.par,yards:h.yardage}))}:null,coverage:res?.coverage||(r.winner_wikidata_id?'winner_only':'schedule_only'),results_source:res?{article:res.article,revision:res.revision,licence:res.licence,attribution:res.attribution,field_size:res.field_size,made_cut:res.made_cut,rows_listed:res.rows_listed,rows_stored:res.rows_stored,rows_without_identity:res.rows_without_identity,rows_with_inconsistent_scores:res.rows_with_inconsistent_scores,rounds_played:res.rounds_played,playoff:res.playoff,cut:res.cut}:null,schedule:r.schedule?{tour:r.schedule.tour,location:r.schedule.location,purse_text:r.schedule.purse_text,date_text:r.schedule.date_text}:null,par:setup?.par??res?.par??null,provenance:captures.get(e.capture_id)||null,date_precision:r.date_precision??null,source_date:r.source_date??null};
 });
 const edById=new Map(editions.map(e=>[e.id,e]));
 // ---- entries/results/rounds
 const resultByEntry=new Map(g.results.map(r=>[r.entry_id,r])),roundNo=new Map(g.rounds.map(r=>[r.id,r.round_number])),cardsByEntry=by(g.scorecards,'entry_id');
 const entries=g.entries.map(en=>{const r=resultByEntry.get(en.id)||{},e=edById.get(en.edition_id);const cards=(cardsByEntry.get(en.id)||[]).map(c=>({id:c.id,round:roundNo.get(c.round_id),strokes:c.strokes,to_par:c.score_to_par})).sort((a,b)=>a.round-b.round);
  return {id:en.id,edition_id:en.edition_id,player_id:en.player_id,status:r.finish_status||en.status,position:r.position??null,tied:r.tied??null,strokes:r.strokes??null,to_par:r.score_to_par??null,winner:r.winner===true,margin:r.winning_margin??null,rounds:cards,e};}).filter(x=>x.e&&x.player_id);
 const entriesByEdition=by(entries,'edition_id'),entriesByPlayer=by(entries,'player_id');
 // Field averages per round, full-field editions only (survivorship is handled by per-round fields).
 const fieldMean=new Map();
 for(const e of editions){if(e.coverage!=='full_field')continue;const es=entriesByEdition.get(e.id)||[];const rounds=new Map();for(const x of es)for(const c of x.rounds){if(!rounds.has(c.round))rounds.set(c.round,[]);rounds.get(c.round).push(c.strokes);}for(const [n,arr] of rounds)if(arr.length>=20)fieldMean.set(e.id+':'+n,{mean:mean(arr),n:arr.length,sd:sd(arr)});}
 const delta=(x,c)=>{const f=fieldMean.get(x.edition_id+':'+c.round);return f?f.mean-c.strokes:null;};
 // ---- players
 const players=g.players.map(p=>{const i=ident.get(p.id)||{};const es=(entriesByPlayer.get(p.id)||[]);const divs=es.map(x=>x.e.division).filter(Boolean);const division=divs.length?(divs.filter(d=>d==='women').length>divs.length/2?'women':'men'):i.sex==='female'?'women':i.sex==='male'?'men':null;
  return {id:p.id,slug:p.slug,name:p.full_name,birth_date:p.birth_date,birth_year:p.birth_date?Number(p.birth_date.slice(0,4)):i.birth_year?Number(i.birth_year):null,age:age(p.birth_date,asOf),country:i.country_name||null,country_code:p.nationality_code,division,external_ids:i.external_ids||{},wikidata_id:i.provider_id||null,photo:media('player',p.id),provenance:captures.get(p.capture_id)||null};});
 const playerById=new Map(players.map(p=>[p.id,p]));
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
   held:[{code:'hazards',label:'Bunker & water pressure',reason:'No approved hazard or routing source; never inferred from imagery.'},{code:'putting_demand',label:'Putting demand',reason:'Requires putting statistics; no approved source.'},{code:'fairway_difficulty',label:'Fairway & approach demand',reason:'Requires shot-level statistics; no approved source.'}]};};
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
 // ---- player documents
 const pubEntry=x=>({edition:{slug:x.e.slug,name:x.e.name,year:x.e.year,division:x.e.division,is_major:x.e.is_major,coverage:x.e.coverage,course:x.e.course,series_key:x.e.series_key,ends_on:x.e.ends_on},position:x.position,tied:x.tied,status:x.status,to_par:x.to_par,strokes:x.strokes,winner:x.winner,rounds:x.rounds.map(c=>({round:c.round,strokes:c.strokes,to_par:c.to_par,vs_field:round2(delta(x,c))}))});
 const playerDocs=[];
 for(const p of players){
  const es=(entriesByPlayer.get(p.id)||[]).sort((a,b)=>String(b.e.ends_on||b.e.year).localeCompare(String(a.e.ends_on||a.e.year)));
  const majors=es.filter(x=>x.e.is_major),mFull=majors.filter(x=>x.e.coverage==='full_field'),mBoards=majors.filter(x=>x.e.coverage!=='winner_only');
  const majorPositions=mBoards.map(x=>x.position).filter(Number.isInteger);
  const seasons=new Map();for(const x of es){const y=x.e.year;if(!seasons.has(y))seasons.set(y,[]);seasons.get(y).push(x);}
  const seasonRows=[...seasons].sort((a,b)=>b[0]-a[0]).map(([y,xs])=>{const full=xs.filter(x=>x.e.coverage==='full_field');const ds=full.flatMap(x=>x.rounds.map(c=>delta(x,c))).filter(Number.isFinite);return {season:y,events_observed:xs.length,full_field_starts:full.length,wins:xs.filter(x=>x.winner).length,top10:xs.filter(x=>x.position&&x.position<=10).length,cuts_made:full.filter(x=>x.status==='finished').length,rounds:ds.length,scoring_vs_field:round2(mean(ds)),avg_to_par_per_round:round2(mean(full.flatMap(x=>x.rounds.map(c=>c.to_par)).filter(Number.isFinite)))};});
  const courseIds=[...new Set(es.map(x=>x.e.course?.id).filter(Boolean))];
  const history=courseIds.map(cid=>({course:{id:cid,name:courses.get(cid)?.name,slug:courses.get(cid)?.slug},...courseHistory(p.id,cid)})).sort((a,b)=>b.appearances_observed-a.appearances_observed);
  const summary={wins_observed:es.filter(x=>x.winner).length,events_observed:es.length,full_field_starts:es.filter(x=>x.e.coverage==='full_field').length,major_wins:majors.filter(x=>x.winner).length,major_appearances_observed:majors.length,major_full_field_starts:mFull.length,major_top10:mBoards.filter(x=>x.position&&x.position<=10).length,best_major_finish:majorPositions.length?Math.min(...majorPositions):null,last_event:es[0]?{slug:es[0].e.slug,name:es[0].e.name,year:es[0].e.year,position:es[0].position,tied:es[0].tied,status:es[0].status}:null};
  playerDocs.push({...p,summary,dna:dna.get(p.id)||null,results:es.map(pubEntry),seasons:seasonRows,course_history:history});
 }
 const docByPlayer=new Map(playerDocs.map(d=>[d.id,d]));
 // ---- edition documents (leaderboards, rounds, scorecards, field intelligence)
 const holeByScorecard=by(g.holeScores,'scorecard_id'),holeNo=new Map(g.holes.map(h=>[h.id,h.hole_number]));
 const editionDocs=editions.map(e=>{
  const es=(entriesByEdition.get(e.id)||[]).sort((a,b)=>(a.position??999)-(b.position??999)||(a.status==='finished'?0:1)-(b.status==='finished'?0:1)||(a.strokes??999)-(b.strokes??999));
  const start=e.starts_on||(e.year+'-01-01');
  const board=es.map(x=>{const p=playerById.get(x.player_id);return {player:p?{slug:p.slug,name:p.name,country:p.country,country_code:p.country_code,photo:x.winner?p.photo:thumb(p.photo)}:null,position:x.position,tied:x.tied,status:x.status,to_par:x.to_par,strokes:x.strokes,winner:x.winner,margin:x.margin,rounds:x.rounds.map(c=>({round:c.round,strokes:c.strokes,to_par:c.to_par,vs_field:round2(delta(x,c))})),holes:x.rounds.flatMap(c=>{const hs=holeByScorecard.get(c.id);return hs?[{round:c.round,scores:hs.map(h=>({hole:holeNo.get(h.hole_id),strokes:h.strokes,to_par:h.score_to_par})).sort((a,b)=>a.hole-b.hole)}]:[];})};});
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
  return {...e,leaderboard:board,timeline,field,past_editions:champions,fit:null};
 });
 // ---- course documents
 const courseDocs=g.courses.map(c=>{const s=courseStats.get(c.id),eds=(s?.editions||[]);const meta=g.layouts.find(l=>l.course_id===c.id&&/metadata only/i.test(l.version_label));
  const pids=new Set();for(const e of eds)for(const x of entriesByEdition.get(e.id)||[])pids.add(x.player_id);
  const leaders=[...pids].map(pid=>({p:playerById.get(pid),h:courseHistory(pid,c.id)})).filter(r=>r.p&&r.h.rounds>=8).sort((a,b)=>b.h.scoring_vs_field-a.h.scoring_vs_field).slice(0,20).map(r=>({slug:r.p.slug,name:r.p.name,photo:thumb(r.p.photo),...r.h,editions:undefined,fit:fit(r.p.id,c.id)}));
  const lastFull=eds.find(e=>e.coverage==='full_field');const contender=lastFull?.layout?.holes?.length?(()=>{const out=lastFull.layout.holes.map(h=>({hole:h.hole,par:h.par,yards:h.yards,scores:[]}));for(const x of entriesByEdition.get(lastFull.id)||[])for(const c of x.rounds){const hs=holeByScorecard.get(c.id);if(hs)for(const h of hs){const o=out[holeNo.get(h.hole_id)-1];if(o)o.scores.push(h.score_to_par);}}return {edition:lastFull.slug,year:lastFull.year,basis:'final-round scorecards of leading players published in the source article; not a full-field sample',holes:out.map(o=>({hole:o.hole,par:o.par,yards:o.yards,sample:o.scores.length,avg_to_par:round2(mean(o.scores))}))};})():null;
  return {id:c.id,slug:c.slug,name:c.name,locality:c.locality,country_code:c.country_code,country:meta?.specifications?.country_name||null,latitude:c.latitude,longitude:c.longitude,description:meta?.specifications?.description||null,architects:meta?.specifications?.architects||[],opened_year:meta?.specifications?.opened_year||null,wikidata_id:meta?.specifications?.wikidata_id||null,photo:media('course',c.id),provenance:captures.get(c.capture_id)||null,
   editions:eds.map(e=>{const w=(entriesByEdition.get(e.id)||[]).find(x=>x.winner);const p=w&&playerById.get(w.player_id);return {slug:e.slug,name:e.name,year:e.year,division:e.division,is_major:e.is_major,coverage:e.coverage,par:e.par,yardage:e.layout?.yardage||null,winner:p?{slug:p.slug,name:p.name}:null,to_par:w?.to_par??null};}),
   dna:courseDna(c.id),player_history:leaders,contender_hole_scoring:contender};});
 // ---- index (directories, search, home)
 const edSummary=e=>{const w=(entriesByEdition.get(e.id)||[]).find(x=>x.winner);const p=w&&playerById.get(w.player_id);return {id:e.id,slug:e.slug,name:e.name,tournament:e.tournament,series_key:e.series_key,year:e.year,starts_on:e.starts_on,ends_on:e.ends_on,status:e.status,division:e.division,is_major:e.is_major,tours:e.tours,course:e.course,coverage:e.coverage,winner:p?{slug:p.slug,name:p.name,photo:thumb(p.photo)}:null,winner_to_par:w?.to_par??null,location:e.schedule?.location||null};};
 const pSummary=d=>({slug:d.slug,name:d.name,country:d.country,country_code:d.country_code,division:d.division,age:d.age,photo:thumb(d.photo),...d.summary,scoring:d.dna?.l24m?.metrics?.scoring?{value:d.dna.l24m.metrics.scoring.value,percentile:d.dna.l24m.metrics.scoring.percentile,confidence:d.dna.l24m.metrics.scoring.confidence}:null,form:d.dna?.l24m?.metrics?.form?{value:d.dna.l24m.metrics.form.value,percentile:d.dna.l24m.metrics.form.percentile,confidence:d.dna.l24m.metrics.form.confidence}:null});
 const edList=editions.map(edSummary).sort((a,b)=>String(b.ends_on||b.year).localeCompare(String(a.ends_on||a.year)));
 const current=edList.filter(e=>e.status==='in_progress'),upcoming=edList.filter(e=>e.status==='scheduled'&&(e.starts_on||e.ends_on||'')>=today).sort((a,b)=>String(a.starts_on||a.ends_on).localeCompare(String(b.starts_on||b.ends_on))).slice(0,12);
 const recent=edList.filter(e=>e.status==='completed'&&e.winner&&(e.ends_on||'')<=today&&e.ends_on).slice(0,16);
 const coverage={players:players.length,players_with_results:playerDocs.filter(d=>d.results.length).length,players_with_rounds:playerDocs.filter(d=>d.results.some(r=>r.rounds.length)).length,players_with_photo:players.filter(p=>p.photo).length,tournaments:g.tournaments.length,editions:editions.length,editions_with_leaderboards:editions.filter(e=>!['winner_only','schedule_only'].includes(e.coverage)).length,full_field_editions:editions.filter(e=>e.coverage==='full_field').length,courses:g.courses.length,courses_with_photo:courseDocs.filter(c=>c.photo).length,results:g.results.length,rounds:g.scorecards.length,hole_scores:g.holeScores.length,men_majors:editions.filter(e=>e.is_major&&e.division==='men').length,women_majors:editions.filter(e=>e.is_major&&e.division==='women').length,pga_tour_events:editions.filter(e=>e.tours.includes('PGA Tour')).length,lpga_events:editions.filter(e=>e.tours.includes('LPGA Tour')).length,dna_eligible:{men:[...dna.values()].filter(d=>d.l24m?.division==='men'&&d.l24m.metrics.scoring.confidence!=='INSUFFICIENT').length,women:[...dna.values()].filter(d=>d.l24m?.division==='women'&&d.l24m.metrics.scoring.confidence!=='INSUFFICIENT').length},live_scoring:false,tee_times:false,official_rankings:false,shot_statistics:false};
 const index={version:PROJECTION_VERSION,as_of:asOf,methods:{dna:DNA_METHOD,course:COURSE_METHOD,fit:FIT_METHOD},dimensions:DIMENSIONS,held_dimensions:HELD,sources:[{id:'wikidata',name:'Wikidata',licence:'CC0 1.0',role:'identities, championship editions, winners, venues'},{id:'wikipedia',name:'Wikipedia',licence:'CC BY-SA 4.0',role:'leaderboards, round scores, fields, cut lines, course setups, tour schedules',attribution:'Results text and data adapted from Wikipedia contributors; the redistributed results dataset is available under CC BY-SA 4.0.'},{id:'commons',name:'Wikimedia Commons',licence:'per image (CC0 / CC BY / CC BY-SA)',role:'player and course photographs with per-image attribution'}],source_state:g.sources,coverage,
  current,upcoming,recent,editions:edList,players:playerDocs.filter(d=>d.results.length||d.summary.wins_observed).map(pSummary).sort((a,b)=>b.events_observed-a.events_observed||a.name.localeCompare(b.name)),courses:courseDocs.map(c=>({slug:c.slug,name:c.name,locality:c.locality,country:c.country,country_code:c.country_code,photo:thumb(c.photo),editions_hosted:c.editions.length,first_year:c.editions.at(-1)?.year||null,last_year:c.editions[0]?.year||null,majors_hosted:c.editions.filter(e=>e.is_major).length,divisions:[...new Set(c.editions.map(e=>e.division).filter(Boolean))],difficulty:c.dna?.dimensions?.[0]?.value??null})).sort((a,b)=>b.editions_hosted-a.editions_hosted),
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
 index.media_credits=g.media.map(m=>({entity:m.player_id?playerById.get(m.player_id)?.slug&&('/player/'+playerById.get(m.player_id).slug):m.course_id?('/course/'+(courses.get(m.course_id)?.slug)):null,name:m.player_id?playerById.get(m.player_id)?.name:courses.get(m.course_id)?.name,author:m.author,licence:m.licence,licence_url:m.licence_url,source_url:m.source_url,derivatives:derivatives.has(m.sha256)})).filter(m=>m.entity);
 index.featured_matchups=[...new Map(featured.map(f=>[f.a.slug+'|'+f.b.slug,f])).values()];
 return {index,players:playerDocs,editions:editionDocs,courses:courseDocs,summary:{as_of:asOf,...coverage}};
}
async function sha(text){const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return [...new Uint8Array(h)].map(b=>b.toString(16).padStart(2,'0')).join('');}
export async function publishProjection(env,p){
 const prefix='projection/v2/',manifestKey=prefix+'manifest.json';
 let old={};try{old=JSON.parse(await (await env.PUBLIC.get(manifestKey))?.text()||'{}').docs||{};}catch{}
 const docs=[['index.json',p.index],...p.players.map(d=>['players/'+d.slug+'.json',d]),...p.editions.map(d=>['editions/'+d.slug+'.json',d]),...p.courses.map(d=>['courses/'+d.slug+'.json',d])];
 const next={};let written=0;const queue=[];
 for(const [k,v] of docs){const text=JSON.stringify(v),h=await sha(text);next[k]=h;if(old[k]!==h)queue.push([k,text]);}
 for(let i=0;i<queue.length;i+=25)await Promise.all(queue.slice(i,i+25).map(([k,text])=>env.PUBLIC.put(prefix+k,text,{httpMetadata:{contentType:'application/json'}}).then(()=>written++)));
 await env.PUBLIC.put(manifestKey,JSON.stringify({version:PROJECTION_VERSION,as_of:p.index.as_of,docs:next,summary:p.summary}),{httpMetadata:{contentType:'application/json'}});
 return {written,total:docs.length};
}
export async function buildProjection(db,env){
 const g=await loadGraph(db);const derivatives=new Set();
 if(env.PUBLIC){let cursor;do{const l=await env.PUBLIC.list({prefix:'media/',cursor,limit:1000});for(const o of l.objects){const m=o.key.match(/^media\/([0-9a-f]{64})\/640\.webp$/);if(m)derivatives.add(m[1]);}cursor=l.truncated?l.cursor:null;}while(cursor);}
 const p=compute(g,{derivatives});const pub=env.PUBLIC?await publishProjection(env,p):null;
 return {summary:{...p.summary,published:pub}};
}
