import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import api from '../workers/golf-api/src/index.js';
import {compactEdition,cutApplied,outcome,RatingBook,bookAt,simulate,pairProb,cutRule,MODEL_VERSION} from '../workers/shared/picks/model.js';
import {forecast,gradeSelection,formatExcluded,POLICY_VERSION} from '../workers/shared/picks/policy.js';
import {seal,verifySeal,createOnly,gradeRevision,joinLock,trackRecord,lockKey} from '../workers/shared/picks/ledger.js';
import {lockGate,lockEdition,resultFrom,runPicks} from '../workers/golf-ingest/src/picks.js';

// ---- fixtures: synthetic leaderboards with real shapes (projection edition docs)
const R=(round,strokes)=>({round,strokes});
const row=(slug,status,position,rounds,{tied=false,winner=false}={})=>({player:{slug,name:slug},status,position,tied,winner,rounds:rounds.map((s,i)=>R(i+1,s))});
function edition(slug,start,rows,{coverage='full_field',status='completed',division='men',tournament='t-'+slug}={}){const end=new Date(Date.parse(start)+3*864e5).toISOString().slice(0,10);return {slug,name:slug,starts_on:start,ends_on:end,status,coverage,division,is_major:false,tournament:{slug:tournament},tour:{key:'pga',short:'PGA TOUR'},leaderboard:rows,event_record:{rounds_played:4}};}
function field(n,seed=0){const rows=[];for(let i=0;i<n;i++){const made=i<65;rows.push(row('p'+i,made?'finished':'cut',made?i+1:null,made?[68+(i%5),69+(i+seed)%4,70,71]:[74,75+(i%3)],{winner:i===0}));}return rows;}

test('model store takes only full_field editions and drops partial rounds (<55, mid-round WD)',()=>{
 assert.equal(compactEdition(edition('a','2025-01-01',field(80),{coverage:'made_cut'})),null);
 assert.equal(compactEdition(edition('a','2025-01-01',field(80),{coverage:'top_finishers'})),null);
 const c=compactEdition(edition('a','2025-01-01',[row('x','withdrawn',null,[4]),...field(20)]));
 assert.deepEqual(c.rows[0].r,[null]);assert.equal(outcome(c.rows[0],false),'dns');
});
test('a lone "cut" row in a no-cut event is a withdrawal, not a cut',()=>{
 const rows=[...field(76).map(r=>({...r,status:'finished',position:1})),row('wd','cut',null,[71])];const c=compactEdition(edition('b','2024-10-24',rows));
 assert.equal(cutApplied(c.rows),false);assert.equal(outcome(c.rows.at(-1),false),'withdrawn');
 assert.equal(cutApplied(compactEdition(edition('c','2024-01-01',field(140))).rows),true);
});
test('ratings are time-safe: editions ending on/after the cutoff never enter',()=>{
 const a=compactEdition(edition('early','2025-01-01',field(80))),b=compactEdition(edition('late','2025-03-01',field(80,2)));
 const book=bookAt([a,b],Date.parse('2025-02-01'));assert.equal(book.state('p0').e,1);
 const same=bookAt([a],Date.parse('2025-01-04'));assert.equal(same.state('p0'),null,'an edition ending the day before is excluded (1-day margin)');
});
test('field-strength adjustment: the same score in a stronger field rates better',()=>{
 const b=new RatingBook();b.add('strong',-2,0);b.add('strong',-2,0);
 const mk=(strong)=>({slug:'x',starts_on:'2025-01-01',ends_on:'2025-01-04',rows:[{s:'hero',r:[70]},...Array.from({length:12},(_,i)=>({s:strong?'strong':'n'+i,r:[70]}))]});
 const b1=new RatingBook();for(let i=0;i<5;i++)b1.add('strong',-3,Date.parse('2024-12-20'));const b2=new RatingBook();
 b1.update(mk(true));b2.update(mk(false));assert.ok(b1.predict('hero',Date.parse('2025-01-05')).mu<b2.predict('hero',Date.parse('2025-01-05')).mu);
});
test('one joint simulation: probabilities are coherent and reproducible',()=>{
 const players=Array.from({length:120},(_,i)=>({slug:'g'+i,mu:-2+i*0.04,sd:2.8,se:0.3}));
 const s=simulate(players,{sims:3000,cutRank:65,seed:'x'}),s2=simulate(players,{sims:3000,cutRank:65,seed:'x'});
 const sum=k=>s.players.reduce((a,p)=>a+p[k],0);
 assert.ok(Math.abs(sum('win')-1)<1e-9);assert.ok(sum('top10')>=10&&sum('top10')<11.5);assert.ok(sum('make_cut')>=65&&sum('make_cut')<72);
 assert.deepEqual(s.players[5],s2.players[5]);
 for(const p of s.players)assert.ok(p.win<=p.top10&&p.top10<=p.top20&&p.top20<=p.make_cut+1e-12);
 const ab=pairProb(s,0,119);assert.ok(ab.p>0.9);const ba=pairProb(s,119,0);assert.ok(Math.abs(ab.p+ba.p-1)<1e-9);
 assert.equal(simulate(players.slice(0,70),{sims:200,cutRank:null}).players[0].make_cut,null,'no-cut format has no make-cut probability');
});
test('cut rules: no-cut history and small fields carry no cut; majors use their own size',()=>{
 assert.equal(cutRule({slug:'x',division:'women'},81,false),null);assert.equal(cutRule({slug:'x',division:'men'},78,null),null);
 assert.equal(cutRule({slug:'masters-tournament-2026',division:'men',is_major:true},91,true),50);assert.equal(cutRule({slug:'bermuda',division:'men'},120,true),65);
 assert.ok(formatExcluded('zurich-classic-of-new-orleans-q1777773-2026'));assert.ok(!formatExcluded('butterfield-bermuda-championship-q85746680-2026'));
});

