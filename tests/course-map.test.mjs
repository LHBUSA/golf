import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {courseMapSvg,courseMapModule,holePanel,relativeWind,bearing,simplify,basisLabel,yardageBook,difficultyScale,selfIntersects,resolveHoles,tierOf} from '../src/lib/course-map.js';
import {courseMap,openData,METHOD} from '../workers/golf-api/src/course-map.js';
import {defaultEdition,setupOptions,buildSetup} from '../workers/shared/course-setup.js';
// Real OSM-derived prepared payloads (ODbL, © OpenStreetMap contributors) + real Augusta edition docs (2025/2026 + the 2027 stub).
const fx=f=>JSON.parse(fs.readFileSync(new URL('./fixtures/'+f,import.meta.url),'utf8'));
const AUG=fx('course-map-augusta.json'),BD=fx('course-map-black-desert.json'),SET=fx('course-setup-augusta.json');
const NOW=new Date('2026-10-02T20:00:00Z');
const A='augusta-national-golf-club-q765780';
const augEds=[{slug:'masters-tournament-epga15-2027',year:2027,name:'Masters Tournament',starts_on:'2027-04-08',status:'scheduled',coverage:'schedule_only',course:{slug:A}},
 {slug:'masters-tournament-q280275-2026',year:2026,name:'2026 Masters Tournament',starts_on:'2026-04-09',status:'completed',coverage:'full_field',course:{slug:A}},
 {slug:'masters-tournament-q280275-2025',year:2025,name:'2025 Masters Tournament',starts_on:'2025-04-10',status:'completed',coverage:'full_field',course:{slug:A}}];
const ix={courses:[{slug:A,name:'Augusta National Golf Club'},{slug:'tpc-sawgrass-q1',name:'TPC Sawgrass'}],editions:[...augEds,{slug:'players-2026',year:2026,name:'2026 The Players',starts_on:'2026-03-12',status:'completed',course:{slug:'tpc-sawgrass-q1'}}]};
const store={['osm-routing/v1/courses/'+A+'.json']:AUG,...Object.fromEntries(SET.editions.map(e=>['projection/v2/editions/'+e.slug+'.json',e])),
 'projection/v2/editions/players-2026.json':{slug:'players-2026',year:2026,name:'2026 The Players',layout:{label:'2026 THE PLAYERS setup',par:72,yardage:7275,holes:Array.from({length:18},(_,i)=>({hole:i+1,par:4,yards:400}))},leaderboard:[]}};
const envOf=st=>({PUBLIC:{get:async k=>st[k]?{text:async()=>JSON.stringify(st[k]),body:JSON.stringify(st[k])}:null}});
const env=envOf(store);
const api=async(slug,ed=null)=>(await courseMap(env,ix,slug,ed,NOW)).body;

