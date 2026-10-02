import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {prepareCourseMap,courseMapSvg,courseMapModule,holePanel,relativeWind,bearing,simplify,basisLabel,yardageBook,difficultyScale,ATTRIBUTION} from '../src/lib/course-map.js';
// Synthetic OSM-shaped input (not OSM data): a grid of 18 holes around a point.
const C=[33.5,-82.02];
const hole=(n,ref=String(n))=>({id:'way/'+n,ref,par:'4',coords:[[C[1]+n*0.001,C[0]],[C[1]+n*0.001,C[0]+0.003]]});
const osm=(holes)=>({as_of:'2026-10-02T00:00:00Z',course:{id:'relation/1',outer:[[C[1],C[0]-0.001],[C[1]+0.02,C[0]-0.001],[C[1]+0.02,C[0]+0.004],[C[1],C[0]+0.004],[C[1],C[0]-0.001]]},holes,features:[{id:'way/900',golf:'green',closed:true,coords:[[C[1]+0.001,C[0]+0.003],[C[1]+0.0012,C[0]+0.003],[C[1]+0.0012,C[0]+0.0032],[C[1]+0.001,C[0]+0.003]]}]});
const setup={edition:'x-2026',year:2026,label:'2026 Test Open championship setup',par:72,yardage:7200,holes:Array.from({length:18},(_,i)=>({hole:i+1,par:i%3?4:5,yards:400}))};
const scoring={edition:'x-2026',year:2026,basis:'hole-by-hole scorecards observed for this edition',holes:Array.from({length:18},(_,i)=>({hole:i+1,avg_to_par:(i%5-2)/10,sample:10}))};
const full=()=>prepareCourseMap(osm(Array.from({length:18},(_,i)=>hole(i+1))),{slug:'x',name:'X',setup,scoring});

