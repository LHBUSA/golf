// Live scoring cast: parser total fix, fast-lane gating, and the scoring tape derived from REAL consecutive live
// snapshots (2026 Bank of Utah Championship R3, archived by the ingest on 2026-10-03, tests/fixtures/live-tape).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalizeCompetitor,refreshStatus,isHot,cardChanged,fastEligible,boardSig} from '../workers/golf-ingest/src/live.js';
import {deriveTape,appendTape,TAPE_MAX} from '../workers/shared/tape.js';
import {liveState,LIVE_FRESH_SECONDS} from '../workers/shared/live.js';
import {tapeView,tapeHead,tapeEmpty,golferTape,castShell,focusPanel} from '../src/lib/cast-v3.js';

const snap=i=>JSON.parse(fs.readFileSync(new URL(`./fixtures/live-tape/r3-${i}.json`,import.meta.url),'utf8'));
const S=[1,2,3,4].map(snap);
const diff=h=>h.strokes-h.par;

test('parser: an opened-but-not-started round (value 0, displayValue "-", no holes) never nulls the total',()=>{
 const st={period:3,thru:0,type:{name:'STATUS_SCHEDULED'},position:{id:'1',displayName:'1',isTie:false},teeTime:'2026-10-03T18:35Z',startHole:1};
 const ls={items:[{period:1,value:63,displayValue:'-8',linescores:Array.from({length:18},(_,i)=>({period:i+1,value:4,par:4}))},{period:2,value:62,displayValue:'-9',linescores:Array.from({length:18},(_,i)=>({period:i+1,value:4,par:4}))},{period:3,value:0,displayValue:'-',linescores:[]},{period:4}]};
 const p=normalizeCompetitor('11056',st,ls,{name:'Austin Smotherman'});
 assert.equal(p.total_to_par,-17);assert.equal(p.today_to_par,null);assert.equal(p.rounds.find(r=>r.round===3).strokes,null);
 // started: the partial round counts
 const st2={...st,thru:2,type:{name:'STATUS_IN_PROGRESS'}};const ls2=structuredClone(ls);ls2.items[2]={period:3,value:7,displayValue:'-1',linescores:[{period:1,value:3,par:4,scoreType:{name:'BIRDIE'}},{period:2,value:4,par:4}]};
 const q=normalizeCompetitor('11056',st2,ls2,{name:'Austin Smotherman'});assert.equal(q.total_to_par,-18);assert.equal(q.today_to_par,-1);assert.equal(q.holes.length,2);
});

test('tape: every hole event from real consecutive snapshots is provable from the posted cards',()=>{
 let total=0;
 for(let i=1;i<S.length;i++){
  const a=S[i-1],b=S[i],ev=deriveTape(a,b),A=new Map(a.players.map(p=>[p.espn_id,p])),B=new Map(b.players.map(p=>[p.espn_id,p]));
  const holes=ev.filter(x=>x.type==='hole');total+=holes.length;
  assert.ok(holes.length>0,'real R3 snapshots 10 minutes apart contain posted holes');
  for(const x of holes){
   const pb=b.players.find(p=>(p.slug||p.name)===x.keys[0]);assert.ok(pb,'golfer is in the newer snapshot');
   const pa=A.get(pb.espn_id);const h=(pb.holes||[]).find(y=>y.hole===x.hole);
   assert.ok(h,'hole posted in the newer card');assert.ok(!(pa.holes||[]).some(y=>y.hole===x.hole),'hole not in the older card');
   assert.equal(x.strokes,h.strokes);assert.equal(x.par,h.par);
   assert.equal(x.kind,diff(h)<=-2?'eagle':diff(h)===-1?'birdie':diff(h)===0?'par':diff(h)===1?'bogey':'double');
   assert.equal(x.t,b.fetched_at);assert.equal(x.prev_t,a.fetched_at);
  }
  // nothing invented: no shot-level vocabulary anywhere in the tape
  assert.doesNotMatch(JSON.stringify(ev),/\b(drive|approach|putt|fairway|bunker|green in|yards out|shot)\b/i);
  void B;
 }
 assert.ok(total>=40,`expected a real stream of hole results, got ${total}`);
});

test('tape: running totals only when they reconcile with both snapshots; leaders only from ESPN position 1',()=>{
 const ev=deriveTape(S[2],S[3]);
 for(const x of ev.filter(x=>x.type==='hole'&&x.to_par!==null)){const p=S[3].players.find(q=>(q.slug||q.name)===x.keys[0]);const last=ev.filter(y=>y.type==='hole'&&y.keys[0]===x.keys[0]).at(-1);if(last===x)assert.equal(x.to_par,p.total_to_par);}
 assert.equal(ev.filter(x=>x.type==='lead'||x.type==='lost_lead').length,0,'the observed leader did not change between these snapshots');
});