test('A. a future edition stub never becomes the default setup (Augusta -> 2026, not 2027)',async()=>{
 assert.equal(defaultEdition(augEds,NOW).slug,'masters-tournament-q280275-2026');
 assert.deepEqual(setupOptions(augEds,NOW).map(o=>o.year),[2026,2025]);
 // A current edition still tagged schedule_only (live week) is current, not future; completed history stays selectable.
 assert.equal(defaultEdition([{slug:'boc-2026',starts_on:'2026-10-01',status:'in_progress',coverage:'schedule_only'},{slug:'boc-2025',starts_on:'2025-10-23',status:'completed'}],NOW).slug,'boc-2026');
 const M=await api(A);assert.equal(M.setup.year,2026);assert.equal(M.setup.yardage,7565);assert.ok(!M.setups.some(s=>s.year===2027));
 assert.equal((await courseMap(env,ix,A,'masters-tournament-epga15-2027',NOW)).status,404,'future stub not selectable');
});
test('B. setup and scoring come from one edition; no sample -> explicit empty state, never another year',async()=>{
 for(const ed of [null,'masters-tournament-q280275-2025']){const M=await api(A,ed);
  assert.equal(M.scoring.edition,M.setup.edition);for(const h of M.holes){if(h.scoring)assert.equal(h.scoring.edition,M.setup.edition);assert.equal(h.setup.edition,M.setup.edition);}}
 assert.equal((await api(A,'masters-tournament-q280275-2025')).scoring.cohort,'Observed field cards');
 assert.equal((await api(A)).scoring.cohort,'Contender sample');
 const r=buildSetup(SET.editions[0]);assert.equal(r.scoring.edition,r.setup.edition);
 const p=await api('tpc-sawgrass-q1');assert.equal(p.scoring,null);const hp=holePanel(p,7);assert.match(hp,/No scoring sample available for the selected 2026 setup/);assert.doesNotMatch(hp,/2025/);
});
test('C. wind language is geometry/weather description only',()=>{
 assert.equal(relativeWind(null,270),null);assert.equal(relativeWind(0,null),null);
 assert.equal(relativeWind(0,180).label,'TAILWIND');assert.equal(relativeWind(0,0).label,'HEADWIND');
 assert.equal(relativeWind(0,270).label,'CROSSWIND · LEFT → RIGHT');assert.equal(relativeWind(0,90).label,'CROSSWIND · RIGHT → LEFT');
 assert.equal(relativeWind(0,135).label,'QUARTERING TAILWIND');assert.equal(relativeWind(0,45).label,'QUARTERING HEADWIND');
 for(let w=0;w<360;w+=5)assert.doesNotMatch(relativeWind(37,w).label,/HELP|HURT|EASIER|HARDER|ADVANTAGE|CLUB/);
 assert.equal(Math.round(bearing([[0,0],[0,1]])),0);assert.equal(Math.round(bearing([[0,0],[1,0]])),90);
});
test('Augusta: PARTIAL 17/18, hole 6 withheld (never drawn, never guessed), attribution on the map',async()=>{
 const M=await api(A);assert.equal(tierOf(M),'B');assert.equal(M.coverage.holes_mapped,17);
 const h6=M.holes.find(h=>h.hole===6);assert.equal(h6.geometry_status,'withheld');assert.equal(h6.route,null);
 const mod=courseMapModule(M);assert.match(mod,/17 OF 18 HOLE ROUTES VERIFIED/);assert.match(mod,/Hole 6 routing withheld pending identity verification/);
 assert.equal((courseMapSvg(M).match(/class="cm-route/g)||[]).length,17);assert.doesNotMatch(courseMapSvg(M),/data-hole="6"/);
 assert.match(mod,/openstreetmap\.org\/copyright/);assert.match(mod,/© OpenStreetMap contributors/);assert.match(mod,/Open Database License/);
 assert.match(holePanel(M,6),/Hole 6 routing withheld/);
});
test('Black Desert: VERIFIED 18/18; OSM par/length differences kept as metadata; geometry carries no setup facts',()=>{
 assert.equal(BD.geometry_status,'VERIFIED ROUTING');assert.equal(BD.holes.filter(h=>h.route).length,18);assert.equal(new Set(BD.holes.map(h=>h.hole)).size,18);
 assert.equal(BD.geometry_metadata_conflicts.find(c=>c.hole===13).field,'par');
 assert.ok(BD.holes.every(h=>!('par' in h)&&!('yards' in h)));assert.match(BD._license,/ODbL/);
});
test('no geometry -> intentional no-layout state + real scorecard only; never a map, no OSM attribution claim',async()=>{
 const M=await api('tpc-sawgrass-q1');assert.equal(tierOf(M),'C');assert.equal(courseMapSvg(M),'');assert.equal(M.attribution,null);
 const mod=courseMapModule(M);assert.doesNotMatch(mod,/<svg/);assert.doesNotMatch(mod,/OpenStreetMap/);assert.match(mod,/Course layout not yet mapped/);assert.match(mod,/SCORECARD LAYOUT ONLY · NO MAPPED ROUTING YET/);assert.doesNotMatch(mod,/cm-card/,'no pseudo-layout tiles');
 assert.match(mod,/<th scope="col">Out<\/th>/);assert.equal(typeof M.routing_status.text,'string');
 const noTable={...M,holes:M.holes.map(h=>({...h,setup:{...h.setup,par:null,yards:null}}))};assert.doesNotMatch(courseMapModule(noTable),/cm-sc/,'no scorecard without a complete hole table');
 assert.ok(M.holes.every(h=>h.geometry_status==='none'&&h.route===null));
});
test('a setup switch changes par/yards/scoring, never geometry; labels say current routing',async()=>{
 const a=await api(A),b=await api(A,'masters-tournament-q280275-2025');
 assert.deepEqual(a.holes.map(h=>h.route),b.holes.map(h=>h.route));assert.deepEqual(a.bounds,b.bounds);assert.equal(a.geometry_as_of,b.geometry_as_of);
 assert.notEqual(a.setup.yardage,b.setup.yardage);
 assert.match(courseMapModule(b),/Current mapped routing · 2025 championship setup/);assert.match(basisLabel(b),/CURRENT MAPPED ROUTING · OPENSTREETMAP AS OF/);assert.doesNotMatch(basisLabel(b),/2025/);
 assert.match(courseMapModule(a),/<option value="masters-tournament-q280275-2025">2025/);
});
test('PBEcast: the current hole is a whole highlighted route, never a golfer/ball marker; wind only on observed bearings',()=>{
 const M={...BD,course:{slug:'bd',name:'Black Desert'},bounds:BD.geometry.bounds,holes:BD.holes.map(h=>({...h,geometry_status:'verified',setup:{edition:'e',par:4,yards:500},scoring:null}))};
 const svg=courseMapSvg(M,{current:16});assert.equal((svg.match(/cm-route is-current/g)||[]).length,1);assert.doesNotMatch(svg,/ball|player|golfer|marker|location/i);
 const mod=courseMapModule(M,{current:16,mode:'cast'});assert.match(mod,/CURRENT HOLE<\/span> <b>16<\/b> · PAR 4 · 500 YDS/);assert.match(mod,/COURSE VIEW/);assert.doesNotMatch(mod,/data-cm-setup/);
 const hp=holePanel(M,16,{wind:{from_deg:157.5,dir:'SSE',mph:8,precision:'locality'}});assert.match(hp,/SSE · 8 MPH/);assert.match(hp,/PBE-derived from sourced routing \+ weather observation \(town-level estimate\)/);
 const un={...M,holes:M.holes.map(h=>h.hole===16?{...h,geometry_status:'unmapped',route:null,bearing_deg:null}:h)};assert.doesNotMatch(holePanel(un,16,{wind:{from_deg:157.5,dir:'SSE',mph:8}}),/WIND/);
});
test('difficulty overlay: real observations only; cohort and edition labelled',async()=>{
 const M=await api(A);assert.ok(difficultyScale(M));const mod=courseMapModule(M,{overlay:'difficulty'});
 assert.match(mod,/Contender sample · 2026 edition/);assert.match(mod,/Not the full field/);assert.equal((courseMapSvg(M,{overlay:'difficulty'}).match(/cm-d[0-4]/g)||[]).length,17);
 assert.equal(difficultyScale({holes:[{hole:1,scoring:{avg_to_par:0.2,sample:3}}]}),null);
});
test('payloads stay light and topology-safe',()=>{for(const m of [AUG,BD]){assert.ok(JSON.stringify(m).length<60000);for(const k of Object.keys(m.geometry.features))for(const r of m.geometry.features[k])assert.equal(selfIntersects(r),false);}});
test('duplicate refs resolve only by a unique par + length match (par-3 course inside the club polygon)',()=>{
 const C=[33.5,-82.02],L=(n,m)=>[[C[1]+n*0.001,C[0]],[C[1]+n*0.001,C[0]+m/111195]];
 const champ={id:'way/a',ref:'4',par:'3',coords:L(4,240*0.9144)},short={id:'way/b',ref:'4',par:'3',coords:L(40,90*0.9144)};
 const sh=new Map([[4,{hole:4,par:3,yards:240}]]);let r=resolveHoles([champ,short],sh);assert.equal(r.accepted.length,1);assert.equal(r.accepted[0].id,'way/a');
 r=resolveHoles([champ,{...champ,id:'way/c'}],sh);assert.equal(r.accepted.length,0);r=resolveHoles([champ,short],new Map());assert.equal(r.accepted.length,0,'no setup evidence -> no guess');
});
test('ODbL open data: licence, attribution, per-course downloads and the method are served',async()=>{
 const env2=envOf({...store,'osm-routing/v1/index.json':{generated_at:'2026-10-02',counts:{},courses:[{slug:A,name:'Augusta',status:'partial',holes_mapped:17,osm_course:'way/1',retrieved_at:'2026-10-02'},{slug:'x',name:'X',status:'held',holes_mapped:0}]}});
 const i=await openData(env2,[]);assert.equal(i.body.licence,'ODbL-1.0');assert.match(i.body.attribution,/OpenStreetMap contributors/);assert.equal(i.body.courses.length,1);assert.equal(i.body.courses[0].download,'/v1/open-data/course-routing/'+A+'.geojson');
 const m=await openData(env2,['method']);assert.match(m.text,/ODbL/);assert.match(METHOD,/Prove hole numbers/);
});
test('simplify keeps endpoints and drops collinear points',()=>{assert.deepEqual(simplify([[0,0],[1,0.01],[2,0]],1),[[0,0],[2,0]]);});
test('default setup skips a started edition without a hole table (never a future one)',async()=>{
 const st={...store,'projection/v2/editions/players-2026.json':{slug:'players-2026',year:2026,name:'2026 The Players',layout:{label:'2026 setup',par:72,yardage:7275,holes:[]},leaderboard:[]},
  'projection/v2/editions/players-2025.json':{slug:'players-2025',year:2025,name:'2025 The Players',layout:{label:'2025 setup',par:72,yardage:7256,holes:Array.from({length:18},(_,i)=>({hole:i+1,par:4,yards:390}))},leaderboard:[]}};
 const ix2={...ix,editions:[...ix.editions,{slug:'players-2025',year:2025,name:'2025 The Players',starts_on:'2025-03-13',status:'completed',course:{slug:'tpc-sawgrass-q1'}},{slug:'players-2027',year:2027,name:'2027 The Players',starts_on:'2027-03-11',status:'scheduled',course:{slug:'tpc-sawgrass-q1'}}]};
 const M=(await courseMap(envOf(st),ix2,'tpc-sawgrass-q1',null,NOW)).body;assert.equal(M.setup.year,2025);assert.equal(M.holes[0].setup.yards,390);
 const asked=(await courseMap(envOf(st),ix2,'tpc-sawgrass-q1','players-2026',NOW)).body;assert.equal(asked.setup.year,2026,'an explicit choice is honoured');
});
test('missing hole-by-hole scorecards never suppress verified routing',async()=>{
 const st={...store,'osm-routing/v1/courses/tpc-sawgrass-q1.json':fx('course-map-black-desert.json')};
 const M=(await courseMap(envOf(st),ix,'tpc-sawgrass-q1',null,NOW)).body;assert.equal(M.scoring,null);assert.equal(M.geometry_status,'VERIFIED ROUTING');
 const mod=courseMapModule(M,{mode:'cast',current:7});assert.match(mod,/<svg/);assert.match(mod,/CURRENT HOLE<\/span> <b>7<\/b>/);assert.match(holePanel(M,7),/No scoring sample available/);
});
test('target label: dark chip in on-screen units, kept inside the viewBox, meaning unchanged',()=>{
 const M={...BD,course:{slug:'bd',name:'Black Desert'},bounds:BD.geometry.bounds,holes:BD.holes.map(h=>({...h,geometry_status:'verified',setup:{edition:'e',par:4,yards:500},scoring:null}))};
 for(const n of M.holes.filter(h=>h.distance_reference).map(h=>h.hole))for(const [ar,px] of [[1,358],[0.7,358],[1.6,900]]){
  const svg=courseMapSvg(M,{focus:n,ar,px}),vb=svg.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
  const g=svg.match(/<g class="cm-tg" transform="translate\(([-\d.]+) ([-\d.]+)\)">.*?<rect class="cm-tgl" x="([-\d.]+)" y="([-\d.]+)" width="([\d.]+)" height="([\d.]+)"[^>]*\/><text[^>]*>(MAPPED GREEN|ROUTE END)<\/text>/);
  assert.ok(g,`hole ${n}: label chip present`);const [tx,ty,x,y,w,h]=g.slice(1,7).map(Number);
  const tol=vb[2]*0.002;
  assert.ok(tx+x>=vb[0]-tol&&tx+x+w<=vb[0]+vb[2]+tol&&ty+y>=vb[1]-tol&&ty+y+h<=vb[1]+vb[3]+tol,`hole ${n} ar ${ar}: label inside viewBox`);
  const u=vb[2]/Math.max(280,px);assert.ok(Math.abs(h-9.5*u*1.5)<0.2,'chip scales with on-screen units');
  assert.equal(g[7],M.holes.find(x=>x.hole===n).distance_reference.target_type==='mapped_green_centre'?'MAPPED GREEN':'ROUTE END');
 }
 assert.doesNotMatch(fs.readFileSync(new URL('../src/course-map.css',import.meta.url),'utf8').match(/\.cm-tg text\{[^}]*\}/)[0],/stroke-width/,'no fixed-unit halo on the label');
});
test('withheld routes say why: setup moved after mapping vs identity hold',async()=>{
 const {withheldText}=await import('../src/lib/course-map.js');
 assert.equal(withheldText(18,'setup_changed_after_mapping'),'Hole 18 routing withheld: the championship tee and green were moved after this hole was mapped.');
 assert.equal(withheldText(7,'routing_numbering_differs_from_setup'),'Hole 7 routing withheld pending identity verification.');
});
// golf#11: Yokohama CC composite routing (reviewed crosswalk), real prepared payload; 2026 setup as stored (ESPN).
test('Yokohama: reviewed composite routing PARTIAL 17/18, 18th withheld because the 2026 tee/green moved after mapping',async()=>{
 const Y='yokohama-country-club-ec11328',YK=fx('course-map-yokohama.json');
 const card=[[4,475],[4,418],[3,168],[5,536],[4,436],[5,529],[3,182],[4,357],[4,432],[4,431],[4,510],[4,458],[4,337],[4,508],[4,387],[3,237],[4,439],[4,475]];
 const ed={slug:'baycurrent-classic-q60987711-2026',year:2026,name:'2026 Baycurrent Classic',layout:{label:'2026 Baycurrent Classic setup',par:71,yardage:7315,holes:card.map(([par,yards],i)=>({hole:i+1,par,yards}))},leaderboard:[]};
 const yix={courses:[{slug:Y,name:'Yokohama Country Club'}],editions:[{slug:ed.slug,year:2026,name:ed.name,starts_on:'2026-10-08',status:'in_progress',coverage:'full_field',course:{slug:Y}}]};
 const M=(await courseMap(envOf({['osm-routing/v1/courses/'+Y+'.json']:YK,['projection/v2/editions/'+ed.slug+'.json']:ed}),yix,Y,null,new Date('2026-10-10T12:00:00Z'))).body;
 assert.equal(tierOf(M),'B');assert.equal(M.coverage.holes_mapped,17);assert.equal(M.source.identity.cleared_by,'yokohama-2026-10-10');
 const h18=M.holes.find(h=>h.hole===18);assert.equal(h18.geometry_status,'withheld');assert.equal(h18.route,null);assert.equal(h18.setup.yards,475);
 assert.ok(M.holes.filter(h=>h.hole<18).every(h=>h.route&&h.geometry_status==='verified'));
 const mod=courseMapModule(M,{mode:'cast',current:18});
 assert.match(mod,/17 OF 18 HOLE ROUTES VERIFIED/);assert.match(mod,/Hole 18 routing withheld: the championship tee and green were moved after this hole was mapped/);
 assert.equal((courseMapSvg(M).match(/class="cm-route/g)||[]).length,17);assert.doesNotMatch(courseMapSvg(M),/data-hole="18"/);
 assert.match(mod,/different par on holes 9, 12\./);assert.match(mod,/© OpenStreetMap contributors/);
 assert.match(holePanel(M,18),/tee and green were moved/);
});
