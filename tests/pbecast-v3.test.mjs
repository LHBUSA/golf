import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {runFacts,pulseEvents,boardMoves,fieldSnapshot,timelineSeries,timelineSvg,timelineLayout,timelineTable,monotonePath,focusPanel,holeDiff,resultKind,courseOffset,courseClock,castShell,towerRows,weatherTile} from '../src/lib/cast-v3.js';
// Real observed fixture: 2026 Bank of Utah Championship round 2 (ESPN snapshots via golf-api /live and /movement).
const F=JSON.parse(fs.readFileSync(new URL('./fixtures/pbecast-v3-bank-of-utah-r2.json',import.meta.url),'utf8'));
const EV=F.live.event,PTS=F.movement.points,HOLES=new Map(F.live.hole_scores.map(h=>[h.slug||h.name,h.holes]));
const SMO='austin-smotherman-q106782591';
const H=(hole,par,strokes)=>({hole,par,strokes});
const P=(t,round,top)=>({t,round,top});
const X=(slug,pos,to_par,thru,tied=false)=>({slug,name:'First '+slug.toUpperCase(),pos,tied,to_par,thru});

test('run facts are counted from posted holes only',()=>{
 assert.deepEqual(runFacts([H(1,4,4),H(2,4,3),H(3,4,3),H(4,4,3),H(5,5,4)]),['Four straight birdies']);
 assert.deepEqual(runFacts([H(1,4,3),H(2,4,4),H(3,4,3),H(4,5,3),H(5,4,4)]),['Three birdies or better in the last five holes']);
 assert.deepEqual(runFacts([H(1,4,5),H(2,4,5),H(3,4,4),H(4,4,4),H(5,4,4)]),['Two holes over par in the last five']);
 assert.deepEqual(runFacts([H(1,4,4)]),[]);assert.deepEqual(runFacts([H(1,4,null),H(2,4,null)]),[]);
 assert.deepEqual(runFacts(HOLES.get(SMO)),['Three straight birdies','Four birdies in the last five holes']);
});
test('pulse: hole results only when the posted holes add up to the observed change',()=>{
 const holes=new Map([['a',[H(1,4,4),H(2,4,3),H(3,4,5)]]]);
 const pts=[P('2026-10-02T15:00:00Z',2,[X('a',3,-5,1)]),P('2026-10-02T15:10:00Z',2,[X('a',2,-6,2)])];
 const ev=pulseEvents(pts,{holes,round:2});assert.ok(ev.some(x=>x.type==='hole'&&/BIRDIE ON 2/.test(x.text)));
 // Same observation, but the posted hole disagrees with the board: no hole is named, only the observed move.
 const bad=new Map([['a',[H(1,4,4),H(2,4,4)]]]);const ev2=pulseEvents(pts,{holes:bad,round:2});
 assert.ok(!ev2.some(x=>x.type==='hole'));assert.ok(ev2.some(x=>x.type==='score'&&/MOVES TO −6 · THRU 2/.test(x.text)));
 // Holes from another round never prove anything.
 assert.ok(!pulseEvents(pts,{holes,round:3}).some(x=>x.type==='hole'));
 // One observation: nothing to compare.
 assert.deepEqual(pulseEvents(pts.slice(0,1),{holes,round:2}),[]);
});
test('pulse: lead changes, ties, top-5 entries and finishes; nothing across a round boundary',()=>{
 const a=P('2026-10-02T15:00:00Z',2,[X('a',1,-10,16),X('b',2,-9,17),X('c',6,-7,10)]);
 const b=P('2026-10-02T15:10:00Z',2,[X('a',1,-10,17,true),X('b',1,-10,18,true),X('c',4,-8,11)]);
 const c=P('2026-10-02T15:20:00Z',2,[X('b',1,-11,18),X('a',2,-10,18),X('c',4,-8,12)]);
 const ev=pulseEvents([a,b,c],{round:2});const t=ev.map(x=>x.text);
 assert.ok(t.some(x=>/^TIE FOR LEAD · −10/.test(x)));assert.ok(t.includes('B → SOLO LEAD · −11'));
 assert.ok(t.some(x=>/^C INTO 4 · TOP 5/.test(x)));assert.ok(t.some(x=>/^B FINISHES ROUND 2/.test(x)));assert.ok(t.some(x=>/^A FINISHES ROUND 2/.test(x)));
 assert.equal(ev[0].t,c.t,'newest first');
 const r3=P('2026-10-03T14:00:00Z',3,[X('a',1,-12,2),X('b',2,-11,1)]);
 assert.deepEqual(pulseEvents([c,r3],{round:3}),[]);
});
test('pulse on the real round: every named hole result is proven by posted holes',()=>{
 const ev=pulseEvents(PTS,{holes:HOLES,round:EV.round,focus:new Set([SMO]),limit:500});assert.ok(ev.length>10);
 const byT=new Map(PTS.map((p,i)=>[p.t,i]));
 for(const x of ev.filter(x=>x.type==='hole')){const i=byT.get(x.t),a=PTS[i-1].top.find(y=>(y.slug||y.name)===x.keys[0]),b=PTS[i].top.find(y=>(y.slug||y.name)===x.keys[0]);
  const seg=HOLES.get(x.keys[0]).slice(a.thru,b.thru);assert.equal(seg.reduce((s,h)=>s+holeDiff(h),0),b.to_par-a.to_par,x.text);}
 const t=ev.map(x=>x.text);assert.ok(t.includes('SMOTHERMAN → SOLO LEAD · −17'));assert.ok(t.includes('SMOTHERMAN BIRDIE ON 18 · −17'));
 assert.ok(!t.some(x=>/carry|club|fairway|green|putt|drive|proximity/i.test(x)));
});
test('tower movement only where the latest observation still matches the board',()=>{
 const pts=[P('t1',2,[X('a',2,-5,9),X('b',1,-6,9)]),P('t2',2,[X('a',1,-7,10),X('b',2,-6,10)])];
 const rows=[{slug:'a',position:'1'},{slug:'b',position:'3'}];const m=boardMoves(pts,rows);
 assert.equal(m.get('a'),1);assert.equal(m.has('b'),false);assert.equal(boardMoves(pts.slice(1),rows).size,0);
 const html=towerRows({leaderboard:[{slug:'a',name:'A',position:'1',status:'active',total_to_par:-7,today_to_par:-3,thru:10}]},{selected:'a',moves:m});
 assert.match(html,/▲1/);assert.match(html,/aria-pressed="true"/);assert.match(html,/up 1 since previous observation/);
});
test('field snapshot: within-N counts, finished/on course, lowest observed round, biggest mover',()=>{
 const f=fieldSnapshot(EV,PTS);assert.equal(f.lead,-17);assert.equal(f.leaders.length,1);
 const act=EV.leaderboard.filter(r=>r.status==='active');assert.equal(f.finished+f.on_course+f.not_started,act.length);
 assert.equal(f.within3,act.filter(r=>r.total_to_par>-17&&r.total_to_par<=-14).length);assert.equal(f.low,62);assert.ok(f.mover.gain>0);
});
test('timeline: responsive, labels inside the gutter, no white plot box, observed markers only',()=>{
 const m=timelineSeries(PTS,{filter:'top10',selected:SMO});assert.ok(m.series.length>=10);
 for(const width of [300,358,520,700,900,1200]){const svg=timelineSvg(m,{width,height:240,selected:SMO});
  assert.match(svg,new RegExp(`viewBox="0 0 ${width} 240"`));assert.doesNotMatch(svg,/fill="#fff|fill="white|<rect(?![^>]*rx="3")/);
  const g=timelineLayout(m,{width,height:240});
  for(const [,x,txt] of svg.matchAll(/<g class="tl-lab[^"]*">.*?<text x="([\d.]+)"[^>]*>([^<]*)<\/text>/g)){assert.ok(Number(x)+txt.length*6.4<=width+1,`${width}: ${txt} overflows`);}
  for(const [,y] of svg.matchAll(/<g class="tl-lab[^"]*"><line[^>]*y2="([\d.-]+)"/g)){assert.ok(Number(y)>=g.T-1&&Number(y)<=240-g.B+1);}
 }
 // Only selected/leader/mover series get direct labels; everyone else is muted and in the legend.
 const svg=timelineSvg(m,{width:900,height:260,selected:SMO});const labels=(svg.match(/class="tl-lab /g)||[]).length;assert.ok(labels>=1&&labels<=4,String(labels));
 // Dots = observations, never interpolated points.
 const obs=m.series.reduce((n,s)=>n+s.obs.filter(Boolean).length,0);
 assert.equal((svg.match(/class="tl-pt"/g)||[]).length,obs);
 assert.equal(timelineSeries(PTS.slice(0,1)),null);
 assert.deepEqual(timelineSeries(PTS,{filter:'selected',selected:SMO}).series.map(s=>s.key),[SMO]);
 assert.match(timelineTable(m),/<table/);
 const tip=timelineSvg(m,{width:360,height:220,selected:SMO,cursor:PTS.length-1});const tx=Number(tip.match(/tl-tip" transform="translate\(([\d.-]+)/)[1]);assert.ok(tx>=0&&tx+170<=360);
});
test('monotone curve passes through every observation and never overshoots',()=>{
 const pts=[[0,10],[10,10],[20,50],[30,40]],d=monotonePath(pts);for(const [x,y] of pts)assert.ok(d.includes(`${x.toFixed(1)},${y.toFixed(1)}`));
 const nums=[...d.matchAll(/,(-?[\d.]+)/g)].map(m=>Number(m[1]));assert.ok(Math.min(...nums)>=10&&Math.max(...nums)<=50);
});
test('focus panel: observed scorecard, labelled derivations, reconstruction disclaimer, no fabricated shot fields',()=>{
 const r=EV.leaderboard.find(x=>x.slug===SMO);
 const html=focusPanel(EV,r,{holes:HOLES.get(SMO),layout:F.live.course_holes,selHole:18});
 assert.match(html,/P1/);assert.match(html,/−17/);assert.match(html,/Finished round 2/);assert.match(html,/Birdie on 18/);
 assert.match(html,/PBE-DERIVED/);assert.match(html,/RECONSTRUCTED/);assert.match(html,/not shot tracking/);
 assert.equal((html.match(/data-cv3-hole=/g)||[]).length,HOLES.get(SMO).length);
 assert.doesNotMatch(html,/ShotLink|carry|club|lie\b|proximity|strokes gained/i);
 const lpga=focusPanel({...EV,holes_available:false},r,{holes:null,layout:null});assert.match(lpga,/round totals, not hole-by-hole/);assert.doesNotMatch(lpga,/data-cv3-hole/);
 assert.equal(resultKind(holeDiff(H(1,5,3))),'eagle');assert.equal(resultKind(holeDiff(H(1,4,7))),'double');
});
test('weather: town-level estimate never called course weather; course clock from the forecast offset',()=>{
 const w=weatherTile(F.live.weather_now);assert.match(w,/Town-level estimate/);assert.doesNotMatch(w,/course weather/i);assert.equal(weatherTile(null),'');
 assert.equal(courseOffset({t:'2026-10-02T14:00:00-06:00'}),-360);assert.equal(courseOffset({}),null);
 assert.equal(courseClock(-360,Date.parse('2026-10-02T20:32:00Z')),'2:32 PM');
});
test('shell: every region labelled, no inline styles (CSP style-src self)',()=>{const s=castShell();assert.doesNotMatch(s,/ style=/);for(const k of ['data-cv3-tower','data-cv3-focus','data-cv3-pulse','data-cv3-plot','data-cv3-field'])assert.ok(s.includes(k));});