test('tape: round boundary, status changes, lead changes, dedupe and bound',()=>{
 const a=S[2],b=structuredClone(S[3]);
 assert.deepEqual(deriveTape(a,{...b,event_status:{...b.event_status,period:4}}),[],'no deltas across rounds');
 assert.deepEqual(deriveTape(null,b),[]);
 const c=structuredClone(b),wd=c.players.find(p=>p.status==='active'&&p.thru>0);wd.status='withdrawn';c.fetched_at='2026-10-03T17:53:44.000Z';
 assert.ok(deriveTape(b,c).some(x=>x.type==='status'&&x.rest==='WITHDRAWN'&&x.keys[0]===(wd.slug||wd.name)));
 const d=structuredClone(b),lead0=d.players.find(p=>p.position_num===1),other=d.players.find(p=>p.status==='active'&&p.position_num===3);
 lead0.position_num=2;lead0.position_display='2';other.position_num=1;other.position_display='1';other.total_to_par=(lead0.total_to_par??-17)-1;d.fetched_at='2026-10-03T17:53:44.000Z';
 const lev=deriveTape(b,d);assert.ok(lev.some(x=>x.type==='lead'&&x.keys[0]===(other.slug||other.name)&&/TAKES THE LEAD/.test(x.rest)));assert.ok(lev.some(x=>x.type==='lost_lead'&&x.keys[0]===(lead0.slug||lead0.name)));
 const ev=deriveTape(S[2],S[3]);let doc=appendTape(null,ev,{edition:'e',now:'n'});const n=doc.events.length;doc=appendTape(doc,ev,{edition:'e',now:'n'});assert.equal(doc.events.length,n,'re-appending the same observation adds nothing');
 const many=Array.from({length:TAPE_MAX+50},(_,i)=>({t:`t${i}`,type:'hole',keys:['k'],hole:i}));assert.equal(appendTape(null,many,{edition:'e',now:'n'}).events.length,TAPE_MAX);
});

test('fast lane: who is re-read, when a card is re-read, which events are eligible',()=>{
 const now=Date.parse('2026-10-03T18:00:00Z');
 assert.equal(isHot({status:'active',thru:7},now),true,'on course');
 assert.equal(isHot({status:'active',thru:0,tee_time:'2026-10-03T18:08Z'},now),true,'tees off within 10 minutes');
 assert.equal(isHot({status:'active',thru:0,tee_time:'2026-10-03T19:30Z',position_num:40},now),false,'tees off later, outside the top ten');
 assert.equal(isHot({status:'active',thru:18,position_num:4},now),true,'top ten: positions move as the field scores');
 assert.equal(isHot({status:'cut',thru:null},now),false);
 assert.equal(isHot({status:'active',thru:7,position_num:30,thru_changed_at:'2026-10-03T17:57:00Z'},now),false,'completed a hole 3 minutes ago: not re-read yet');
 assert.equal(isHot({status:'active',thru:7,position_num:30,thru_changed_at:'2026-10-03T17:54:00Z'},now),true,'5+ minutes since the last hole: re-read');
 assert.equal(isHot({status:'active',thru:7,position_num:3,thru_changed_at:'2026-10-03T17:59:00Z'},now),true,'top ten always re-read');
 const p={thru:5,current_round:3,status_name:'STATUS_IN_PROGRESS',holes:[{}]};
 assert.equal(cardChanged(p,{thru:5,period:3,type:{name:'STATUS_IN_PROGRESS'}}),false);assert.equal(cardChanged(p,{thru:6,period:3,type:{name:'STATUS_IN_PROGRESS'}}),true);
 const r=refreshStatus({...p,total_to_par:-9,holes:[{hole:1}],position_display:'T9',position_num:9},{thru:5,period:3,type:{name:'STATUS_IN_PROGRESS'},position:{id:'7',displayName:'T7',isTie:true}},{observed_at:'x'});
 assert.equal(r.position_display,'T7');assert.equal(r.total_to_par,-9,'card fields carried');assert.equal(r.observed_at,'x');
 const live={fetched_at:'2026-10-03T17:59:00Z',event_status:{name:'STATUS_IN_PROGRESS',state:'in',period:3},players:[]};
 assert.equal(fastEligible(live,now),true);
 assert.equal(fastEligible({...live,event_status:{...live.event_status,completed:true}},now),false,'completed: stopped');
 assert.equal(fastEligible({...live,event_status:{name:'STATUS_SUSPENDED',state:'in',period:3}},Date.parse('2026-10-03T18:05:00Z')),true,'suspended: every 5 minutes');
 assert.equal(fastEligible({...live,event_status:{name:'STATUS_SUSPENDED',state:'in',period:3}},Date.parse('2026-10-03T18:06:00Z')),false);
 const pre={...live,event_status:{name:'STATUS_SCHEDULED',state:'pre',period:4},players:[{rounds:[{round:4,tee_time:'2026-10-04T14:00Z'}]}]};
 assert.equal(fastEligible(pre,Date.parse('2026-10-04T13:50:00Z')),true,'within 15 minutes of first tee');
 assert.equal(fastEligible(pre,Date.parse('2026-10-04T12:00:00Z')),false,'pre-round stays slow');
 assert.notEqual(boardSig(S[2]),boardSig(S[3]));assert.equal(boardSig(S[3]),boardSig(structuredClone(S[3])));
});

