import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {holeStats,holeShape,hazardsFor,associateGreens,routeMarkers,windComponents,measureYards,polyLength,targetFor,cardsFromLive} from '../src/lib/hole-intel.js';
import {holePanel,courseMapSvg,courseMapModule} from '../src/lib/course-map.js';
import {courseMap} from '../workers/golf-api/src/course-map.js';
import {pulseEvents,pulseList} from '../src/lib/cast-v3.js';
const fx=f=>JSON.parse(fs.readFileSync(new URL('./fixtures/'+f,import.meta.url),'utf8'));
const AUG=fx('course-map-augusta.json'),BD=fx('course-map-black-desert.json'),SET=fx('course-setup-augusta.json'),LIVE=fx('pbecast-v3-bank-of-utah-r2.json');
const NOW=new Date('2026-10-02T20:00:00Z'),A='augusta-national-golf-club-q765780',B='black-desert-resort-golf-course-ec11307';
const ix={courses:[{slug:A,name:'Augusta National Golf Club'},{slug:B,name:'Black Desert'}],editions:[
 {slug:'masters-tournament-q280275-2026',year:2026,name:'2026 Masters Tournament',starts_on:'2026-04-09',status:'completed',course:{slug:A}},
 {slug:'boc-2026',year:2026,name:'2026 Bank of Utah Championship',starts_on:'2026-10-01',status:'in_progress',coverage:'schedule_only',course:{slug:B}}]};
const bdEd={slug:'boc-2026',year:2026,name:'2026 Bank of Utah Championship',status:'in_progress',layout:{label:'2026 setup',par:71,yardage:7421,holes:LIVE.live.course_holes},leaderboard:[]};
const store={['osm-routing/v1/courses/'+A+'.json']:AUG,['osm-routing/v1/courses/'+B+'.json']:BD,'projection/v2/editions/boc-2026.json':bdEd,...Object.fromEntries(SET.editions.map(e=>['projection/v2/editions/'+e.slug+'.json',e]))};
const env={PUBLIC:{get:async k=>store[k]?{text:async()=>JSON.stringify(store[k])}:null}};
const api=async s=>(await courseMap(env,ix,s,null,NOW)).body;

