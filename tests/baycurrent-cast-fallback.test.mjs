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