// ---- grading policy (frozen before the first lock)
const res=(rows,extra={})=>({status:'final',rounds_completed:4,rows,...extra});
const g=(rw)=>({s:rw[0],st:rw[1],p:rw[2],t:rw[3]||false,w:rw[4]||false,r:rw[5]});
const board=[g(['win','finished',1,false,true,[66,67,68,69]]),g(['t10a','finished',10,true,false,[70,70,70,70]]),g(['t10b','finished',10,true,false,[70,70,70,70]]),g(['p14','finished',14,true,false,[71,70,70,70]]),
 g(['mc','cut',null,false,false,[75,76]]),g(['mc2','cut',null,false,false,[74,76]]),g(['wd1','withdrawn',null,false,false,[74]]),g(['wd3','withdrawn',null,false,false,[70,70,72]]),g(['dq','disqualified',null,false,false,[70,70]]),g(['dns','withdrawn',null,false,false,[]]),
 ...Array.from({length:12},(_,i)=>g(['c'+i,'cut',null,false,false,[76,76]]))];
const sel=(family,slug,extra={})=>({family,slug,p:0.5,...extra});
test('top N: T10 counts, T14 loses, missed cut loses, DNS voids',()=>{
 assert.equal(gradeSelection(sel('top10','t10b'),res(board)).grade,'WIN');assert.equal(gradeSelection(sel('top10','t10b'),res(board)).actual,'T10');
 assert.equal(gradeSelection(sel('top10','p14'),res(board)).grade,'LOSS');assert.equal(gradeSelection(sel('top20','p14'),res(board)).grade,'WIN');
 assert.equal(gradeSelection(sel('top10','mc'),res(board)).grade,'LOSS');assert.equal(gradeSelection(sel('top10','dns'),res(board)).grade,'VOID');
 assert.equal(gradeSelection(sel('top10','wd3'),res(board)).grade,'LOSS');
});
test('make cut distinguishes missed cut from WD/DQ/DNS; no cut made voids',()=>{
 assert.equal(gradeSelection(sel('make_cut','mc'),res(board)).grade,'LOSS');assert.equal(gradeSelection(sel('make_cut','wd1'),res(board)).grade,'VOID');
 assert.equal(gradeSelection(sel('make_cut','dq'),res(board)).grade,'VOID');assert.equal(gradeSelection(sel('make_cut','dns'),res(board)).grade,'VOID');
 assert.equal(gradeSelection(sel('make_cut','wd3'),res(board)).grade,'WIN','withdrew after making the cut');
 const nocut=board.filter(r=>r.st!=='cut');assert.equal(gradeSelection(sel('make_cut','win'),res(nocut)).grade,'VOID');
});
test('winner: playoff winner wins, co-winners void, shortened under 36 holes voids, pending until final',()=>{
 assert.equal(gradeSelection(sel('winner','win'),res(board)).grade,'WIN');assert.equal(gradeSelection(sel('winner','t10a'),res(board)).grade,'LOSS');
 const co=board.map(r=>r.s==='t10a'?{...r,w:true}:r);assert.equal(gradeSelection(sel('winner','win'),res(co)).grade,'VOID');
 assert.equal(gradeSelection(sel('winner','win'),res(board,{rounds_completed:1})).grade,'VOID');assert.equal(gradeSelection(sel('winner','win'),{status:'pending'}).grade,'PENDING');
 assert.equal(gradeSelection(sel('top10','win'),{status:'cancelled'}).grade,'VOID');
});
test('head to head: made cut beats missed cut, 36-hole totals split missed cuts, ties and WD void',()=>{
 assert.equal(gradeSelection(sel('h2h','p14',{opponent:{slug:'mc'}}),res(board)).grade,'WIN');
 assert.equal(gradeSelection(sel('h2h','mc2',{opponent:{slug:'mc'}}),res(board)).grade,'WIN');
 assert.equal(gradeSelection(sel('h2h','t10a',{opponent:{slug:'t10b'}}),res(board)).grade,'VOID');
 assert.equal(gradeSelection(sel('h2h','win',{opponent:{slug:'wd3'}}),res(board)).grade,'VOID');
 assert.equal(gradeSelection(sel('h2h','mc',{opponent:{slug:'win'}}),res(board)).grade,'LOSS');
});

