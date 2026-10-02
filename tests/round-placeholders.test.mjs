import test from 'node:test';import assert from 'node:assert/strict';
import {pbecast} from '../src/lib/pages.js';
// Round-by-round grid: unplayed rounds are muted em dashes with a reason; null never renders as 0 or E.
const P=(n)=>({slug:'p'+n,name:'Player '+n});
const row=(n,rounds,o={})=>({player:P(n),position:n,status:'active',rounds:rounds.map((s,i)=>({round:i+1,strokes:s,to_par:s==null?null:s-72})),strokes:null,to_par:null,...o});
const ed=(rows,status='in_progress')=>({slug:'x-2026',name:'2026 X',status,coverage:'full_field',starts_on:'2026-10-01',ends_on:'2026-10-04',leaderboard:rows,results_source:{rounds_played:4},timeline:[]});
const ix={current:[],editions:[]};
const cells=html=>html.slice(html.indexOf('<table class="board"'),html.indexOf('</table>'));
for(const [label,rows,future] of [
 ['round 1 live',[row(1,[]),row(2,[])],[1,2,3,4]],
 ['round 2 live',[row(1,[66]),row(2,[68])],[2,3,4]],
 ['after the cut',[row(1,[66,65]),row(2,[74,75],{status:'cut'})],[3,4]],
 ['round 3',[row(1,[66,65,70]),row(2,[74,75],{status:'cut'})],[4]],
])test(`round grid: ${label}`,()=>{const t=cells(pbecast(ix,ed(rows)));
 for(const r of [1,2,3,4])assert.equal(t.includes(`Round ${r} (not yet played)`),future.includes(r),`R${r} future=${future.includes(r)}`);
 assert.doesNotMatch(t,/<td class="num[^"]*"><\/td>/,'no blank cells');assert.doesNotMatch(t,/<td class="num[^"]*">(0|E)<\/td>/,'null never 0/E');
 if(label==='round 3')assert.match(t,/Missed the cut, no round 3/);
 assert.match(t,/Total not final/);});
test('round grid: final shows real totals and to-par, no placeholders',()=>{const rows=[row(1,[66,65,70,69],{status:'finished',strokes:270,to_par:-18})];const t=cells(pbecast(ix,ed(rows,'completed')));
 assert.doesNotMatch(t,/not yet played|not final/);assert.match(t,/>270</);assert.match(t,/−18/);});
test('consumer copy: no implementation phrasing on PBEcast',()=>{const h=pbecast(ix,ed([row(1,[66])]));assert.doesNotMatch(h,/need a full-field|validated hole-by-hole|feed posts/);assert.match(h,/Round-by-round analysis becomes available when complete field data is available/);});
