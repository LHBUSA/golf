import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {isCompleteCard,completeRows,runningToPar,toParText,scoreTier,roundTotal,createPlayer,railHtml,cardHtml,castReplayPanel,holeSvg,CADENCE_MS} from '../src/lib/cast-replay.js';
import {courseMapSvg} from '../src/lib/course-map.js';
// Real 2026 Bank of Utah Championship R1 card for Austin Smotherman (63, -8) and the real Black Desert OSM routing fixture.
const STROKES=[4,3,3,4,4,4,4,2,4,3,4,4,4,3,3,3,3,4],PARS=[4,4,3,4,4,4,5,3,5,4,4,4,4,4,3,4,3,5];
const card=STROKES.map((s,i)=>({hole:i+1,strokes:s,to_par:s-PARS[i]}));
const row={player:{slug:'austin-smotherman-q106782591',name:'Austin Smotherman'},rounds:[{round:1,strokes:63,to_par:-8}],holes:[{round:1,scores:card}]};
const holes=card.map((s,i)=>({...s,par:PARS[i],yards:null}));
const BD=JSON.parse(fs.readFileSync(new URL('./fixtures/course-map-black-desert.json',import.meta.url),'utf8'));
const M={...BD,course:{slug:'bd',name:'Black Desert'},bounds:BD.geometry.bounds,holes:BD.holes.map(h=>({...h,geometry_status:'verified',setup:{edition:'e',par:4,yards:500},scoring:null}))};
// Deterministic scheduler: run() fires the pending tick and returns the delay it was scheduled with.
const clock=()=>{let q=null;return {schedule:(f,ms)=>(q={f,ms},q),cancel:t=>{if(q===t)q=null;},run(){const t=q;q=null;if(!t)return null;t.f();return t.ms;},get pending(){return q;}};};

