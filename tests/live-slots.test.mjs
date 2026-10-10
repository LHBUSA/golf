// Home CLS contract: the live layer painted by main.ts (hydrateLive) fills space the page already reserved, so the
// schedule rail and everything under it do not move when /v1/live answers (Lighthouse culprit:
// main#main > section.sched-rail, 0.12-0.22 per shift before this contract).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parse} from 'node-html-parser';
import {liveWindow,liveRailSlot,heroLiveEdition,heroLiveSlot} from '../src/lib/live-slots.js';
import {liveRail,heroLive} from '../src/lib/live-ui.js';
import {home,today} from '../src/lib/pages.js';

const ED={id:'e1',slug:'baycurrent-classic-2026',name:'2026 Baycurrent Classic',starts_on:'2026-10-08',ends_on:'2026-10-11',status:'in_progress',division:'men',is_major:false,tour:{key:'pga',name:'PGA TOUR'},course:{name:'Yokohama Country Club',slug:'yokohama-cc'},location:'Japan',winner:null};
const NEXT={...ED,id:'e2',slug:'buick-lpga-shanghai-2026',name:'2026 Buick LPGA Shanghai',starts_on:'2026-10-15',ends_on:'2026-10-18',status:'scheduled',division:'women',tour:{key:'lpga',name:'LPGA Tour'}};
const OLD={...ED,id:'e3',slug:'old-open-2026',name:'2026 Old Open',starts_on:'2026-09-24',ends_on:'2026-09-27',status:'completed'};
const IX={current:[ED],upcoming:[NEXT],recent:[OLD],editions:[ED,NEXT,OLD],players:[],courses:[],featured_matchups:[],coverage:{full_field_editions:1,men_majors:0,women_majors:0,rounds:1,players:1},as_of:'2026-10-10T00:00:00Z',schedule:{events:[]},methods:{dna:'',course:'',fit:''},dimensions:[],sources:[]};
const T='2026-10-10T12:00:00Z';
const ev=(ed,state,extra={})=>({edition:{slug:ed.slug,name:ed.name},tour:ed.tour.name,course:{name:ed.course.name,city:'Yokohama',state:null,country:'Japan'},state,round:3,first_tee:null,age_seconds:448,leaders:[{name:'Jacob Bridgeman',total_to_par:-14,thru:18}],within_two:8,...extra});

// Box signature: element tags and classes in document order, ignoring the placeholder marker class.
const sig=html=>parse(`<div>${html}</div>`).querySelectorAll('*').map(n=>n.rawTagName.toLowerCase()+'.'+n.classList.value.filter(c=>!['live-skel','is-pre','is-done','is-live','is-warn'].includes(c)).sort().join('.'));

test('live window is the golf-ingest live lane window (starts_on - 1 day .. ends_on + 2 days)',()=>{
 const slugs=t=>liveWindow(IX,t).map(x=>x.ed.slug);
 assert.deepEqual(slugs(T),[ED.slug]);
 assert.deepEqual(slugs('2026-10-07T00:00:00Z'),[ED.slug],'an event enters one day before its start');
 assert.deepEqual(slugs('2026-10-06T23:59:00Z'),[]);
 assert.deepEqual(slugs('2026-10-13T00:00:00Z'),[ED.slug],'and stays two days after its end');
 assert.deepEqual(slugs('2026-10-13T00:00:01Z'),[]);
 assert.deepEqual(slugs('2026-10-14T00:00:00Z'),[NEXT.slug]);
 const BOTH={editions:[NEXT,{...ED,ends_on:'2026-10-13'}]};
 assert.deepEqual(liveWindow(BOTH,'2026-10-14T06:00:00Z').map(x=>x.ed.slug+':'+x.phase),[NEXT.slug+':pre',ED.slug+':final'],'live-lane order: pre before final');
 assert.deepEqual(liveWindow(IX,'2026-10-12T06:00:00Z').map(x=>x.phase),['final']);
 assert.deepEqual(liveWindow(IX,'2026-10-07T06:00:00Z').map(x=>x.phase),['pre']);
 assert.deepEqual(liveWindow({editions:[{...ED,status:'cancelled'},{...ED,tour:{key:'unassigned'}}]},T),[]);
 // same rule as the ingest lane, by source
 assert.match(fs.readFileSync('workers/golf-ingest/src/live.js','utf8'),/Date\.parse\(e\.starts_on\)<=t\+DAY&&Date\.parse\(e\.ends_on\)\+2\*DAY>=t&&e\.status!=='cancelled'/);
});