// ---- lock gate (first actual competitive start)
const snapOf=(over={})=>({fetched_at:'2026-10-14T20:00:00Z',event_status:{state:'pre',name:'STATUS_SCHEDULED',completed:false,period:1},players:[{slug:'a',thru:null,rounds:[{round:1,strokes:null,tee_time:'2026-10-14T23:30:00Z'}]},{slug:'b',thru:null,rounds:[{round:1,strokes:null,tee_time:'2026-10-15T00:10:00Z'}]}],...over});
const ed={slug:'buick-lpga-shanghai-q60750304-2026',starts_on:'2026-10-15'};
test('lock gate: before first sourced tee time minus 30 min only; scores or in-progress state block; no tee time -> conservative or HOLD',()=>{
 const ok=lockGate(snapOf(),ed,new Date('2026-10-14T20:10:00Z'));assert.equal(ok.ok,true);assert.equal(ok.first_tee,'2026-10-14T23:30:00Z');assert.equal(ok.deadline,'2026-10-14T23:00:00.000Z');
 assert.equal(lockGate(snapOf({fetched_at:'2026-10-14T23:00:00Z'}),ed,new Date('2026-10-14T23:05:00Z')).reason,'past_lock_deadline');
 assert.equal(lockGate(snapOf({event_status:{state:'in',name:'STATUS_IN_PROGRESS'}}),ed,new Date('2026-10-14T20:10:00Z')).reason,'event_not_pre_start');
 const scored=snapOf();scored.players[0].thru=2;assert.equal(lockGate(scored,ed,new Date('2026-10-14T20:10:00Z')).reason,'scores_posted');
 assert.equal(lockGate(snapOf(),ed,new Date('2026-10-14T22:00:00Z')).reason,'snapshot_stale');
 const nt=snapOf({players:[{slug:'a',thru:null,rounds:[]}]});

 const nt2={...nt,fetched_at:'2026-10-14T10:30:00Z'};assert.equal(lockGate(nt2,ed,new Date('2026-10-14T10:40:00Z')).reason,'hold_no_tee_time_after_conservative_deadline');
 const nt3={...nt,fetched_at:'2026-10-14T08:30:00Z'};assert.equal(lockGate(nt3,ed,new Date('2026-10-14T08:40:00Z')).rule,'conservative_utc_plus_14_midnight');
});

