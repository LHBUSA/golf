import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canShowCoursePanel } from '../src/lib/cast-v3-live.js';
import { courseMapModule } from '../src/lib/course-map.js';

const setup={year:2026,par:71,yardage:7315,holes:[]};
const M={course:{slug:'yokohama-country-club-ec11328',name:'Yokohama Country Club'},setup,geometry:null,geometry_status:'NO MAPPED ROUTING',holes:Array.from({length:18},(_,i)=>({hole:i+1,setup:{par:i===2?3:4,yards:400},route:null}))};
test('course panel is available without geometry when a sourced setup exists',()=>{
 assert.equal(canShowCoursePanel(M),true);
 const h=courseMapModule(M,{mode:'cast'});
 assert.match(h,/Course layout not yet mapped/);
 assert.match(h,/2026 championship setup/);
 assert.doesNotMatch(h,/<svg/);
});
test('course panel remains gated if neither sourced setup nor routing exists',()=>{
 assert.equal(canShowCoursePanel(null),false);
 assert.equal(canShowCoursePanel({geometry:null,setup:null}),false);
});
test('verified/partial routing remains eligible',()=>{
 assert.equal(canShowCoursePanel({...M,geometry:{bounds:[0,0,1,1]}}),true);
});

// Production payload captured 2026-10-10 BEFORE Yokohama routing went live (golf#11 / #13): kept as the canonical
// tier-C (setup, no routing) example. Production now serves PARTIAL 17/18 for this course.
const prod=JSON.parse(readFileSync(new URL('./fixtures/course-map-yokohama-2026.json',import.meta.url),'utf8'));
test('Baycurrent production payload: scorecard-only Course View, no map, no OSM credit',()=>{
 assert.equal(prod.geometry,null);
 assert.equal(canShowCoursePanel(prod),true);
 const h=courseMapModule(prod,{mode:'cast',current:7});
 assert.match(h,/data-tier="C"/);
 assert.match(h,/SCORECARD LAYOUT ONLY/);
 assert.equal((h.match(/<th scope="col">\d+<\/th>/g)||[]).length,18);
 assert.match(h,/7,315/);
 assert.doesNotMatch(h,/<svg|OpenStreetMap|cm-current/);
});

// golf#18: a failed /map answer must not be memoised for the whole session (the panel could never appear).
test('fetchCourseMap: non-OK and network failures are retried; OK answers are memoised per course+edition',async()=>{
 const {fetchCourseMap}=await import('../src/lib/course-map-live.js');const calls=[];const real=globalThis.fetch;
 let mode='500';globalThis.fetch=async u=>{calls.push(u);if(mode==='net')throw new Error('offline');return mode==='500'?{ok:false,json:async()=>null}:{ok:true,json:async()=>({setup:{year:2026}})};};
 try{
  assert.equal(await fetchCourseMap('x-course','ed-1'),null);mode='net';assert.equal(await fetchCourseMap('x-course','ed-1'),null);
  mode='ok';assert.deepEqual(await fetchCourseMap('x-course','ed-1'),{setup:{year:2026}});await fetchCourseMap('x-course','ed-1');
  assert.equal(calls.length,3);assert.match(calls[0],/\/api\/v1\/courses\/x-course\/map\?edition=ed-1$/);
 }finally{globalThis.fetch=real;}
});
test('hole-linked live events promise only what every course can do: show the hole (map or golfer panel)',async()=>{
 const {pulseList}=await import('../src/lib/cast-v3.js');
 const h=pulseList([{t:'2026-10-10T10:00:00Z',text:'Birdie at 7',hole:7,keys:['p1'],who:[]}]);
 assert.match(h,/aria-label="[^"]*Show hole 7"/);assert.doesNotMatch(h,/Course View/);assert.match(h,/data-pulse-hole="7"/);
});
// golf#18 review: an explicit live edition without a published hole table must not strip a mapped course's par/yardage.
test('chooseCourseMap: live edition only when it has a hole table; else the default; bare edition only as last resort',async()=>{
 const {chooseCourseMap}=await import('../src/lib/cast-v3-live.js');
 const table=(ed,par)=>({setup:{edition:ed},geometry:{bounds:[0,0,1,1]},holes:Array.from({length:18},(_,i)=>({hole:i+1,setup:{edition:ed,par,yards:par?400:null}}))});
 const live=table('open-2026',null),prior=table('open-2017',4),liveT=table('open-2026',4);
 assert.equal(chooseCourseMap(liveT,prior),liveT,'live edition with a table wins');
 assert.equal(chooseCourseMap(live,prior),prior,'200 without a table falls back to the default (U.S. Open / The Open / Evian case)');
 assert.equal(chooseCourseMap(null,prior),prior,'404 / failure falls back');
 assert.equal(chooseCourseMap(live,null),live,'nothing better: the honest bare setup');
 assert.equal(chooseCourseMap({geometry:null,setup:null,holes:[]},null),null);
 const noTableDefault={setup:{edition:'x'},geometry:null,holes:[]};assert.equal(chooseCourseMap(live,noTableDefault),live);
});
test('fetchCourseMap fresh:true bypasses the session memo (live-edition re-check can see a newly published table)',async()=>{
 const {fetchCourseMap}=await import('../src/lib/course-map-live.js');const real=globalThis.fetch;let n=0;
 globalThis.fetch=async()=>({ok:true,json:async()=>({v:++n})});
 try{assert.deepEqual(await fetchCourseMap('fresh-c','e'),{v:1});assert.deepEqual(await fetchCourseMap('fresh-c','e'),{v:1});assert.deepEqual(await fetchCourseMap('fresh-c','e',{fresh:true}),{v:2});}finally{globalThis.fetch=real;}
});
