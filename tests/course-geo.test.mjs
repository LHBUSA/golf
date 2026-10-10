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
test('an OSM par conflict is metadata: geometry stays VERIFIED; locality granularity is not a conflict; country conflict -> review',()=>{
 const hs=holes18(20,10);hs[12]=hole(2012,13,20.013,10.002,'5');const r=matchCourse(canon,[course(1,'Alpha National',20,10),...hs],SH);assert.equal(r.decision,'exact');assert.equal(r.state,'VERIFIED ROUTING');assert.deepEqual(r.evidence.par.disagree,[13]);
 const l=matchCourse(canon,[course(1,'Alpha National',20,10,0.02,{'addr:city':'Gamma'}),...holes18(20,10)],SH);assert.equal(l.decision,'exact');assert.equal(l.evidence.locality_ok,null);
 const c=matchCourse(canon,[course(1,'Alpha National',20,10,0.02,{'addr:country':'GB'}),...holes18(20,10)],SH);assert.equal(c.decision,'review_country_conflict');});
// holes18 routes are ~0.003 deg (~364 yd) long; SH says 360 yd par 4.
test('renumbered routing (2+ holes with par AND length disagreeing) withholds every length-mismatched hole',()=>{
 const hs=holes18(20,10);hs[14]=hole(2014,15,20.015,10.002,'3',0.0011);hs[16]=hole(2016,17,20.017,10.002,'3',0.0011);hs[15]=hole(2015,16,20.016,10.002,'4',0.0055);
 const r=matchCourse(canon,[course(1,'Alpha National',20,10),...hs],SH);assert.equal(r.decision,'exact');assert.equal(r.evidence.proven,15);
 assert.deepEqual(r.evidence.rejected.filter(x=>x.reason==='routing_numbering_differs_from_setup').map(x=>x.ref),[15,16,17]);assert.equal(r.state,'PARTIAL ROUTING');});
test('a length-only difference (same par, e.g. forward-tee route) is kept and recorded, never withheld',()=>{
 const hs=holes18(20,10);hs[2]=hole(2002,3,20.003,10.002,'4',0.002);const r=matchCourse(canon,[course(1,'Alpha National',20,10),...hs],SH);
 assert.equal(r.evidence.proven,18);assert.deepEqual(r.evidence.length_conflicts.map(c=>c.hole),[3]);assert.equal(r.state,'VERIFIED ROUTING');});
test('more than three renumbered holes holds the course (wrong course inside a multi-course property)',()=>{
 const hs=holes18(20,10).map((h,i)=>i%2?hole(3000+i,i+1,20+0.001*(i+1),10.002,'3',0.0011):h);
 const r=matchCourse(canon,[course(1,'Alpha National',20,10),...hs],SH);assert.equal(r.decision,'review_routing_differs_from_setup');assert.equal(r.state,'REVIEW_OR_NONE');});
test('shared-name resort: a neighbour named as well as the target needs 15+ proven holes agreeing on length',()=>{
 const strong=matchCourse(canon,[course(1,'Alpha National Championship',20,10),course(2,'Alpha National Burnside',20.03,10),...holes18(20,10)],SH);assert.equal(strong.decision,'exact');
 const weak=matchCourse(canon,[course(1,'Alpha National Championship',20,10),course(2,'Alpha National Burnside',20.03,10),...holes18(20,10).slice(0,10)],SH);assert.equal(weak.decision,'review_resort_shared_name');});
test('operator tag counts as name evidence (club operates a course named "Old Course")',()=>{const r=matchCourse({...canon,name:'Royal Alpha Golf Club'},[course(1,'Old Course',20,10,0.02,{operator:'Royal Alpha Golf Club'})],SH);assert.equal(r.evidence.name_score,1);assert.equal(r.decision,'exact');});
test('two canonical courses -> one OSM course: both held as duplicate identity',async()=>{const {holdSharedTargets}=await import('../workers/shared/course-geo.js');
 const rows=holdSharedTargets([{slug:'a',decision:'exact',state:'VERIFIED ROUTING',osm_course:{id:'way/1'}},{slug:'b',decision:'exact',state:'VERIFIED ROUTING',osm_course:{id:'way/1'}},{slug:'c',decision:'exact',state:'VERIFIED ROUTING',osm_course:{id:'way/2'}}]);
 assert.deepEqual(rows.map(r=>r.decision),['review_duplicate_canonical_course','review_duplicate_canonical_course','exact']);});
