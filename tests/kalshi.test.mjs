// Kalshi Market Intelligence on Golf: vendored component integrity, same-origin data path, no-market -> nothing,
// Kalshi link-back, ranked golf field, placements and CSP/rewrites.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {kalshi,MARKETS_BASE,NOTE,golfEntry,historyEntry,phaseOf,nextPollMs,CLOSED_POLL_MS,cardHtml,castHtml,castPhase,castEntry,lineHtml,within,loadMarket,boardEntry} from '../src/lib/kalshi-live.js';
import {editionKalshiMount,editionHistoryMount,castKalshiMount,castHistoryMount,lineKalshiMount,closeLineMount,marketEligible,historyEligible,MARKET_HISTORY_SINCE} from '../src/lib/kalshi-mounts.js';
import {edition,pbecast,scheduleRail,live,today,home,intelligence} from '../src/lib/pages.js';
import {__resetKalshiFlashes} from '../src/vendor/kalshi/kalshi-market-ui.js';
import {castShell} from '../src/lib/cast-v3.js';

const FX=JSON.parse(fs.readFileSync('tests/fixtures/kalshi-golf.json','utf8'));
const EVENT=FX.event_detail.event;                 // PGA TOUR Bank of Utah Championship, with observed movement
const PGA=FX.board.events[0],LPGA=FX.board.events[1];
const ID='70c0e316-a890-598c-ae60-17e818586f39';
const ED={id:ID,slug:'bank-of-utah-championship-q130604671-2026',name:'2026 Bank of Utah Championship',year:2026,status:'in_progress',division:'men',is_major:false,tours:['PGA Tour'],tour:{key:'pga',name:'PGA TOUR'},starts_on:'2026-10-01',ends_on:'2026-10-04',coverage:'schedule_only',leaderboard:[],location:'Utah'};
const DONE={...ED,id:'11111111-2222-5333-8444-555555555555',slug:'x-2025',name:'2025 X',status:'completed',starts_on:'2025-10-23',ends_on:'2025-10-26'};
const IX={current:[ED],upcoming:[],recent:[DONE],editions:[ED,DONE],players:[],courses:[],featured_matchups:[],coverage:{full_field_editions:1,men_majors:0,women_majors:0,editions_with_leaderboards:1,rounds:1,players:1},as_of:'2026-10-03T00:00:00Z',schedule:{events:[ED,DONE]},methods:{dna:'',course:'',fit:''},dimensions:[],sources:[]};

test('vendored shared Kalshi files are byte-identical to the canonical client (propbetedge-workers ad6187a)',()=>{
 const PIN={
  'README.md':'a80e4ac5d8733bde8afc0c13c281242babff8b1acd083974741f677b7af5a480',
  'kalshi-market-client.js':'68f9ed06de627654634e385acc79b1efdee858de4a59801e20b401b5c0bc43dc',
  'kalshi-market-ui.css':'fb046ada2b2e5450207e4301c0e41a193aa599e4661843fdcdb50d45ac7191ae',
  'kalshi-market-ui.js':'03712a0eb48e5265523ec45b145fd2fa880c9435e1adf2c6ca988c78c3fa37a8'};
 assert.deepEqual(fs.readdirSync('src/vendor/kalshi').sort(),Object.keys(PIN).sort());
 for(const [f,sha] of Object.entries(PIN))assert.equal(crypto.createHash('sha256').update(fs.readFileSync('src/vendor/kalshi/'+f)).digest('hex'),sha,f);
 assert.match(fs.readFileSync('.gitattributes','utf8'),/^src\/vendor\/kalshi\/\*\* -text$/m,'vendored bytes are never line-ending converted');
});

