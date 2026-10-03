import test from 'node:test';import assert from 'node:assert/strict';
import {statusReport,reasonIn,restartIn} from '../src/lib/status-reason.js';
import {statusModule} from '../src/lib/live-ui.js';
import {autoIdentityOk,matchWithEvidence} from '../workers/shared/course-geo.js';
const row=(thru,status='active')=>({status,thru,position:'1',total_to_par:-5});
const ev=(o={})=>({state:'suspended',status_name:'STATUS_SUSPENDED',status_detail:'Round 2 - Suspended',round:2,fetched_at:'2026-10-03T11:24:00Z',status_since:'2026-10-03T01:40:00Z',leaderboard:[row(18),row(18),row(14),row(9),row(0),row(18,'cut')],...o});

test('suspended with no published reason: says so plainly, never invents one',()=>{
 const r=statusReport(ev());assert.equal(r.kind,'suspended');assert.equal(r.reason,null);assert.equal(r.restart,null);
 assert.match(r.sentence,/^Play is suspended\. 2 players have not finished round 2 and 1 has not started it\. No restart time has been published in the observed feed\. No official reason has been published in the observed feed yet\.$/);
 assert.deepEqual([r.affected.finished,r.affected.unfinished,r.affected.not_started],[2,2,1]);assert.match(r.affected.basis,/PBE-derived/);
 const html=statusModule(ev());assert.match(html,/Not published in the observed feed yet/);assert.match(html,/“Round 2 - Suspended”/);assert.match(html,/first observed/);
});
test('reason and restart only when the source text states them, quoted with the source',()=>{
 const r=statusReport(ev({status_detail:'Round 2 - Suspended due to darkness. Play will resume at 7:30 a.m.'}));
 assert.equal(r.reason.label,'darkness');assert.equal(r.reason.source,'PropSports event status');assert.match(r.restart.phrase,/^will resume at 7:30 a/);
 assert.match(r.sentence,/Play is suspended \(darkness, per PropSports event status\)/);assert.doesNotMatch(r.sentence,/No official reason/);
 assert.equal(reasonIn('Round 2 - Suspended'),null);assert.equal(restartIn('Round 2 - Suspended'),null);
 assert.equal(reasonIn('Play suspended: dangerous weather in the area').label,'dangerous weather');
});
test('a weather forecast is never turned into a reason; delays, postponements and round complete are distinct',()=>{
 assert.equal(statusReport(ev({weather_now:{short:'Thunderstorms'}})).reason,null);
 assert.equal(statusReport(ev({status_name:'STATUS_DELAYED',status_detail:'Round 3 - Delayed'})).kind,'delayed');
 assert.equal(statusReport(ev({status_name:'STATUS_POSTPONED',status_detail:'Postponed'})).kind,'postponed');
 const rc=statusReport(ev({state:'round_complete',status_name:'STATUS_PLAY_COMPLETE',status_detail:'Round 2 - Play Complete'}));assert.equal(rc.kind,'round_complete');assert.doesNotMatch(statusModule(ev({state:'round_complete',status_name:'STATUS_PLAY_COMPLETE'})),/Reason/);
 assert.equal(statusReport({...ev(),state:'live',status_name:'STATUS_IN_PROGRESS'}),null);assert.equal(statusModule({...ev(),state:'live',status_name:'STATUS_IN_PROGRESS'}),'');
});
// Automatic identity (name-located candidate): geometry must agree with the championship setup.
const sq=(x0,y0,d)=>[{lon:x0,lat:y0},{lon:x0+d,lat:y0},{lon:x0+d,lat:y0+d},{lon:x0,lat:y0+d},{lon:x0,lat:y0}];
const course=(id,name,x,y,d=0.03)=>({type:'way',id,tags:{leisure:'golf_course',name},geometry:sq(x,y,d)});
const hole=(id,ref,x,y,len=0.0033)=>({type:'way',id,tags:{golf:'hole',ref:String(ref),par:'4'},geometry:[{lon:x,lat:y},{lon:x,lat:y+len}]});
const H=(x,y,len)=>Array.from({length:18},(_,i)=>hole(1000+i,i+1,x+0.001*(i+1),y+0.002,len));
const setup=new Map(Array.from({length:18},(_,i)=>[i+1,{hole:i+1,par:4,yards:400}]));
const canon={slug:'k',name:'Kappa Golf Club',latitude:null,longitude:null};
const ev2={osm_course:'way/1',evidence_id:'auto-identity-v1',clears:['review_no_canonical_coords']};
test('auto identity: passes only with 15+ proven holes agreeing with setup lengths, a name match and no shared-name neighbour',()=>{
 const good=matchWithEvidence(canon,[course(1,'Kappa Golf Club',20,10),...H(20,10)],setup,ev2);assert.equal(autoIdentityOk(good,setup,canon.name).pass,true);
 const shortH=matchWithEvidence(canon,[course(1,'Kappa Golf Club',20,10),...H(20,10,0.0015)],setup,ev2);assert.equal(autoIdentityOk(shortH,setup,canon.name).pass,false,'lengths disagree with the setup');
 const noTable=matchWithEvidence(canon,[course(1,'Kappa Golf Club',20,10),...H(20,10)],new Map(),ev2);assert.equal(autoIdentityOk(noTable,new Map(),canon.name).pass,false,'no setup table -> manual review');
 const twin=matchWithEvidence(canon,[course(1,'Kappa Golf Club',20,10),course(2,'Kappa Golf Club North',20.05,10),...H(20,10)],setup,ev2);assert.equal(autoIdentityOk(twin,setup,canon.name).checks.shared_name>0||!autoIdentityOk(twin,setup,canon.name).pass,true);
 const other=matchWithEvidence(canon,[course(1,'Lambda Links',20,10),...H(20,10)],setup,ev2);assert.equal(autoIdentityOk(other,setup,canon.name).pass,false,'name must match');
});
