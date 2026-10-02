import test from 'node:test';import assert from 'node:assert/strict';
import {matchCourse,nameScore} from '../workers/shared/course-geo.js';
// Synthetic Overpass-shaped elements (not OSM data).
const sq=(x0,y0,d)=>[{lon:x0,lat:y0},{lon:x0+d,lat:y0},{lon:x0+d,lat:y0+d},{lon:x0,lat:y0+d},{lon:x0,lat:y0}];
const course=(id,name,x,y,d=0.02,tags={})=>({type:'way',id,tags:{leisure:'golf_course',name,...tags},geometry:sq(x,y,d)});
const hole=(id,ref,x,y,par='4',len=0.003)=>({type:'way',id,tags:{golf:'hole',ref:String(ref),par},geometry:[{lon:x,lat:y},{lon:x,lat:y+len}]});
const holes18=(x,y)=>Array.from({length:18},(_,i)=>hole(1000+i,i+1,x+0.001*(i+1),y+0.002));
const SH=new Map(Array.from({length:18},(_,i)=>[i+1,{hole:i+1,par:4,yards:360}]));
const canon={slug:'a',name:'Alpha National Golf Club',locality:'Alpha',country_code:'US',latitude:10.01,longitude:20.01};
test('exact: canonical point inside one boundary + 18 proven holes with par agreement',()=>{
 const r=matchCourse(canon,[course(1,'Alpha National',20,10),...holes18(20,10)],SH);assert.equal(r.decision,'exact');assert.equal(r.state,'VERIFIED ROUTING');assert.equal(r.evidence.proven,18);});
test('two containing polygons (resort / overlapping) -> review, never picked',()=>{
 const r=matchCourse(canon,[course(1,'Alpha North',20,10),course(2,'Alpha South',20,10),...holes18(20,10)],SH);assert.equal(r.decision,'review_multiple_containing');assert.equal(r.target,null);});
test('holes of a neighbouring course are never attached',()=>{
 const r=matchCourse(canon,[course(1,'Alpha National',20,10),course(2,'Beta Links',20.03,10),...holes18(20.03,10)],SH);assert.equal(r.evidence.proven,0);assert.notEqual(r.state,'VERIFIED ROUTING');assert.deepEqual(r.evidence.resort_neighbours,['Beta Links']);});
test('point outside every boundary: near + same name -> review only; otherwise no match',()=>{
 const near=matchCourse({...canon,latitude:9.9995,longitude:20.01},[course(1,'Alpha National Golf Club',20,10),...holes18(20,10)],SH);assert.equal(near.decision,'review_point_outside_boundary');assert.equal(near.state,'REVIEW_OR_NONE');
 const far=matchCourse({...canon,latitude:9.9,longitude:20.01},[course(1,'Alpha National Golf Club',20,10)],SH);assert.equal(far.decision,'no_match_point_outside_boundary');});
test('name-only location (no canonical coords) is always review',()=>{const r=matchCourse({...canon,latitude:null,longitude:null},[course(1,'Alpha National',20,10),...holes18(20,10)],SH,{namedId:'way/1'});assert.equal(r.decision,'review_no_canonical_coords');assert.equal(r.state,'REVIEW_OR_NONE');});
test('par conflict keeps geometry partial; locality conflict -> review',()=>{
 const hs=holes18(20,10);hs[12]=hole(2012,13,20.013,10.002,'5');const r=matchCourse(canon,[course(1,'Alpha National',20,10),...hs],SH);assert.equal(r.decision,'exact');assert.equal(r.state,'PARTIAL ROUTING');assert.deepEqual(r.evidence.par.disagree,[13]);
 const l=matchCourse(canon,[course(1,'Alpha National',20,10,0.02,{'addr:city':'Gamma'}),...holes18(20,10)],SH);assert.equal(l.decision,'review_locality_or_country_conflict');});
test('weak identity: inside boundary, different name, no complete hole proof -> review',()=>{const r=matchCourse(canon,[course(1,'Zeta Municipal',20,10)],SH);assert.equal(r.decision,'review_weak_identity');});
test('name normalisation ignores generic words',()=>{assert.equal(nameScore('Augusta National Golf Club','Augusta National'),1);assert.equal(nameScore('Pebble Beach Golf Links','Spyglass Hill'),0);});