test('browser code never calls Kalshi or a Worker host; the client reads same-origin /api/markets only',async()=>{
 const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(x=>x.isDirectory()?walk(path.join(d,x.name)):[path.join(d,x.name)]);
 const files=[...walk('src'),'index.html'].filter(f=>/\.(js|ts|mjs|html|css)$/.test(f));
 for(const f of files){
  const t=fs.readFileSync(f,'utf8');
  assert.doesNotMatch(t,/(?:trading-api|api\.elections|external-api)\.kalshi\.com|kalshi\.com\/trade-api|api\.kalshi\.co/i,f);
  const hosts=t.match(/propsports-markets\.sales-fd3\.workers\.dev/g)||[];
  // Only exception: the vendored client's default `base` (unused: golf passes base '/api/markets').
  if(f.replaceAll('\\','/')==='src/vendor/kalshi/kalshi-market-client.js')assert.equal(hosts.length,1,f);else assert.equal(hosts.length,0,f);
 }
 assert.equal(MARKETS_BASE,'/api/markets');assert.equal(kalshi.sport,'golf');
 const seen=[];const original=globalThis.fetch;
 globalThis.fetch=async url=>{seen.push(String(url));return new Response(JSON.stringify(String(url).includes('/event/')?{enabled:true,event:null}:{enabled:true,events:[]}),{status:200,headers:{'content-type':'application/json'}});};
 try{await kalshi.loadBoard({force:true});await kalshi.loadEvent(ID,{force:true});}finally{globalThis.fetch=original;}
 assert.deepEqual(seen,['/api/markets/v1/market-intelligence/sport/golf','/api/markets/v1/market-intelligence/event/golf/'+ID]);
});

test('no entry renders nothing at every placement (card, PBEcast module, card line)',async()=>{
 for(const v of [null,undefined,{},{event:{},kalshi:null}]){assert.equal(cardHtml(v),'');assert.equal(castHtml(v),'');assert.equal(lineHtml(v),'');}
 // API answer with no open market -> client resolves null -> nothing
 const original=globalThis.fetch;globalThis.fetch=async()=>new Response(JSON.stringify({contract:'market-intel/1',sport:'golf',enabled:true,event:null}),{status:200});
 try{const entry=await kalshi.loadEvent('22222222-3333-5444-8555-666666666666',{force:true});assert.equal(entry,null);assert.equal(cardHtml(entry),'');}finally{globalThis.fetch=original;}
 // failures and timeouts are nothing, never a placeholder
 const failing=globalThis.fetch;globalThis.fetch=async()=>{throw Error('down');};
 try{assert.equal(cardHtml(await kalshi.loadEvent('33333333-3333-5444-8555-666666666666',{force:true})),'');}finally{globalThis.fetch=failing;}
 assert.equal(await within(new Promise(()=>{}),20),undefined);
 // any other proposition, a settled market or a finished event: nothing (never a misread contract)
 const other=structuredClone(EVENT);other.kalshi.proposition='player_top_10';assert.equal(cardHtml(other),'');assert.equal(golfEntry(other),null);
 const settled=structuredClone(EVENT);settled.kalshi.state='settled';assert.equal(cardHtml(settled),'');
 const settledQuote=structuredClone(EVENT);settledQuote.kalshi.state='settled';assert.equal(castHtml(settledQuote),'','settled quote without history -> nothing');
 // the static mounts are empty elements hidden by CSS (no reserved box) and absent for completed editions
 assert.match(fs.readFileSync('src/kalshi.css','utf8'),/\.kx-mount:empty\{display:none\}/);
 for(const fn of [editionKalshiMount,castKalshiMount,lineKalshiMount]){assert.equal(fn(DONE),'');assert.equal(fn({...ED,id:'not-a-uuid'}),'');assert.equal(fn({...ED,status:'cancelled'}),'');assert.match(fn(ED),/^<div class="kx-mount[^"]*" data-kalshi-[a-z]+="70c0e316-[^"]+"[^>]*><\/div>$/);}
 assert.equal(marketEligible({...ED,winner:{slug:'w'}}),false);
 assert.doesNotMatch(edition(DONE,IX),/data-kalshi/);
});