test('live freshness: an in-progress round is LIVE only while observed within 5 minutes, then visibly stale',()=>{
 const s=t=>({fetched_at:new Date(Date.parse('2026-10-03T18:00:00Z')-t*1000).toISOString(),event_status:{name:'STATUS_IN_PROGRESS',state:'in',period:3},players:[{thru:4,rounds:[]}]});
 const now=Date.parse('2026-10-03T18:00:00Z');
 assert.equal(liveState(s(60),now).state,'live');assert.equal(liveState(s(60),now).label,'LIVE SCORING · ROUND 3');
 assert.equal(liveState(s(LIVE_FRESH_SECONDS+30),now).state,'stale');assert.equal(liveState(s(LIVE_FRESH_SECONDS+30),now).label,'SCORING UPDATE DELAYED');
});

test('PBEcast tape view: pars only for top ten / selected, truthful waiting + empty states, no shot claims',()=>{
 const tape={last_observation_at:'2026-10-03T17:52:44.357Z',events:deriveTape(S[2],S[3])};
 const ev={state:'live',round:3,fetched_at:tape.last_observation_at,leaderboard:S[3].players.map(p=>({slug:p.slug,name:p.name,status:p.status,position:p.position_display}))};
 const v=tapeView(tape,ev,{selected:null});
 const top=new Set(ev.leaderboard.filter(r=>parseInt(String(r.position).replace(/^T/,''),10)<=10).map(r=>r.slug||r.name));
 assert.ok(v.length>0);assert.ok(v.every(x=>!(x.kind==='par'&&!x.keys.some(k=>top.has(k)))),'field pars hidden');
 assert.ok(v.filter(x=>x.kind==='birdie').length>=5,'every observed birdie shows');
 const head=tapeHead(ev,tape,{now:Date.parse('2026-10-03T17:54:30Z'),newSinceMount:false});
 assert.match(head,/LIVE SCORING · HOLE-BY-HOLE/);assert.match(head,/Last scoring observation 2 min ago/);assert.match(head,/Waiting for the next posted hole result/);
 assert.doesNotMatch(tapeHead(ev,tape,{newSinceMount:true}),/Waiting/);
 assert.match(tapeEmpty({state:'live'}),/Waiting for the next posted hole result/);
 assert.match(tapeEmpty({state:'suspended'}),/suspended/);assert.match(tapeEmpty({state:'stale'}),/delayed/);
 assert.match(tapeHead({...ev,state:'suspended'},tape),/PLAY SUSPENDED/);assert.match(tapeHead({...ev,state:'stale'},tape),/SCORING UPDATE DELAYED/);
 const shell=castShell();assert.match(shell,/Live scoring/);assert.match(shell,/Shots are not tracked/);assert.doesNotMatch(shell,/shot[- ]by[- ]shot|ball position(?!s are not)/i);
 // golfer panel: latest + recent from the tape, tee time / start hole, explicit totals-only message
 const g=v.find(x=>x.type==='hole');const k=g.keys[0];const r=S[3].players.find(p=>(p.slug||p.name)===k);
 const row={slug:r.slug,name:r.name,status:'active',position:r.position_display,total_to_par:r.total_to_par,today_to_par:r.today_to_par,thru:r.thru,start_hole:r.start_hole,tee_time:r.tee_time};
 const html=focusPanel({round:3,holes_available:true},row,{holes:r.holes,events:golferTape(tape,k,3)});
 assert.match(html,/LATEST SCORING · OBSERVED/);assert.match(html,/START HOLE/);assert.match(html,/ROUND 3 SCORECARD/);
 assert.match(focusPanel({round:3,holes_available:false},{...row,thru:6},{holes:null}),/Hole-by-hole scores aren’t published for this tour; round totals are shown/);
});