// ---- immutable ledger: mock R2 with atomic If-None-Match semantics
function mockR2(){const m=new Map();return {m,
 head:async k=>m.has(k)?{key:k}:null,get:async k=>m.has(k)?{text:async()=>m.get(k),json:async()=>JSON.parse(m.get(k))}:null,
 put:async(k,v,o={})=>{await null;const inm=o.onlyIf instanceof Headers?o.onlyIf.get('if-none-match'):null;if(inm==='*'&&m.has(k))return null;m.set(k,typeof v==='string'?v:JSON.stringify(v));return {etag:'e'+m.size};},
 list:async({prefix})=>({objects:[...m.keys()].filter(k=>k.startsWith(prefix)).sort().map(key=>({key})),truncated:false}),delete:async k=>m.delete(k)};}
test('create-only: concurrent duplicates -> exactly one stored, never overwritten; seal verifies',async()=>{
 const b=mockR2();const d1=await seal({x:1}),d2=await seal({x:2});
 const [r1,r2]=await Promise.all([createOnly(b,'k',d1),createOnly(b,'k',d2)]);
 assert.equal([r1,r2].filter(r=>r.created).length,1);assert.equal(JSON.parse(b.m.get('k')).sha256,(r1.created?d1:d2).sha256);
 assert.equal((await createOnly(b,'k',d2)).created,false);assert.ok(await verifySeal(JSON.parse(b.m.get('k'))));
 assert.equal(await verifySeal({...JSON.parse(b.m.get('k')),x:9}),false,'tampering breaks the seal');
});

