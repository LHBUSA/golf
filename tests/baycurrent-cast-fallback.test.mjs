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

// Production payload (2026-10-10): sourced 2026 setup, no OSM routing.
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