test('golf field market renders ranked golfers with the tournament-winner note',()=>{
 __resetKalshiFlashes();
 const html=cardHtml(EVENT);
 assert.match(html,/<ol class="kx__field">/);
 const rows=html.match(/<li class="kx__frow">/g)||[];assert.equal(rows.length,8,'top eight of the API order');
 const names=[...html.matchAll(/<span class="kx__fname"><b>([^<]+)<\/b>/g)].map(m=>m[1]);
 assert.deepEqual(names,EVENT.kalshi.outcomes.slice(0,8).map(o=>o.abbr),'API Mid-market order kept');
 assert.match(html,/<span class="kx__frank mono">1<\/span>/);
 assert.match(html,/2 more traded contracts on Kalshi\./);
 assert.ok(html.includes(NOTE));assert.equal(NOTE,'Kalshi tournament-winner contracts: a YES pays $1 if that golfer wins the tournament.');
 assert.match(html,/Market Pulse/);assert.match(html,/not sportsbook odds and not a PropBetEdge model/);
 // board entries render the same field (no movement) and LPGA bid/ask when no Mid-market exists
 assert.match(cardHtml(PGA),/kx__field/);
 const l=cardHtml(LPGA);assert.match(l,/kx__field/);assert.match(l,/Jeeno Thitikul/);assert.match(l,/40¢ \/ 54¢/);
 // compact placements
 const s=castHtml(EVENT,{live:'live'});assert.match(s,/^<div class="cast-mkt" data-phase="live">/);assert.ok(s.includes(NOTE));assert.match(s,/kx__field/);
 const line=lineHtml(PGA);assert.match(line,/KALSHI/);assert.ok(line.includes(EVENT.kalshi.outcomes[0].abbr));
});