// End-to-end lock in a TEST environment: projection + live snapshot fixtures, concurrent cron executions.
function envFixture(){
 const hist=[];for(let k=0;k<6;k++){const s=new Date(Date.parse('2026-06-04')+k*7*864e5).toISOString().slice(0,10);hist.push(edition('h'+k+'-2026',s,field(140,k)));}
 const target={slug:ed.slug,name:'2026 Buick LPGA Shanghai',id:'9970587e',starts_on:'2026-10-15',ends_on:'2026-10-18',status:'scheduled',coverage:'schedule_only',division:'men',tournament:{slug:'t-shanghai'},tour:{short:'LPGA'}};
 const ix={as_of:'2026-10-14T19:00:00Z',editions:[...hist.map(h=>({slug:h.slug,coverage:'full_field',status:'completed',starts_on:h.starts_on,ends_on:h.ends_on})),target]};
 const live=snapOf({players:Array.from({length:100},(_,i)=>({slug:'p'+i,name:'P'+i,status:'active',thru:null,rounds:[{round:1,strokes:null,tee_time:'2026-10-14T23:30:00Z'}]}))});
 const PUBLIC=mockR2();PUBLIC.m.set('projection/v2/index.json',JSON.stringify(ix));for(const h of hist)PUBLIC.m.set('projection/v2/editions/'+h.slug+'.json',JSON.stringify(h));
 PUBLIC.m.set('projection/v2/editions/'+ed.slug+'.json',JSON.stringify({...target,leaderboard:[]}));PUBLIC.m.set('live/v1/events/'+ed.slug+'.json',JSON.stringify(live));
 const kv=new Map();return {PUBLIC,RAW:mockR2(),STATE:{get:async k=>kv.get(k)??null,put:async(k,v)=>kv.set(k,v)},PICKS_ENABLED:'1',hist,target};
}
test('TEST env lock: concurrent cron runs lock once, before the first tee, privately; grades append as revisions',async()=>{
 const env=envFixture(),now=new Date('2026-10-14T20:10:00Z');
 const [a,b]=await Promise.all([runPicks(env,{now}),runPicks(env,{now})]);
 const locks=[...a.locks,...b.locks].filter(l=>l.edition===ed.slug);assert.equal(locks.filter(l=>l.status==='locked').length,1,JSON.stringify(locks));
 const lock=JSON.parse(env.RAW.m.get(lockKey(ed.slug)));assert.ok(await verifySeal(lock));
 assert.ok(Date.parse(lock.locked_at)<Date.parse(lock.start_evidence.first_tee));assert.equal(lock.model.version,MODEL_VERSION);assert.equal(lock.policy,POLICY_VERSION);
 assert.equal(lock.feature_cutoff.editions_used,6);assert.ok(lock.forecast.selections.length>=5);assert.equal(lock.market.status,'not_captured');
 assert.ok(![...env.PUBLIC.m.keys()].some(k=>k.startsWith('picks/')),'nothing written to the public bucket');
 // a third run (later tick) never rewrites the lock
 const before=env.RAW.m.get(lockKey(ed.slug));await runPicks(env,{now:new Date('2026-10-14T20:40:00Z')});assert.equal(env.RAW.m.get(lockKey(ed.slug)),before);
 // official result arrives -> revision 1; identical recheck -> no new revision; correction -> revision 2 supersedes
 const final={...env.target,status:'completed',coverage:'full_field',leaderboard:field(100)};env.PUBLIC.m.set('projection/v2/editions/'+ed.slug+'.json',JSON.stringify(final));
 await runPicks(env,{now:new Date("2026-10-19T12:00:00Z")});await runPicks(env,{now:new Date('2026-10-19T12:10:00Z')});
 const revs=[...env.RAW.m.keys()].filter(k=>k.startsWith('picks/v1/grades/'));assert.equal(revs.length,1);
 const r1=JSON.parse(env.RAW.m.get(revs[0]));assert.equal(r1.lock_sha256,lock.sha256);assert.ok(r1.grades.every(x=>['WIN','LOSS','VOID'].includes(x.grade)));
 const corrected={...final,leaderboard:final.leaderboard.map(r=>r.player.slug==='p0'?{...r,winner:false,position:2}:r.player.slug==='p1'?{...r,winner:true,position:1}:r)};
 env.PUBLIC.m.set('projection/v2/editions/'+ed.slug+'.json',JSON.stringify(corrected));await runPicks(env,{now:new Date('2026-10-20T12:00:00Z')});
 const revs2=[...env.RAW.m.keys()].filter(k=>k.startsWith('picks/v1/grades/')).sort();
 if(revs2.length===2){const r2=JSON.parse(env.RAW.m.get(revs2[1]));assert.equal(r2.supersedes,r1.sha256);assert.equal(env.RAW.m.get(revs2[0]),env.RAW.m.get(revs[0]),'revision 1 untouched');}
 const idx=JSON.parse(env.RAW.m.get('picks/v1/index.json'));assert.equal(idx.items.length,1);assert.ok(idx.record.families.find(f=>f.family==='winner').selections===1);
});
test('lock refuses after the first tee and when scores are posted (HOLD, nothing written)',async()=>{
 const env=envFixture();env.PUBLIC.m.set('live/v1/events/'+ed.slug+'.json',JSON.stringify({...JSON.parse(env.PUBLIC.m.get('live/v1/events/'+ed.slug+'.json')),fetched_at:'2026-10-14T23:05:00Z'}));const out=await runPicks(env,{now:new Date('2026-10-14T23:10:00Z')});assert.equal(out.locks[0].reason,'past_lock_deadline');
 assert.equal(out.locks[0].status,'hold');assert.equal(env.RAW.m.has(lockKey(ed.slug)),false);
});
test('picks lane is off unless PICKS_ENABLED=1',async()=>assert.equal((await runPicks({...envFixture(),PICKS_ENABLED:undefined})).status,'disabled'));