test('fixture is the real published card: 18 holes, 63 strokes, -8',()=>{
 assert.equal(STROKES.reduce((a,b)=>a+b,0),63);assert.equal(runningToPar(holes,17),-8);
});
test('complete scorecards only: partial, duplicate or null-stroke cards are dropped, never padded',()=>{
 assert.equal(isCompleteCard(card),true);
 assert.equal(isCompleteCard(card.slice(0,17)),false,'17 holes');
 assert.equal(isCompleteCard([...card.slice(0,17),{...card[0]}]),false,'duplicate hole 1, missing 18');
 assert.equal(isCompleteCard(card.map((h,i)=>i===9?{...h,strokes:null}:h)),false,'null strokes');
 const rows=completeRows([row,{player:{name:'WD'},holes:[{round:1,scores:card.slice(0,9)}]},{player:{name:'Mixed'},holes:[{round:1,scores:card.slice(0,12)},{round:2,scores:[...card].reverse()}]}]);
 assert.deepEqual(rows.map(r=>r.player.name),['Austin Smotherman','Mixed']);
 assert.deepEqual(rows[1].holes.map(h=>h.round),[2],'partial round dropped, complete round kept');
 assert.deepEqual(rows[1].holes[0].scores.map(s=>s.hole),Array.from({length:18},(_,i)=>i+1),'sorted 1-18');
 for(const r of rows)for(const h of r.holes)assert.equal(h.scores.length,18);
});
test('rail renders the 18 real hole values with OUT/IN subtotals and the published round total',()=>{
 const html=railHtml(holes,17,{total:roundTotal(row,1,holes),round:1});
 const vals=[...html.matchAll(/<span class="rc-sc" aria-hidden="true">(\d+)<\/span>/g)].map(m=>Number(m[1]));
 assert.deepEqual(vals,STROKES);
 assert.equal((html.match(/data-rc-hole=/g)||[]).length,18);
 assert.match(html,/<b>32<\/b><small>−4<\/small>/);assert.match(html,/<b>31<\/b><small>−4<\/small>/);
 assert.match(html,/ROUND 1<\/small><b>63<\/b><span>−8<\/span>/);
 assert.match(html,/aria-label="Hole 18, par 5: 4 strokes, Birdie"/);
});
test('current hole button state: exactly one is-on + aria-current, on the selected hole',()=>{
 for(const i of [0,8,17]){const html=railHtml(holes,i);
  assert.equal((html.match(/aria-current="step"/g)||[]).length,1);assert.equal((html.match(/is-on/g)||[]).length,1);
  assert.match(html,new RegExp(`is-on" data-rc-hole="${i}" aria-current="step"`));}
});
test('score tiers carry shape classes (not colour alone)',()=>{
 assert.deepEqual([-3,-2,-1,0,1,2,4].map(scoreTier),['eagle','eagle','birdie','par','bogey','double','double']);
 assert.match(railHtml(holes,0),/rc-h rc-s-birdie/);
});
test('cumulative to-par: per-hole running total and display',()=>{
 assert.deepEqual(holes.map((_,i)=>runningToPar(holes,i)),[0,-1,-1,-1,-1,-1,-2,-3,-4,-5,-5,-5,-5,-6,-6,-7,-7,-8]);
 assert.deepEqual([0,3,-8,null].map(toParText),['E','+3','−8','—']);
 const c=cardHtml(holes,17,{field:{scoring_average:4.51,difficulty_rank:16,difficulty_of:18}});
 assert.match(c,/<p class="rc-no">18<\/p>/);assert.match(c,/PAR 5/);assert.match(c,/<span>Birdie<\/span>/);assert.match(c,/class="rc-run">−8</);assert.match(c,/<dt>Thru<\/dt><dd>18</);
 assert.match(c,/4\.51<small>16th hardest of 18/);
 assert.doesNotMatch(c,/club|strokes gained|lie|shot distance/i,'no invented shot detail');
});
test('round total: published value only when it agrees with the 18 observed holes',()=>{
 assert.deepEqual(roundTotal(row,1,holes),{strokes:63,to_par:-8});
 assert.equal(roundTotal({...row,rounds:[{round:1,strokes:64,to_par:-7}]},1,holes),null,'conflicting total suppressed');
 assert.equal(roundTotal({...row,rounds:[]},1,holes),null,'no published total -> none shown');
});
test('verified routing never creates a ball path; OSM attribution stays in the replay',()=>{
 const svg=courseMapSvg(M,{focus:18,ar:1.6,px:900});
 assert.match(svg,/cm-route is-focus" data-hole="18"/);
 assert.doesNotMatch(svg,/data-ball|data-trail|rc-ball|rc-trail|golfer|shot/i);
 const panel=castReplayPanel([row],{edition:'e',course:'bd',courseName:'Black Desert Resort Golf Course'});
 assert.match(panel,/data-rc-attr[^>]*>© <a href="https:\/\/www\.openstreetmap\.org\/copyright"[^>]*>OpenStreetMap contributors<\/a> · ODbL/);
 assert.match(panel,/<a href="\/course\/bd">Black Desert Resort Golf Course<\/a>/);
 assert.match(panel,/data-rc-real hidden>Verified course routing/);
});
test('reconstructed visualization stays explicitly labelled',()=>{
 const panel=castReplayPanel([row],{edition:'e'});
 assert.match(panel,/data-rc-recon>Reconstructed visualization</);assert.match(panel,/Observed scorecard/);
 assert.match(panel,/generic reconstruction from par and yardage, not shot tracking/);
 assert.match(holeSvg({hole:5,par:3,yards:205,strokes:3}),/Reconstructed visualization; shot locations are not tracked/);
});
test('playback advances one hole per beat at a fixed cadence (not stroke-timed)',()=>{
 assert.ok(CADENCE_MS>=1200&&CADENCE_MS<=1800);
 const c=clock(),shown=[];const p=createPlayer({onShow:i=>shown.push(i),schedule:c.schedule,cancel:c.cancel});
 p.load(18);assert.deepEqual(shown,[0]);
 p.play();assert.equal(p.state.playing,true);
 const delays=[];for(let k=0;k<5;k++)delays.push(c.run());
 assert.deepEqual(shown,[0,1,2,3,4,5]);assert.deepEqual(delays,Array(5).fill(CADENCE_MS),'same beat whatever the strokes');
 p.setSpeed(2);assert.equal(c.run(),CADENCE_MS/2);assert.equal(p.state.idx,6);
});
test('pause stops playback; play at the last hole restarts from hole 1; playback stops at 18',()=>{
 const c=clock();const p=createPlayer({schedule:c.schedule,cancel:c.cancel});p.load(18);
 p.play();c.run();c.run();p.pause();assert.equal(p.state.idx,2);assert.equal(p.state.playing,false);assert.equal(c.pending,null,'no tick left scheduled');
 p.go(16);p.play();c.run();assert.equal(p.state.idx,17);assert.equal(p.state.playing,false,'stops on 18');assert.equal(c.pending,null);
 p.play();assert.equal(p.state.idx,0,'replay restarts at hole 1');assert.equal(p.state.playing,true);
});
test('previous/next respect the 1 and 18 boundaries and pause playback',()=>{
 const c=clock();const p=createPlayer({schedule:c.schedule,cancel:c.cancel});p.load(18);
 p.prev();assert.equal(p.state.idx,0);
 p.play();p.next();assert.equal(p.state.playing,false);assert.equal(p.state.idx,1);
 p.go(17);p.next();assert.equal(p.state.idx,17);p.prev();assert.equal(p.state.idx,16);
 p.go(99);assert.equal(p.state.idx,17);p.go(-4);assert.equal(p.state.idx,0);
});
test('loading another player or round resets to hole 1 and stops playback',()=>{
 const c=clock(),shown=[];const p=createPlayer({onShow:(i,o)=>shown.push([i,o.animate]),schedule:c.schedule,cancel:c.cancel});p.load(18);
 p.play();c.run();c.run();p.load(18);
 assert.deepEqual(p.state,{idx:0,playing:false,speed:1,count:18});assert.equal(c.pending,null);assert.deepEqual(shown.at(-1),[0,false]);
});
test('state callback exposes pressed/position for the transport',()=>{
 const c=clock(),st=[];const p=createPlayer({onState:s=>st.push(s),schedule:c.schedule,cancel:c.cancel});p.load(18);p.play();p.pause();
 assert.deepEqual(st.map(s=>s.playing),[false,true,false]);
});
