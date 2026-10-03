// Player DNA truth pass: unavailable is null -> "—", never 0 and never a 50th percentile.
// Regression for production 2026-10-02: every LPGA Bag DNA (191 players) showed Distance 0 yards / Accuracy 0% /
// GIR 0 / Sand 0 / Putts 0 / Birdies 0 at the 50th percentile, because ESPN's LPGA season endpoint publishes unranked
// 0.0 placeholders (and puttsGirAvg value:null with displayValue "0") for statistics it does not measure.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {parseSeasonStats} from '../workers/golf-ingest/src/espn-stats.js';
import {cleanStat} from '../workers/shared/season-stats.js';
import {compute} from '../workers/shared/projection.js';
import {bagDna,withheldReason,sparkline} from '../src/lib/charts.js';
import {dnaModel,metricBars,dnaHero} from '../src/lib/dna-ui.js';
import {TIERS} from '../workers/shared/dna.js';
const FX=JSON.parse(fs.readFileSync(new URL('./fixtures/bag-dna-lpga-placeholder-zeros.json',import.meta.url),'utf8'));

test('parser: ESPN LPGA placeholders become null at the source; real PGA values and ranks survive',()=>{
 const l=parseSeasonStats(FX.lpga_athlete_5075190_saki_baba_2026);
 for(const k of ['yardsPerDrive','driveAccuracyPct','greensInRegPct','savePct','birdiesPerRound','holesPerEagle'])assert.equal(l[k].value,null,k);
 assert.equal(l.puttsGirAvg.value,null,'value:null with displayValue "0" is missing, not 0');
 assert.ok(l.scoringAverage.value>60);assert.ok(l.roundsPlayed.value>=20);
 const p=parseSeasonStats(FX.pga_athlete_9478_2026);assert.ok(p.yardsPerDrive.value>250);assert.ok(p.yardsPerDrive.rank>0);
});
test('cleanStat: unranked zero on a rate stat is unmeasured; ranked zero and counting zeros are real',()=>{
 assert.equal(cleanStat('yardsPerDrive',0,null),null);assert.equal(cleanStat('savePct',0,null),null);assert.equal(cleanStat('savePct',0,140),0);
 assert.equal(cleanStat('wins',0,null),0);assert.equal(cleanStat('topTenFinishes',0,null),0);assert.equal(cleanStat('yardsPerDrive',null,null),null);assert.equal(cleanStat('yardsPerDrive','',null),null);
 assert.equal(cleanStat('yardsPerDrive',281.4,null),281.4);
});
// Synthetic graph: 12 LPGA players whose stored rows carry the production placeholders (as already in the database),
// and 12 PGA players with real values; one PGA player has no distance row value (null).
function graph(){
 const tours=[{id:'lp',name:'LPGA Tour',slug:'lpga'},{id:'pg',name:'PGA Tour',slug:'pga-tour'}],players=[],seasonStats=[];
 const row=(pid,tour,code,value)=>seasonStats.push({player_id:pid,value,sample_size:null,effective_on:'2026-10-01',capture_id:'c',golf_stat_definitions:{code},golf_seasons:{label:'2026',tour_id:tour}});
 for(let i=0;i<12;i++){const w='w'+i,m='m'+i;players.push({id:w,full_name:'Woman '+i,slug:'woman-'+i},{id:m,full_name:'Man '+i,slug:'man-'+i});
  for(const [c,v] of [['roundsPlayed',40+i],['scoringAverage',70+i/10],['yardsPerDrive',0],['driveAccuracyPct',0],['greensInRegPct',0],['savePct',0],['birdiesPerRound',0],['puttsGirAvg',0],['wins',0]])row(w,'lp',c,v);
  for(const [c,v] of [['roundsPlayed',60+i],['scoringAverage',69+i/10],['yardsPerDrive',i===3?null:290+i],['yardsPerDrive_rank',i===3?null:i+1],['driveAccuracyPct',55+i],['greensInRegPct',62+i/2],['savePct',45+i],['birdiesPerRound',3.5+i/10],['puttsGirAvg',1.8-i/100],['wins',i%3?0:1]])if(v!==null)row(m,'pg',c,v);else row(m,'pg',c,null);}
 return {tours,tournaments:[],editions:[],editionTours:[],courses:[],layouts:[],holes:[],editionCourses:[],players,identities:[],entries:[],results:[],rounds:[],scorecards:[],holeScores:[],media:[],captures:[],sources:[],seasonStats};
}
const proj=compute(graph(),{asOf:'2026-10-02T00:00:00Z'});
const P=id=>proj.players.find(p=>p.id===id);
test('projection: stored LPGA placeholders never become 0 values or 50th percentiles',()=>{
 const b=P('w5').bag_dna;assert.equal(b.available,true);
 const comps=b.categories.flatMap(c=>c.components);
 for(const x of comps.filter(x=>x.code!=='scoringAverage')){assert.equal(x.value,null,x.code);assert.equal(x.percentile,null,x.code);assert.equal(x.unavailable,'not_published_for_tour');}
 assert.ok(!comps.some(x=>x.value===0),'no zero values');assert.ok(!b.categories.some(c=>c.percentile===50&&!c.graded),'no default 50th');
 const sa=comps.find(x=>x.code==='scoringAverage');assert.ok(Number.isFinite(sa.percentile),'a real published stat still grades');
 assert.equal(b.categories.find(c=>c.code==='driver').withheld,'not_published_for_tour');assert.equal(b.categories.find(c=>c.code==='scoring').percentile,null);
 const ss=P('w5').season_stats[0].values;assert.equal(ss.yardsPerDrive,null);assert.equal(ss.wins,0,'a real counting zero stays 0');
});
test('projection: a single missing PGA value is null for that player only; the cohort is unaffected',()=>{
 const d=P('m3').bag_dna.categories.find(c=>c.code==='driver');assert.equal(d.components[0].value,null);assert.equal(d.components[0].percentile,null);assert.equal(d.components[0].unavailable,'not_published_for_player');assert.equal(d.percentile,null);
 const other=P('m7').bag_dna.categories.find(c=>c.code==='driver');assert.ok(Number.isFinite(other.percentile));assert.equal(other.components[0].population,11);
 const pcts=proj.players.filter(p=>p.id.startsWith('m')).map(p=>p.bag_dna.categories.find(c=>c.code==='irons').percentile);assert.ok(new Set(pcts).size>5,'real spread, not a flat 50th');
});
test('renderer: production failing payload renders no 0 yards and no 50th; unpublished categories are named once',()=>{
 const before={available:true,season:2026,tour:'LPGA Tour',population:156,qualification:'>= 20 rounds in the season',as_of:'2026-10-01',formula:'f',disclosure:'d',categories:[FX.production_before.bag_dna_driver]};
 const after=P('w5').bag_dna,html=bagDna(after);
 assert.doesNotMatch(html,/>0 <small>yards|50th/);assert.match(html,/No published driver, irons \/ approach, short game \(sand\), putter statistics for the 2026 LPGA Tour/);
 assert.match(html,/Scoring average/);assert.match(html,/Percentile withheld/);assert.match(html,/title="Not published for this tour">— <small>not published/);assert.doesNotMatch(html,/ style=/);
 // Even the old (pre-fix) payload shape can no longer hide a missing value behind a bar when its percentile is null.
 assert.doesNotMatch(bagDna({...before,categories:[{...before.categories[0],percentile:null,components:before.categories[0].components.map(c=>({...c,value:null,percentile:null}))}]}),/data-w=/);
});
test('withheld reasons come from the real gates; par holes without field data are "not comparable", not a sample gap',()=>{
 assert.equal(withheldReason({percentile:62,sample:3,basis:'rounds'}),null);
 assert.equal(withheldReason({percentile:null,sample:0,basis:'holes'}).detail,'Full-field comparable hole data is not available for this dimension.');
 assert.match(withheldReason({percentile:null,sample:20,basis:'holes'}).detail,new RegExp(`Qualifies at ${TIERS.holes.at(-1)[1]} holes from full-field hole-by-hole events; 20 observed`));
 assert.match(withheldReason({percentile:null,sample:4,basis:'rounds'}).detail,new RegExp(`Qualifies at ${TIERS.rounds.at(-1)[1]} full-field rounds \\(Limited confidence\\); 4 observed`));
 assert.match(withheldReason({percentile:null,sample:2,basis:'starts'}).detail,/Qualifies at 3 full-field starts/);
 assert.match(withheldReason({percentile:null,sample:50,basis:'rounds',cohort_size:6}).detail,/Only 6 qualifying players/);
});
test('Player DNA dossier: par rows with no field hole data explained, kept off the radar; no fake bars',()=>{
 const fp={window:'Last 24 months',cohort:'LPGA',division:'women',dimensions:[{code:'scoring',percentile:71,confidence:'HIGH',sample:60,basis:'rounds'},{code:'consistency',percentile:40,confidence:'HIGH',sample:60,basis:'rounds'},{code:'cuts',percentile:null,confidence:'INSUFFICIENT',sample:2,basis:'starts'},{code:'top10',percentile:55,confidence:'MEDIUM',sample:8,basis:'starts'}]};
 const m=dnaModel(fp);const par3=m.metrics.find(x=>x.key==='par3');assert.equal(par3.missing,true);assert.equal(par3.withheld.detail,'Full-field comparable hole data is not available for this dimension.');
 const html=metricBars(m);assert.equal((html.match(/Percentile withheld/g)||[]).length,4);assert.doesNotMatch(html,/data-raw="par3"/);assert.match(html,/Qualifies at 3 full-field starts \(Limited confidence\); 2 observed/);
 assert.equal((html.match(/data-w=/g)||[]).length,3,'bars only for published percentiles');
 const hero=dnaHero({name:'X',visuals:{form:[]},summary:{}},m);assert.doesNotMatch(hero,/PAR 3|P3/);
 const withHoles=dnaModel({...fp,dimensions:[...fp.dimensions,{code:'par4',percentile:null,confidence:'INSUFFICIENT',sample:20,basis:'holes'}]});
 assert.equal(withHoles.metrics.filter(x=>x.missing).length,0,'when hole data exists the real rows are used');
});
test('recent-form sparkline: same observed values, zero baseline, keyboard/hover values, no trend claim',()=>{
 const f=Array.from({length:14},(_,i)=>({name:'Event '+i,ends_on:'2026-0'+(1+i%9)+'-01',vs_field:i===5?null:(i%4-1.5)/2}));
 const s=sparkline(f);const n=(s.match(/class="spark-pt/g)||[]).length;assert.equal(n,10);assert.match(s,/class="spark-zero"/);assert.equal((s.match(/tabindex="0"/g)||[]).length,10);
 assert.match(s,/Event 11: \+0\.75 per round vs field/);assert.match(s,/Event 13: −0\.25 per round vs field/);assert.doesNotMatch(s,/trend|momentum|score|forecast/i);assert.doesNotMatch(s,/ style=/);
 assert.equal(sparkline(f.slice(0,3)),'');assert.equal(sparkline([]),'');
});
