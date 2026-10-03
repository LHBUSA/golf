// Kalshi Market Intelligence on Golf: vendored component integrity, same-origin data path, no-market -> nothing,
// Kalshi link-back, ranked golf field, placements and CSP/rewrites.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {kalshi,MARKETS_BASE,NOTE,golfEntry,phaseOf,cardHtml,stripHtml,lineHtml,within} from '../src/lib/kalshi-live.js';
import {editionKalshiMount,castKalshiMount,lineKalshiMount,marketEligible} from '../src/lib/kalshi-mounts.js';
import {edition,pbecast,scheduleRail,live,today,home,intelligence} from '../src/lib/pages.js';
import {__resetKalshiFlashes} from '../src/vendor/kalshi/kalshi-market-ui.js';

const FX=JSON.parse(fs.readFileSync('tests/fixtures/kalshi-golf.json','utf8'));
const EVENT=FX.event_detail.event;                 // PGA TOUR Bank of Utah Championship, with observed movement
const PGA=FX.board.events[0],LPGA=FX.board.events[1];
const ID='70c0e316-a890-598c-ae60-17e818586f39';
const ED={id:ID,slug:'bank-of-utah-championship-q130604671-2026',name:'2026 Bank of Utah Championship',year:2026,status:'in_progress',division:'men',is_major:false,tours:['PGA Tour'],tour:{key:'pga',name:'PGA TOUR'},starts_on:'2026-10-01',ends_on:'2026-10-04',coverage:'schedule_only',leaderboard:[],location:'Utah'};
const DONE={...ED,id:'11111111-2222-5333-8444-555555555555',slug:'x-2025',name:'2025 X',status:'completed',starts_on:'2025-10-23',ends_on:'2025-10-26'};
const IX={current:[ED],upcoming:[],recent:[DONE],editions:[ED,DONE],players:[],courses:[],featured_matchups:[],coverage:{full_field_editions:1,men_majors:0,women_majors:0,editions_with_leaderboards:1,rounds:1,players:1},as_of:'2026-10-03T00:00:00Z',schedule:{events:[ED,DONE]},methods:{dna:'',course:'',fit:''},dimensions:[],sources:[]};

test('vendored shared Kalshi files are byte-identical to the canonical client (b0cb0e1)',()=>{
 const PIN={
  'README.md':'a80e4ac5d8733bde8afc0c13c281242babff8b1acd083974741f677b7af5a480',
  'kalshi-market-client.js':'653cb0fc2673f909552453052560bfd6194e0e4d045c51b1eb73483957d4c049',
  'kalshi-market-ui.css':'572d18127bf6ce357e50b4320e0d98d83b07aa3d6bfb1e1c04c43bee4f009f98',
  'kalshi-market-ui.js':'0f03224b086e11967329e2a4666ef5327e335fbb32ae251a31a2a543b30e1952'};
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

test('no entry renders nothing at every placement (card, PBEcast strip, card line)',async()=>{
 for(const v of [null,undefined,{},{event:{},kalshi:null}]){assert.equal(cardHtml(v),'');assert.equal(stripHtml(v),'');assert.equal(lineHtml(v),'');}
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
 const post=structuredClone(EVENT);post.event.state='post';assert.equal(stripHtml(post),'');
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
 const s=stripHtml(EVENT,{open:true});assert.match(s,/^<details open class="kx-strip"/);assert.ok(s.includes(NOTE));
 const line=lineHtml(PGA);assert.match(line,/KALSHI/);assert.ok(line.includes(EVENT.kalshi.outcomes[0].abbr));
});

test('every Kalshi price links to the Kalshi market, new tab, rel sponsored',()=>{
 for(const html of [cardHtml(EVENT),stripHtml(EVENT),cardHtml(LPGA)]){
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
 assert.match(main,/hydrateKalshi\(document\)/);assert.match(main,/boardWithin\(\)\]\);const main=\$\('main'\)/,'PBEcast switch waits at most 800 ms for the board');
});

test('placements: tournament block, PBEcast strip, schedule and live cards; methodology section',()=>{
 const ed=edition(ED,IX);
 const mount=ed.indexOf('data-kalshi-edition="'+ID+'"');assert.ok(mount>0);
 assert.ok(ed.indexOf('data-live-board')<mount,'after the live board');
 assert.match(pbecast(IX,ED),new RegExp('<section class="cast-head">.*data-kalshi-strip="'+ID+'".*</section>'));
 assert.doesNotMatch(pbecast(IX,DONE),/data-kalshi/);
 assert.match(scheduleRail(IX,'2026-10-03'),new RegExp('data-kalshi-line="'+ID+'"'));
 assert.match(live(IX),new RegExp('data-kalshi-line="'+ID+'"'));
 for(const h of [today(IX),home(IX)])assert.equal((h.match(/data-kalshi-line=/g)||[]).length,1,'one restrained line per current edition');
 const m=intelligence(IX);assert.match(m,/id="kalshi"/);
 for(const p of [/prediction market/,/No sportsbook line is required/,/not sportsbook odds/,/not a PropBetEdge model/,/links to that market on Kalshi/,/Mid-market/,/spread is 10¢ or less/,/snapshots we actually recorded/,/YES pays \$1 if that golfer wins/])assert.match(m,p);
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