test('every Kalshi price links to the Kalshi market, new tab, rel sponsored',()=>{
 for(const html of [cardHtml(EVENT),castHtml(EVENT),cardHtml(LPGA)]){
  const links=html.match(/<a [^>]*>/g)||[];assert.ok(links.length>=6,"one link per golfer plus the market CTA");
  for(const a of links){assert.match(a,/href="https:\/\/kalshi\.com\/markets\//);assert.match(a,/target="_blank"/);assert.match(a,/rel="noopener noreferrer sponsored"/);}
 }
});

test('poll lanes: live 20 s while the edition is in progress, pregame 45 s before, idle without a market',()=>{
 assert.equal(phaseOf(null),'idle');
 assert.equal(phaseOf({event:{state:'in'}}),'live');
 assert.equal(phaseOf({event:{state:'pre'}},{from:'2026-10-01',to:'2026-10-04'},'2026-10-03'),'live');
 assert.equal(phaseOf({event:{state:'pre'}},{from:'2026-10-08',to:'2026-10-11'},'2026-10-03'),'pregame');
 assert.equal(kalshi.pollMsFor('live'),20000);assert.equal(kalshi.pollMsFor('pregame'),45000);
 const src=fs.readFileSync('src/lib/kalshi-live.js','utf8');
 assert.match(src,/if\(!el\.isConnected\)return stop\(\)/,'a chain stops when its mount leaves the DOM');
 assert.match(src,/addEventListener\('pagehide'/,'every chain is cleared on pagehide');
 const main=fs.readFileSync('src/main.ts','utf8');
 assert.match(main,/hydrateKalshi\(document,\{after:liveFirstPass\}\)/);assert.match(main,/boardWithin\(\)\]\);const main=\$\('main'\)/,'PBEcast switch waits at most 800 ms for the board');
});

test('placements: tournament block, PBEcast Market Pulse, schedule and live cards; methodology section',()=>{
 const ed=edition(ED,IX);
 const mount=ed.indexOf('data-kalshi-edition="'+ID+'"');assert.ok(mount>0);
 assert.ok(ed.indexOf('data-live-board')<mount,'after the live board');
 assert.match(pbecast(IX,ED),new RegExp('<section class="cast-head">.*data-kalshi-cast="'+ID+'"(?! data-kalshi-done).*</section>'));
 assert.doesNotMatch(pbecast(IX,DONE),/data-kalshi/);
 assert.match(scheduleRail(IX,'2026-10-03'),new RegExp('data-kalshi-line="'+ID+'"'));
 assert.match(live(IX),new RegExp('data-kalshi-line="'+ID+'"'));
 for(const h of [today(IX),home(IX)])assert.equal((h.match(/data-kalshi-line=/g)||[]).length,1,'one restrained line per current edition');
 const m=intelligence(IX);assert.match(m,/id="kalshi"/);
 assert.match(m,/Live prediction-market pricing is built into PropBetEdge tournament pages and PBEcast\./);assert.doesNotMatch(m,/part of every|if available|selected events|when a market exists/i);
 for(const p of [/prediction market/,/No sportsbook line is required/,/not sportsbook odds/,/not a PropBetEdge model/,/links to that market on Kalshi/,/Mid-market/,/spread is 10¢ or less/,/snapshots we actually recorded/,/YES pays \$1 if that golfer wins/,/Market history/,/not an opening price/,/awaiting settlement/,/Settlement is Kalshi’s, not our tournament result/])assert.match(m,p);
});

test('CSP stays same-origin; exact golf market rewrites precede the golf-api catch-all',()=>{
 const c=JSON.parse(fs.readFileSync('vercel.json','utf8'));
 const csp=c.headers[0].headers.find(h=>h.key==='Content-Security-Policy').value;
 const connect=csp.split(';').map(s=>s.trim()).find(s=>s.startsWith('connect-src '));
 assert.equal(connect,"connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com https://www.googletagmanager.com");
 assert.doesNotMatch(csp,/workers\.dev|kalshi/);
 const idx=s=>c.rewrites.findIndex(r=>r.source===s);
 const board=idx('/api/markets/v1/market-intelligence/sport/golf'),ev=idx('/api/markets/v1/market-intelligence/event/golf/:id([0-9a-f-]+)'),api=idx('/api/:path*');
 assert.ok(board>=0&&ev>=0&&board<api&&ev<api);
 assert.equal(c.rewrites[board].destination,'https://propsports-markets.sales-fd3.workers.dev/v1/market-intelligence/sport/golf');
 assert.equal(c.rewrites[ev].destination,'https://propsports-markets.sales-fd3.workers.dev/v1/market-intelligence/event/golf/:id');
 assert.equal(c.rewrites.filter(r=>/propsports-markets/.test(r.destination)).length,2,'no wildcard proxy to the markets service');
});

// ---- Market history (CLOSED / SETTLED). Fixture = the real tennis market-history/1 JSON reshaped to a golf field
// (tests/fixtures/kalshi-golf-history.json; tests only, never shipped).
const HX=JSON.parse(fs.readFileSync('tests/fixtures/kalshi-golf-history.json','utf8'));
const SETTLED=HX.settled.event;
const HID=SETTLED.event.canonical_event_id;
const closedOf=()=>{const c=structuredClone(SETTLED);c.market.lifecycle='CLOSED';c.market.close.lifecycle='CLOSED';const h=c.market_history;h.lifecycle='CLOSED';h.status_label='Market closed · awaiting settlement';h.markers.settlement=null;for(const o of h.outcomes)o.settlement=null;for(const o of c.market.close.outcomes)o.result=null;return c;};
const DONE26={...ED,id:HID,slug:'fixture-championship-2026',name:'2026 Fixture Championship',status:'completed',starts_on:'2026-10-01',ends_on:'2026-10-04',coverage:'full_field',winner:{slug:'w',name:'W'},leaderboard:[{pos:'1',player:{slug:'w',name:'W'},to_par:-10,rounds:[]}]};
const IX2={...IX,recent:[DONE26,DONE],editions:[ED,DONE26,DONE],schedule:{events:[DONE26]}};
const withFetch=async(handler,fn)=>{const original=globalThis.fetch;globalThis.fetch=handler;try{return await fn();}finally{globalThis.fetch=original;}};
const json=b=>new Response(JSON.stringify(b),{status:200,headers:{'content-type':'application/json'}});

test('completed editions get a history mount (API decides); older, cancelled and live-only placements do not',()=>{
 assert.equal(MARKET_HISTORY_SINCE,'2026-10-01');
 assert.equal(historyEligible(DONE26),true);assert.equal(historyEligible(DONE),false,'ended before the markets lane recorded golf');
 assert.equal(historyEligible({...DONE26,status:'cancelled'}),false);assert.equal(historyEligible({...DONE26,id:'nope'}),false);assert.equal(historyEligible(ED),false);
 assert.match(editionHistoryMount(DONE26),new RegExp('^<div class="kx-mount kx-edition kx-edition-done" data-kalshi-edition="'+HID+'" data-kalshi-done[^>]*></div>$'));
 const page=edition(DONE26,IX2);
 assert.equal((page.match(/data-kalshi-edition=/g)||[]).length,1,'one market mount on a completed tournament page');
 assert.match(page,/data-kalshi-done/);assert.doesNotMatch(page,/data-live-board/);
 const lb=page.indexOf('Final leaderboard');assert.ok(lb>0&&lb<page.indexOf('data-kalshi-done'),'our result first, then how the market closed');
 // live placements stay live-only
 for(const fn of [editionKalshiMount,castKalshiMount,lineKalshiMount])assert.equal(fn(DONE26),'');
 assert.match(pbecast(IX2,DONE26),new RegExp('data-kalshi-cast="'+HID+'" data-kalshi-done'),'PBEcast archive: how the market closed, same place');
 assert.equal(castHistoryMount(DONE),'');assert.equal(castHistoryMount(ED),'');
 // completed result cards: one close line each where a history can exist
 assert.match(closeLineMount(DONE26),/data-kalshi-line="[^"]+" data-kalshi-done/);assert.equal(closeLineMount(DONE),'');
 for(const h of [home(IX2),today(IX2)])assert.match(h,new RegExp('data-kalshi-line="'+HID+'" data-kalshi-done'));
 assert.match(scheduleRail(IX2,'2026-10-06'),new RegExp('data-kalshi-line="'+HID+'" data-kalshi-done'));
 // in-progress page keeps the live mount before the preview (it turns into the history when the market closes)
 assert.match(edition(ED,IX),new RegExp('data-kalshi-edition="'+ID+'"(?! data-kalshi-done)'));
});

test('SETTLED: "How the market closed" ranked field with venue settlement; first observed is never an open',async()=>{
 // the shared client (8b73545) keeps a completed field entry even though it has no live kalshi block
 const seen=[];
 const entry=await withFetch(async url=>{seen.push(String(url));return json(HX.settled);},()=>loadMarket(HID,{force:true}));
 assert.deepEqual(seen,['/api/markets/v1/market-intelligence/event/golf/'+HID],'one read, same-origin');
 assert.equal(entry?.market?.lifecycle,'SETTLED');assert.equal(entry.kalshi,null);
 const html=cardHtml(entry);
 assert.match(html,/How the market closed/);assert.match(html,/Market history · Kalshi/);assert.match(html,/Market settled/);
 assert.match(html,/<ol class="kx-h__rows kx-h__rows--field">/);
 const names=[...html.matchAll(/<span class="kx-h__who"><b>([^<]+)<\/b>/g)].map(m=>m[1]);assert.deepEqual(names,['Golfer Two','Golfer One']);
 assert.match(html,/<span class="kx__frank mono">1<\/span>/);
 assert.match(html,/Kalshi settlement: <b>Golfer Two<\/b> — YES/);assert.match(html,/Settled YES/);assert.match(html,/Settled NO/);
 assert.match(html,/Settlement is the market venue's, not our result\./);
 assert.match(html,/<small>First observed<\/small>/);assert.doesNotMatch(html,/<small>Open/i);assert.doesNotMatch(html,/opened at|opening line/i);
 assert.match(html,/“First observed” is our first record, not the opening price/,'partial history says so');
 assert.match(html,/<svg viewBox="0 0 320 96"/);assert.doesNotMatch(html,/ style=/,'no inline styles (strict CSP)');
 assert.doesNotMatch(html,/Market Pulse/);assert.ok(html.includes(NOTE));
 const cast=castHtml(entry);assert.match(cast,/data-phase="settled"/);assert.match(cast,/MARKET SETTLED/);assert.match(cast,/How the market closed/);assert.doesNotMatch(cast,/Market Pulse|LIVE MARKET/);
 // board close summary -> result-card line
 const line=lineHtml({event:SETTLED.event,kalshi:null,market:SETTLED.market});
 assert.match(line,/kx-line--closed/);assert.match(line,/MARKET<\/span>Golfer Two/);assert.match(line,/settled YES/);
 assert.equal(nextPollMs(entry,{done:true}),null,'SETTLED: no more reads');
});

test('CLOSED: "Market closed · awaiting settlement", re-read every 5 min until SETTLED',()=>{
 const c=closedOf();
 const html=cardHtml(c);
 assert.match(html,/Market closed · awaiting settlement/);assert.match(html,/Awaiting settlement/);
 assert.doesNotMatch(html,/Settled YES|settlement: <b>/);
 assert.match(lineHtml({event:c.event,kalshi:null,market:c.market}),/awaiting settlement/);
 assert.equal(CLOSED_POLL_MS,300000);
 assert.equal(nextPollMs(c),CLOSED_POLL_MS);assert.equal(nextPollMs(c,{done:true}),CLOSED_POLL_MS);
 // a finished tournament whose market is still open: nothing shown, 5-min reads until it closes
 const lag=structuredClone(EVENT);lag.event.state='post';lag.market={lifecycle:'ACTIVE'};
 assert.equal(cardHtml(lag),'');assert.equal(nextPollMs(lag),CLOSED_POLL_MS);
 // live lanes unchanged
 assert.equal(nextPollMs({event:{state:'in'},market:{lifecycle:'ACTIVE'}}),20000);
 assert.equal(nextPollMs({event:{state:'pre'},market:{lifecycle:'UPCOMING'}},{from:'2026-10-08',to:'2026-10-11'},'2026-10-03'),45000);
});

test('history: no entry renders nothing; completed mounts never show a live price; links are rel sponsored',async()=>{
 for(const v of [null,{},{event:{},market:{lifecycle:'SETTLED'}},{...SETTLED,market:{...SETTLED.market,proposition:'player_top_10'},market_history:{...SETTLED.market_history,proposition:'player_top_10'}}])assert.equal(cardHtml(v),'');
 const noHist=structuredClone(SETTLED);delete noHist.market_history;assert.equal(cardHtml(noHist),'','closed without history -> nothing');
 // API answers "no market" for a completed edition: nothing, and the chain stops
 const id='44444444-3333-5444-8555-666666666666';
 const e=await withFetch(async()=>json({contract:'market-intel/1',sport:'golf',enabled:true,event:null}),()=>loadMarket(id,{force:true}));
 assert.equal(e,null);assert.equal(cardHtml(e),'');
 assert.equal(nextPollMs(null,{done:true}),null);assert.equal(nextPollMs(null),120000,'a coming edition keeps checking on the idle lane');
 assert.equal(historyEntry(EVENT),null,'an open market never paints into a completed-edition mount');
 // board: the shared client keeps completed events (close summary) next to live ones
 const board={contract:'market-intel/1',sport:'golf',enabled:true,events:[{event:SETTLED.event,kalshi:null,market:SETTLED.market}]};
 await withFetch(async()=>json(board),()=>kalshi.loadBoard({force:true}));
 assert.equal(boardEntry(HID)?.market?.lifecycle,'SETTLED');
 const links=cardHtml(SETTLED).match(/<a [^>]*>/g)||[];assert.ok(links.length>=1);
 for(const a of links){assert.match(a,/href="https:\/\/kalshi\.com\/markets\//);assert.match(a,/target="_blank"/);assert.match(a,/rel="noopener noreferrer sponsored"/);}
});

test('completed MULTI-OUTCOME field with no live quote (kalshi null) survives the shared client and renders ranked history',async()=>{
 const F=HX.field_closed,FID=F.event.event.canonical_event_id;
 assert.equal(F.event.kalshi,null);assert.ok(F.event.market_history.outcomes.length>8);
 const entry=await withFetch(async()=>json(F),()=>loadMarket(FID,{force:true}));
 assert.equal(entry?.market?.lifecycle,'CLOSED','shared client (8b73545+) keeps it');
 const html=cardHtml(entry);
 assert.match(html,/How the market closed/);assert.match(html,/<ol class="kx-h__rows kx-h__rows--field">/);
 assert.equal((html.match(/<li class="kx-h__row/g)||[]).length,8,'top eight ranked');
 const ranks=[...html.matchAll(/<span class="kx__frank mono">(\d+)<\/span>/g)].map(m=>+m[1]);assert.deepEqual(ranks,[1,2,3,4,5,6,7,8]);
 const names=[...html.matchAll(/<span class="kx-h__who"><b>([^<]+)<\/b>/g)].map(m=>m[1]);assert.deepEqual(names,F.event.market_history.outcomes.slice(0,8).map(o=>o.abbr));
 assert.match(html,/112 more contracts on Kalshi\./);
 assert.match(html,/Market closed · awaiting settlement/);assert.doesNotMatch(html,/Settled YES|Market settled/);
 // never labelled live: no pulse, no live/trading copy
 assert.doesNotMatch(html,/kx__pulse|Market Pulse|>LIVE<|Live market/i);
 assert.match(html,/href="https:\/\/kalshi\.com\/markets\/kxpgatour\/pga-tour\/kxpgatour-baouc26"/);
 assert.match(castHtml(entry),/MARKET CLOSED · AWAITING SETTLEMENT/);assert.doesNotMatch(castHtml(entry),/LIVE MARKET|kx__pulse/);
 // board: closed field keeps the compact result-row line
 const board={contract:'market-intel/1',sport:'golf',enabled:true,events:[{event:F.event.event,kalshi:null,market:F.event.market}]};
 await withFetch(async()=>json(board),()=>kalshi.loadBoard({force:true}));
 const line=lineHtml(boardEntry(FID));assert.match(line,/kx-line--closed/);assert.match(line,/awaiting settlement/);
 // stale/open quote on a finished tournament is never shown as live
 const stale=structuredClone(EVENT);stale.event.state='post';assert.equal(cardHtml(stale),'');assert.equal(lineHtml(stale),'');
 assert.match(castHtml(stale),/TOURNAMENT FINAL · MARKET STILL TRADING/,'PBEcast labels a still-trading market after the final, never live');assert.doesNotMatch(castHtml(stale),/LIVE MARKET/);
});

test('PBEcast Market Pulse (MLB standard): full card under the scoreboard with a lifecycle label',()=>{
 __resetKalshiFlashes();
 // lifecycle labels
 assert.equal(castPhase(null),null);
 const up=structuredClone(EVENT);up.event.state=null;up.market={...(up.market||{}),lifecycle:'UPCOMING'};up.kalshi.freshness='live';
 assert.deepEqual(castPhase(up,'pre'),['pre','MARKET OPEN · PRE-TOURNAMENT']);
 assert.deepEqual(castPhase(up,'live'),['live','LIVE MARKET']);
 assert.deepEqual(castPhase(up,'round_complete'),['live','LIVE MARKET'],'between rounds the tournament is still under way');
 const act=structuredClone(up);act.market.lifecycle='ACTIVE';assert.deepEqual(castPhase(act,''),['live','LIVE MARKET']);
 assert.deepEqual(castPhase(up,'final'),['final-open','TOURNAMENT FINAL · MARKET STILL TRADING']);
 const st=structuredClone(act);st.kalshi.freshness='stale';assert.deepEqual(castPhase(st,'live'),['stale','MARKET OPEN · QUOTE NOT CURRENT'],'a stale quote is never labelled live');
 assert.deepEqual(castPhase(SETTLED),['settled','MARKET SETTLED']);assert.deepEqual(castPhase(closedOf()),['closed','MARKET CLOSED · AWAITING SETTLEMENT']);
 // full shared card, not a collapsed strip: Market Pulse header, freshness, ranked field, Kalshi CTA
 const h=castHtml(act,{live:'live'});
 assert.doesNotMatch(h,/<details|kx-strip/);
 assert.match(h,/<section class="ic kx kx--compact"/);assert.match(h,/Market Pulse/);assert.match(h,/View market on Kalshi ↗/);
 assert.equal((h.match(/<li class="kx__frow">/g)||[]).length,8,'ranked field kept (top eight)');
 assert.match(h,/data-kx-placement="pbecast"/);assert.doesNotMatch(h,/ style=/,'strict CSP: no inline styles');
 assert.equal(castEntry({...act,kalshi:{...act.kalshi,proposition:'player_top_10'}}),null);
 // slot directly under the scoreboard (bar + status), before the leaderboard tower; hidden while empty
 const shell=castShell();
 const bar=shell.indexOf('data-cv3-status'),mkt=shell.indexOf('data-cv3-mkt'),tower=shell.indexOf('data-cv3-tower');
 assert.ok(bar>0&&bar<mkt&&mkt<tower);assert.ok(shell.includes('<section class="cv3-mkt" data-cv3-mkt aria-label="Market Pulse"></section>'));
 const css=fs.readFileSync('src/kalshi.css','utf8');
 assert.ok(css.includes('.cv3-mkt:empty{display:none}'));
 const rows=css.split('\n').filter(l=>l.includes(':has(>.cv3-mkt:not(:empty)){grid-template-areas:')&&l.includes('"mkt'));
 assert.equal(rows.length,3,'mkt row only while the slot has content (desktop, fullscreen, phone)');
 const main=fs.readFileSync('src/main.ts','utf8');
 assert.ok(main.includes('cast.dataset.liveState=r.event.state'));assert.ok(main.includes('if(cast)placeCastMarket()'));
 const live=fs.readFileSync('src/lib/kalshi-live.js','utf8');
 assert.ok(live.includes("chain(el,el.dataset.kalshiCast||'',entry=>paintCast(el,entry),after)"),'first paint joins the live-scoring pass');
});

test('shared client ad6187a: a failed read is never cached as "no market" - last good kept, next poll retries',async()=>{
 const {createKalshiClient}=await import('../src/vendor/kalshi/kalshi-market-client.js');
 let n=0;/** @type {any[]} */const answers=[{status:200,body:FX.event_detail},{status:503,body:{}},{status:200,body:FX.event_detail}];
 const c=createKalshiClient({sport:'golf',base:'/api/markets',fetchImpl:async()=>{const a=answers[Math.min(n++,answers.length-1)];return new Response(JSON.stringify(a.body),{status:a.status});}});
 const first=await c.loadEvent(ID);assert.ok(first?.kalshi,'first read fills');
 const failed=await c.loadEvent(ID,{force:true});assert.equal(failed,first,'a 503 keeps the last good entry (no empty slot)');
 const again=await c.loadEvent(ID);assert.equal(n,3,'the failure was not cached: the next (unforced) poll reads again');assert.ok(again?.kalshi);
 // a failed first board read is not cached as an empty board either
 let b=0;const cb=createKalshiClient({sport:'golf',base:'/api/markets',fetchImpl:async()=>(b++===0?new Response('x',{status:500}):new Response(JSON.stringify(FX.board),{status:200}))});
 assert.equal((await cb.loadBoard()).size,0);assert.ok((await cb.loadBoard()).size>0,'board retried at once after a failure');assert.equal(b,2);
});

test('shared client ad6187a subtitle: "Live prediction market" only for a live-fresh quote; stale says "quote not current"',()=>{
 __resetKalshiFlashes();
 assert.equal(EVENT.kalshi.freshness,'live');assert.match(cardHtml(EVENT),/Live prediction market/);
 const stale=structuredClone(EVENT);stale.kalshi.freshness='stale';
 const html=cardHtml(stale);assert.match(html,/Prediction market · quote not current/);assert.doesNotMatch(html,/Live prediction market/);
 assert.match(castHtml(stale,{live:'live'}),/MARKET OPEN · QUOTE NOT CURRENT/);assert.doesNotMatch(castHtml(stale,{live:'live'}),/LIVE MARKET|Live prediction market/);
 const delayed=structuredClone(EVENT);delayed.kalshi.freshness='delayed';const d=cardHtml(delayed);assert.doesNotMatch(d,/Live prediction market|quote not current/);assert.match(d,/Prediction market/);
});