test('full map: exactly 18 numbered routes, unique holes, tier A, attribution',()=>{
 const m=full();assert.equal(m.tier,'A');assert.equal(m.holes.filter(h=>h.route).length,18);assert.equal(new Set(m.holes.map(h=>h.hole)).size,18);
 const svg=courseMapSvg(m);assert.equal((svg.match(/class="cm-route/g)||[]).length,18);assert.ok(svg.includes(ATTRIBUTION.text));
 const mod=courseMapModule(m);assert.match(mod,/openstreetmap\.org\/copyright/);assert.match(mod,/Open Database License/);
});
test('duplicate or non-numeric refs are never guessed; missing stays missing',()=>{
 const hs=Array.from({length:18},(_,i)=>hole(i+1));hs[4]=hole(5,'4');hs[9]=hole(10,'10a');hs.push(hole(19,'19'));
 const m=prepareCourseMap(osm(hs),{slug:'x',name:'X',setup});
 assert.equal(m.holes.find(h=>h.hole===4).route,null,'duplicate ref 4 dropped');assert.equal(m.holes.find(h=>h.hole===5).route,null);assert.equal(m.holes.find(h=>h.hole===10).route,null);
 assert.equal(m.tier,'B');assert.equal(m.coverage.holes_mapped,15);assert.match(basisLabel(m),/15 OF 18 HOLES MAPPED/);
 assert.equal((courseMapSvg(m).match(/class="cm-route/g)||[]).length,15);
});
test('no geometry -> Level C yardage book, never a map, no OSM attribution claim',()=>{
 const m=prepareCourseMap(null,{slug:'y',name:'Y',setup});assert.equal(m.tier,'C');assert.equal(courseMapSvg(m),'');
 const mod=courseMapModule(m);assert.doesNotMatch(mod,/<svg/);assert.doesNotMatch(mod,/OpenStreetMap/);assert.match(mod,/SCORECARD LAYOUT · NO MAPPED ROUTING/);
 assert.equal((yardageBook(m).match(/cm-card/g)||[]).length,18);
});
test('current geometry is never labelled as a historical setup; setup changes never move geometry',()=>{
 const a=full(),b=prepareCourseMap(osm(Array.from({length:18},(_,i)=>hole(i+1))),{slug:'x',name:'X',setup:{...setup,year:2001,label:'2001 Test Open championship setup',yardage:6900,holes:setup.holes.map(h=>({...h,yards:350}))}});
 assert.deepEqual(a.holes.map(h=>h.route),b.holes.map(h=>h.route));assert.deepEqual(a.geometry.bounds,b.geometry.bounds);
 assert.match(basisLabel(b),/^CURRENT MAPPED ROUTING · OPENSTREETMAP AS OF 2026-10-02/);assert.doesNotMatch(basisLabel(b),/2001/);
 assert.match(courseMapModule(b),/not a historical setup/);
});
test('OSM par is evidence only: displayed par/yardage come from our setup',()=>{const m=full();assert.equal(m.holes[0].par,5);assert.equal(m.holes[0].yards,400);});
test('relative wind only with an observed bearing',()=>{
 assert.equal(relativeWind(null,270),null);assert.equal(relativeWind(0,270).label,'CROSSWIND LEFT → RIGHT');assert.equal(relativeWind(0,90).label,'CROSSWIND RIGHT → LEFT');
 assert.equal(relativeWind(0,0).kind,'into');assert.equal(relativeWind(0,180).kind,'helping');
 const m=full();const hp=holePanel(m,3,{wind:{from_deg:270,dir:'W',mph:8}});assert.match(hp,/CROSSWIND/);
 const c=prepareCourseMap(null,{slug:'y',name:'Y',setup});assert.doesNotMatch(holePanel(c,3,{wind:{from_deg:270,dir:'W',mph:8}}),/CROSSWIND|INTO|DOWNWIND/);
 assert.equal(Math.round(bearing([[0,0],[0,1]])),0);assert.equal(Math.round(bearing([[0,0],[1,0]])),90);
});
test('PBEcast current hole highlights the whole route; never a player or ball marker',()=>{
 const svg=courseMapSvg(full(),{current:16});assert.equal((svg.match(/is-current/g)||[]).length,1);assert.doesNotMatch(svg,/ball|player|location/i);
 assert.match(courseMapModule(full(),{current:16}),/CURRENT HOLE · 16/);
});
test('difficulty overlay keeps cohort/sample labels and needs real observations',()=>{
 const mod=courseMapModule(full(),{overlay:'difficulty'});assert.match(mod,/contenders’ average to par · 2026 · up to 10 cards per hole/);
 assert.equal(difficultyScale({holes:[{hole:1,avg_to_par:0.2,sample:3}]}),null);assert.equal(difficultyScale(null),null);
});
test('focus zooms to the hole and the panel shows only sourced fields',()=>{
 const m=full();const svg=courseMapSvg(m,{focus:12});assert.match(svg,/hole 12 focused/);const hp=holePanel(m,12);
 assert.match(hp,/HOLE 12/);assert.match(hp,/Contenders’ average/);assert.match(hp,/Observed cards/);assert.doesNotMatch(hp,/landing|club|pin|ideal|strategy/i);
});
test('simplify keeps endpoints and drops collinear points',()=>{assert.deepEqual(simplify([[0,0],[1,0.01],[2,0]],1),[[0,0],[2,0]]);});
// Real prepared fixtures (OSM-derived, ODbL): Augusta National (tier A expected) and Black Desert (review).
for(const f of ['course-map-augusta.json','course-map-black-desert.json']){const p=new URL('./fixtures/'+f,import.meta.url);if(!fs.existsSync(p))continue;
 test('fixture '+f+': licence note, unique holes, routes match tier',()=>{const m=JSON.parse(fs.readFileSync(p,'utf8'));assert.match(m._license,/ODbL/);assert.equal(new Set(m.holes.map(h=>h.hole)).size,18);
  assert.equal(m.holes.filter(h=>h.route).length,m.coverage.holes_mapped);if(m.tier==='A')assert.equal(m.coverage.holes_mapped,18);assert.ok(courseMapSvg(m).includes(ATTRIBUTION.text));assert.ok(JSON.stringify(m).length<200000,'payload stays light');});}