test('reserved live rail has the same boxes as the painted live rail',()=>{
 const BOTH={...IX,editions:[NEXT,{...ED,ends_on:'2026-10-13'}]};
 for(const [ix,t,events] of [[IX,T,[ev(ED,'round_complete')]],[BOTH,'2026-10-14T06:00:00Z',[ev(NEXT,'pre'),ev(ED,'final')]]]){
  const slot=parse(liveRailSlot(ix,t)).querySelector('[data-live-rail]');
  assert.ok(slot,'one data-live-rail mount');
  assert.deepEqual(sig(slot.innerHTML).map(s=>s.replace(/^div\.live-card$/,'a.live-card')),sig(liveRail(events)),t);
  for(const n of slot.querySelectorAll('[data-live-skel]'))assert.equal(n.innerHTML,'&nbsp;','placeholders carry no text');
  assert.equal(slot.querySelector('section').getAttribute('aria-hidden'),'true');
 }
 assert.equal(liveRailSlot(IX,'2026-09-01T00:00:00Z'),'<div data-live-rail></div>','nothing reserved outside a live window (no empty box)');
});

test('reserved home hero has the same boxes as the painted live hero',()=>{
 const pick=heroLiveEdition(IX,ED,T);assert.equal(pick.ed.slug,ED.slug);
 assert.deepEqual(sig(heroLiveSlot(pick)),sig(heroLive(ev(ED,'round_complete'))));
 const pre=heroLiveEdition({editions:[NEXT]},null,'2026-10-14T06:00:00Z');assert.equal(pre.phase,'pre');
 assert.deepEqual(sig(heroLiveSlot(pre)),sig(heroLive(ev(NEXT,'pre',{leaders:[],within_two:0}))));
 // a final event replaces the hero only when it is the page's lead (main.ts hydrateLive)
 assert.equal(heroLiveEdition({editions:[OLD]},ED,'2026-09-28T00:00:00Z'),null);
 assert.equal(heroLiveEdition({editions:[OLD]},OLD,'2026-09-28T00:00:00Z').ed.slug,OLD.slug);
});

test('home and today render the reserved slots; skeleton CSS reserves without showing; main.ts drops unused slots',()=>{
 const h=parse(home(IX,T));
 assert.ok(h.querySelector('[data-live-hero] .hero-leaders[data-live-skel]'));
 assert.equal(h.querySelectorAll('[data-live-rail] .live-card').length,1);
 assert.match(home(IX,T),/<\/section><div data-live-rail><section class="live-rail" aria-hidden="true" data-live-skeleton>/,'same place as before: right under the hero, above the schedule rail');
 assert.ok(parse(today(IX)).querySelector('[data-live-rail]'));
 const off=parse(home(IX,'2026-09-01T00:00:00Z'));
 assert.equal(off.querySelectorAll('[data-live-skel],[data-live-skeleton]').length,0);
 assert.match(off.querySelector('[data-live-hero]').innerHTML,/LATEST RESULT|THIS WEEK/);
 assert.match(fs.readFileSync('src/product.css','utf8'),/\.live-skel\{visibility:hidden\}/);
 const main=fs.readFileSync('src/main.ts','utf8');
 assert.match(main,/for\(const n of \$\$\('\[data-live-skeleton\],\[data-live-skel\]'\)\)n\.remove\(\)/);
 assert.match(main,/main\.innerHTML=hub\(ix\);if\(liveTop\)paintLiveTop\(liveTop\);/,'hub re-render keeps the painted live layer');
 assert.match(main,/projection\/index\.json',\{[^}]*priority:'low'/,'projection refresh yields to the hero image');
});