test('weak identity: inside boundary, different name, no complete hole proof -> review',()=>{const r=matchCourse(canon,[course(1,'Zeta Municipal',20,10)],SH);assert.equal(r.decision,'review_weak_identity');});
test('name normalisation ignores generic words',()=>{assert.equal(nameScore('Augusta National Golf Club','Augusta National'),1);assert.equal(nameScore('Pebble Beach Golf Links','Spyglass Hill'),0);});
test('reviewed identity: no coords -> held; evidence clears exactly its element; wrong element or name-only stays held',async()=>{
 const {matchWithEvidence}=await import('../workers/shared/course-geo.js');
 const els=[course(1,'Alpha National',20,10),course(2,'Alpha National Annex',20.05,10),...holes18(20,10)];const noCoords={...canon,latitude:null,longitude:null};
 const held=matchWithEvidence(noCoords,els,SH,null);assert.notEqual(held.decision,'exact');assert.equal(held.state,'REVIEW_OR_NONE');
 const ok=matchWithEvidence(noCoords,els,SH,{osm_course:'way/1',evidence_id:'e1',clears:['review_no_canonical_coords']});assert.equal(ok.decision,'exact');assert.equal(ok.cleared_by,'e1');assert.equal(ok.state,'VERIFIED ROUTING');
 const wrong=matchWithEvidence(noCoords,els,SH,{osm_course:'way/2',evidence_id:'e2',clears:['review_no_canonical_coords']});assert.equal(wrong.evidence.proven,0,'holes of way/1 never attach to way/2');assert.notEqual(wrong.state,'VERIFIED ROUTING');
 const missing=matchWithEvidence(noCoords,els,SH,{osm_course:'way/99',evidence_id:'e3',clears:['review_no_canonical_coords']});assert.notEqual(missing.decision,'exact');
 const notListed=matchWithEvidence(noCoords,els,SH,{osm_course:'way/1',evidence_id:'e4',clears:['review_multiple_containing']});assert.notEqual(notListed.decision,'exact','only listed decisions may be cleared');
});
// golf#11 composite routing (Yokohama: two club courses numbered 1-18 inside one boundary).
test('reviewed crosswalk: composite routing maps club refs to championship holes; withheld hole kept off; incomplete -> review',async()=>{
 const {matchWithEvidence}=await import('../workers/shared/course-geo.js');
 const west=Array.from({length:18},(_,i)=>hole(2000+i,i+1,20.001+0.0005*i,10.002)),east=Array.from({length:18},(_,i)=>hole(3000+i,i+1,20.011+0.0005*i,10.002));
 const els=[course(1,'横浜カントリークラブ',20,10),...west,...east],noCoords={...canon,name:'Yokohama Country Club',latitude:null,longitude:null};
 // Without a crosswalk the duplicate refs cannot be resolved into a championship routing.
 assert.notEqual(matchWithEvidence(noCoords,els,SH,{osm_course:'way/1',evidence_id:'x',clears:['review_no_canonical_coords']}).evidence.proven,18);
 // Championship 1-16 = west 3..18, 17-18 = east 17-18.
 const crosswalk=Object.fromEntries([...Array.from({length:16},(_,i)=>[i+1,'way/'+(2002+i)]),[17,'way/3016'],[18,'way/3017']]);
 const ev={osm_course:'way/1',evidence_id:'yk',clears:['review_no_canonical_coords','review_weak_identity'],crosswalk,withhold:{18:'setup_changed_after_mapping'}};
 const ok=matchWithEvidence(noCoords,els,SH,ev);
 assert.equal(ok.decision,'exact');assert.equal(ok.state,'PARTIAL ROUTING');assert.equal(ok.evidence.proven,17);
 assert.deepEqual(ok.evidence.accepted.map(h=>[h.hole,h.id,h.osm_ref,h.proof]).slice(0,1),[[1,'way/2002','3','reviewed_crosswalk']]);
 assert.equal(ok.evidence.accepted.find(h=>h.hole===17).id,'way/3016');assert.equal(ok.evidence.accepted.find(h=>h.hole===18),undefined);
 assert.deepEqual(ok.evidence.withheld,[{ref:18,candidates:1,reason:'setup_changed_after_mapping'}]);
 // Same crosswalk when canonical coordinates exist: never falls back to ref matching.
 const withCoords=matchWithEvidence({...noCoords,latitude:10.01,longitude:20.01},els,SH,ev);assert.equal(withCoords.decision,'exact');assert.equal(withCoords.evidence.accepted.find(h=>h.hole===1).id,'way/2002');
 // An OSM edit that removes a listed way sends the whole course back to review.
 const gone=matchWithEvidence(noCoords,els.filter(e=>e.id!==2005),SH,ev);assert.equal(gone.decision,'review_crosswalk_incomplete');assert.equal(gone.state,'REVIEW_OR_NONE');
});
test('reviewed crosswalk must list 18 distinct holes on 18 distinct ways; withheld holes leave the par tally',async()=>{
 const {matchWithEvidence}=await import('../workers/shared/course-geo.js');
 const west=Array.from({length:18},(_,i)=>hole(2000+i,i+1,20.001+0.0005*i,10.002)),els=[course(1,'X',20,10),...west];
 const noCoords={...canon,latitude:null,longitude:null},base={osm_course:'way/1',evidence_id:'v',clears:['review_no_canonical_coords']};
 const cw=Object.fromEntries(Array.from({length:18},(_,i)=>[i+1,'way/'+(2000+i)]));
 const dup={...cw,18:'way/2016'};assert.equal(matchWithEvidence(noCoords,els,SH,{...base,crosswalk:dup}).decision,'review_crosswalk_incomplete');
 const short=Object.fromEntries(Object.entries(cw).slice(0,17));assert.equal(matchWithEvidence(noCoords,els,SH,{...base,crosswalk:short}).decision,'review_crosswalk_incomplete');
 const ok=matchWithEvidence(noCoords,els,SH,{...base,crosswalk:cw,withhold:{18:'setup_changed_after_mapping'}});
 assert.equal(ok.decision,'exact');assert.equal(ok.evidence.par.compared,17);assert.equal(ok.evidence.par.agree,17);
});