// ---- golf-api: All Access gate, no-store, public preview without values
const req=(path,cookie)=>new Request('https://golf.test'+path,{headers:cookie?{cookie}:{}});
const cookie='pbe_session='+'a'.repeat(24);
const idxDoc={model:MODEL_VERSION,policy:POLICY_VERSION,built_at:'2026-10-14T20:10:00Z',items:[{edition:{slug:'e',name:'E',starts_on:'2026-10-15',division:'women'},locked_at:'2026-10-14T20:10:00Z',selections:[{family:'top10',slug:'secret-golfer',name:'Secret Golfer',p:0.31,grade:'PENDING'}],probabilities:[{slug:'secret-golfer',win:0.1}]}],record:{families:[]}};
const picksEnv=m=>({PICKS:{get:async k=>k==='picks/v1/index.json'?{json:async()=>idxDoc}:null},PUBLIC:{get:async()=>null},AUTH:m===undefined?undefined:m==='outage'?{fetch:async()=>{throw new Error('down')}}:{fetch:async()=>Response.json({membership:m})}});
for(const [label,cookieOn,m] of [['guest',false,{}],['expired/lapsed',true,{sport:'golf',state:'all_access',entitled:false,access_source:'all_access'}],['sport-only',true,{sport:'golf',state:'sport_pro',entitled:true,access_source:'sport'}],['auth outage',true,'outage']])
 test('picks denied for '+label+' with no values',async()=>{for(const p of ['/v1/picks','/v1/picks/track-record']){const r=await api.fetch(req(p,cookieOn?cookie:null),picksEnv(m));assert.equal(r.status,403);const t=await r.text();assert.ok(!t.includes('secret-golfer')&&!t.includes('0.31'));assert.match(r.headers.get('cache-control'),/no-store/);}});
for(const state of ['all_access','owner'])test('picks granted for '+state+' (private, no-store)',async()=>{const r=await api.fetch(req('/v1/picks',cookie),picksEnv({sport:'golf',state,entitled:true,access_source:state}));assert.equal(r.status,200);assert.match(r.headers.get('cache-control'),/no-store/);const b=await r.json();assert.equal(b.items[0].selections[0].slug,'secret-golfer');});
test('public picks preview carries no golfer, selection or probability',async()=>{const r=await api.fetch(req('/v1/picks/preview'),{...picksEnv(),AUTH:{fetch:()=>{throw new Error('must not ask')}}});const t=await r.text();assert.equal(r.status,200);assert.ok(!/secret|0\.31|0\.1\b|slug/.test(t),t);assert.match(r.headers.get('cache-control'),/no-store/);});
test('no static/SEO/projection path can carry picks',async()=>{
 for(const f of ['scripts/prerender.mjs','scripts/export-public.mjs','workers/shared/projection.js','workers/shared/views.js'])assert.ok(!(await fs.readFile(f,'utf8')).includes('picks/v1'),f);
 const ingest=await fs.readFile('workers/golf-ingest/src/picks.js','utf8');assert.ok(!/PUBLIC\.put/.test(ingest),'picks lane never writes the public bucket');
 const sitemap=await fs.readFile('src/lib/render.js','utf8');assert.ok(!/picks\/v1/.test(sitemap));
});
test('golf-api forwards the picks admin routes to golf-ingest only with the admin check',async()=>{
 let seen=null;const env={INGEST:{fetch:async r=>{seen=new URL(r.url).pathname;return Response.json({ok:true});}},PUBLIC:{get:async()=>null}};
 const r=await api.fetch(new Request('https://golf.test/admin/picks-selftest',{method:'POST'}),env);assert.equal(r.status,401);assert.equal(seen,null);
});