test('setup yardage and mapped routing length stay separate fields and labels',async()=>{
 const M=await api(B),h=M.holes.find(x=>x.hole===7);
 assert.equal(h.setup.yards,LIVE.live.course_holes.find(x=>x.hole===7).yards);assert.ok(h.geometry_intelligence.mapped_route_yards>0);
 assert.notEqual(h.setup.yards,h.geometry_intelligence.mapped_route_yards);
 const p=holePanel(M,7);assert.match(p,/Championship distance<\/dt><dd>589 yds/);assert.match(p,/Mapped route<\/dt><dd>~\d+ yds <small>current mapped routing/);
});
test('difficulty rank: deterministic, hardest = 1, ties share a rank, min sample enforced',()=>{
 const cards=[];const add=(hole,diffs)=>diffs.forEach(d=>cards.push({hole,diff:d,strokes:4+d}));
 add(1,Array(10).fill(1));add(2,Array(10).fill(1));add(3,Array(10).fill(0));add(4,Array(10).fill(-1));add(5,[2,2,2]);
 const s=holeStats(cards);assert.equal(s.get(1).difficulty_rank,1);assert.equal(s.get(2).difficulty_rank,1);assert.ok(s.get(1).difficulty_tied);
 assert.equal(s.get(3).difficulty_rank,3);assert.equal(s.get(4).difficulty_rank,4);assert.equal(s.get(5).difficulty_rank,null,'below min sample: not ranked');assert.equal(s.get(1).difficulty_of,4);
 assert.deepEqual([...holeStats([...cards].reverse()).values()].map(r=>[r.hole,r.difficulty_rank]).sort(),[...s.values()].map(r=>[r.hole,r.difficulty_rank]).sort(),'order-independent');
});
test('scoring distribution sums to the sample on real live cards; incomplete distributions are never shown',()=>{
 const s=holeStats(cardsFromLive(LIVE.live.hole_scores));assert.equal(s.size,18);
 for(const r of s.values()){const t=Object.values(r.distribution).reduce((a,b)=>a+b.count,0);assert.equal(t,r.sample);}
 const M={course:{name:'X'},geometry_status:'VERIFIED ROUTING',setup:{year:2026},holes:[{hole:1,geometry_status:'verified',setup:{par:4,yards:400},scoring:{avg_to_par:0,sample:10,cohort:'Observed field cards',distribution:{eagle_or_better:{count:0,pct:0},birdie:{count:2,pct:20},par:{count:5,pct:50},bogey:{count:1,pct:10},double_or_worse:{count:0,pct:0}}}}]};
 assert.doesNotMatch(holePanel(M,1),/cm-dist/,'8 of 10 cards in buckets -> no table');
});
test('measurement is a user-selected map point to a named target; never a player distance, pin or flag',async()=>{
 const M=await api(B);const h=M.holes.find(x=>x.hole===7);const t=h.distance_reference.target;
 const m={point:[t[0]+150*0.9144,t[1]],yards:measureYards([t[0]+150*0.9144,t[1]],t)};assert.equal(m.yards,150);
 const p=holePanel(M,7,{measure:m}),svg=courseMapSvg(M,{focus:7,measure:m,px:600});
 assert.match(p,/~150 yds <small>to mapped green \(centre\), from the point you selected/);
 for(const s of [p,svg,courseMapModule(M,{focus:7,measure:m})])assert.doesNotMatch(s,/\bpin\b|flag|remaining|player is|ball|shot tracer|landing/i);
 assert.match(svg,/MAPPED GREEN/);
});
test('route markers sit at the right along-route distance from the route end',()=>{
 const r=[[0,0],[0,-300*0.9144]];const mk=routeMarkers(r);assert.deepEqual(mk.map(m=>m.yards),[200,150,100,50]);
 for(const m of mk){const along=polyLength([r[0],m.point]);assert.ok(Math.abs(along/0.9144-(300-m.yards))<0.2);}
 assert.deepEqual(routeMarkers([[0,0],[0,-120*0.9144]]).map(m=>m.yards),[50],'needs route length > marker + 20 m');
 const bent=[[0,0],[0,-200*0.9144],[150*0.9144,-200*0.9144]];const m100=routeMarkers(bent).find(m=>m.yards===100);assert.ok(Math.abs(m100.point[0]-50*0.9144)<0.2&&Math.abs(m100.point[1]+200*0.9144)<0.2);
});
test('dogleg classification is deterministic and directional (y points south)',()=>{
 const north=[[0,0],[0,-250],[0,-400]];assert.equal(holeShape(north,4).shape,'mostly_straight');
 const right=[[0,0],[0,-250],[150,-400]];const l=[[0,0],[0,-250],[-150,-400]];
 assert.equal(holeShape(right,4).shape,'dogleg_right');assert.equal(holeShape(l,4).shape,'dogleg_left');assert.deepEqual(holeShape(right,4),holeShape(right,4));
 assert.equal(holeShape(right,3),null,'par 3s unclassified');assert.equal(holeShape([[0,0],[0,-400]],4),null,'two-point route unclassified');
 assert.equal(holeShape([[0,0],[0,-250],[50,-400]],4),null,'18 deg: between thresholds -> not published');assert.equal(holeShape([[0,0],[0,-250],[30,-400]],4).shape,'mostly_straight');
});
test('hazards: exclusive bunker association; ambiguous bunker omitted; side and green-side from geometry',()=>{
 const sq=(x,y,d=6)=>[[x-d,y-d],[x+d,y-d],[x+d,y+d],[x-d,y+d],[x-d,y-d]];
 const holes=[{hole:1,route:[[0,0],[0,-400]]},{hole:2,route:[[100,0],[100,-400]]}];
 const feats={bunker:[sq(25,-200),sq(50,-200),sq(-20,-395)],water:[sq(-30,-100,10)],green:[sq(0,-400,12)]};
 const G=associateGreens(holes,feats.green),H=hazardsFor(holes,feats,G);
 assert.equal(H.get(1).fairway_bunkers.right,1);assert.equal(H.get(2).fairway_bunkers.left,0,'midway bunker (50 m from both) omitted');assert.equal(H.get(1).greenside_bunkers,1);
 assert.deepEqual(H.get(1).water,['left']);assert.deepEqual(H.get(2).water,[]);
 assert.equal(targetFor(holes[0],G).type,'mapped_green_centre');assert.equal(targetFor(holes[1],G).type,'route_end');
});
test('wind components: signs follow the observed bearing',()=>{
 assert.deepEqual(windComponents(0,180,10),{along:10,cross:0},'wind from the south on a north hole = tailwind');
 assert.equal(windComponents(0,0,10).along,-10,'from the north = headwind');
 assert.equal(windComponents(0,270,10).cross,10,'from the west on a north hole = left to right');assert.equal(windComponents(0,90,10).cross,-10);
 assert.equal(windComponents(null,90,10),null);
 const M={course:{name:'X'},geometry_status:'VERIFIED ROUTING',setup:{year:2026},holes:[{hole:1,geometry_status:'verified',bearing_deg:0,setup:{par:4,yards:400}}]};
 const p=holePanel(M,1,{wind:{from_deg:135,dir:'SE',mph:12}});assert.match(p,/QUARTERING TAILWIND/);assert.match(p,/8 mph tailwind component · 8 mph right → left component/);assert.doesNotMatch(p,/help|hurt|club|plays/i);
});
test('pulse -> hole: only proven hole events carry a hole link, and it is the proven hole',()=>{
 const holes=new Map(LIVE.live.hole_scores.map(h=>[h.slug||h.name,h.holes]));const ev=pulseEvents(LIVE.movement.points,{holes,round:LIVE.live.event.round,limit:500});
 const withHole=ev.filter(x=>Number.isInteger(x.hole));assert.ok(withHole.length>0);assert.ok(withHole.every(x=>x.type==='hole'&&new RegExp(`ON ${x.hole}`).test(x.text)));
 assert.ok(ev.filter(x=>x.type!=='hole').every(x=>x.hole===undefined));
 const html=pulseList(ev);assert.equal((html.match(/data-pulse-hole=/g)||[]).length,withHole.length);
});
test('partial course: the withheld hole gets no geometry intelligence, markers or target',async()=>{
 const M=await api(A),h6=M.holes.find(x=>x.hole===6);assert.equal(h6.geometry_intelligence,null);assert.equal(h6.distance_reference,null);assert.equal(h6.hazards,null);
 assert.equal(courseMapSvg(M,{focus:6}).includes('cm-mk'),false);
});
test('API output: no shot, ball or player coordinates; OSM attribution preserved; methods published',async()=>{
 for(const s of [A,B]){const M=await api(s),j=JSON.stringify(M);assert.doesNotMatch(j,/"(ball|shot|player_position|pin|flag|landing)[a-z_]*"\s*:/i);assert.match(M.attribution.text,/OpenStreetMap contributors/);assert.ok(M.intelligence_methods.hazards&&M.intelligence_methods.scoring);
  assert.ok(j.length<70000,'payload budget');}
});
