import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {playerName} from '../src/lib/ui.js';
import {dnaModel,dnaHero,dnaRadar,dnaBody,metricBars,windowFingerprint} from '../src/lib/dna-ui.js';
import {towerRows,pulseEvents,pulseList,compactDna,focusPanel} from '../src/lib/cast-v3.js';
import {sanitize,EVENTS} from '../src/analytics.js';
const LIVE=JSON.parse(fs.readFileSync(new URL('./fixtures/pbecast-v3-bank-of-utah-r2.json',import.meta.url),'utf8'));
const fp={window:'Last 24 months',division:'men',cohort:'Men’s majors + PGA TOUR events with full-field leaderboards',editions:28,dimensions:[
 {code:'scoring',percentile:56,confidence:'HIGH',sample:87,basis:'rounds',cohort_size:474},{code:'consistency',percentile:38,confidence:'HIGH',sample:87,basis:'rounds',cohort_size:474},
 {code:'under_par',percentile:72,confidence:'HIGH',sample:87,basis:'rounds',cohort_size:473},{code:'cuts',percentile:51,confidence:'HIGH',sample:28,basis:'starts',cohort_size:466},
 {code:'top10',percentile:71,confidence:'HIGH',sample:28,basis:'starts',cohort_size:466},{code:'contention',percentile:73,confidence:'HIGH',sample:28,basis:'starts',cohort_size:466},
 {code:'form',percentile:31,confidence:'MEDIUM',sample:8,basis:'starts',cohort_size:400},{code:'majors',percentile:null,confidence:null,sample:2,basis:'starts',cohort_size:null},
 {code:'par4',percentile:58,confidence:'MEDIUM',sample:695,basis:'holes',cohort_size:300},{code:'par3',percentile:null,confidence:null,sample:20,basis:'holes'},{code:'par5',percentile:61,confidence:'MEDIUM',sample:300,basis:'holes',cohort_size:300}]};
const doc={slug:'austin-smotherman-q106782591',name:'Austin Smotherman',division:'men',dna_public:fp,visuals:{form:Array.from({length:8},(_,i)=>({name:'E'+i,ends_on:'2026-0'+(i+1)+'-01',vs_field:(i%3-1)/2}))},summary:{wins_observed:0}};

test('identity: canonical slug -> /player/<slug> anchor; unresolved or malformed -> plain text, never guessed',()=>{
 assert.equal(playerName({slug:'austin-smotherman-q106782591',name:'Austin Smotherman'}),'<a class="player-link" href="/player/austin-smotherman-q106782591" data-player-slug="austin-smotherman-q106782591">Austin Smotherman</a>');
 assert.equal(playerName({slug:null,name:'Sudarshan Yellamaraju'}),'Sudarshan Yellamaraju');
 assert.equal(playerName({slug:'Bad Slug"><x',name:'X'}),'X','non-canonical slug is not linked');
 assert.match(playerName({slug:'a-b',name:'A'},{hash:'#dna'}),/href="\/player\/a-b#dna"/);
});
test('PBEcast tower: name anchor sits OUTSIDE the select button (no anchor inside a button); unresolved has no anchor',()=>{
 const html=towerRows(LIVE.live.event,{selected:'austin-smotherman-q106782591'});
 assert.doesNotMatch(html,/<button[^>]*>[^<]*<a /,'no anchor nested in a button');
 const row=html.split('</li>').find(r=>r.includes('data-row="austin-smotherman-q106782591"'));assert.match(row,/<button type="button" class="cv3-hit" data-cv3-pick="austin-smotherman-q106782591" aria-pressed="true"[^>]*><\/button>/);assert.match(row,/<a class="cv3-plink-row" href="\/player\/austin-smotherman-q106782591"/);
 const un=LIVE.live.event.leaderboard.find(r=>!r.slug);if(un){const r2=html.split('</li>').find(r=>r.includes(`data-row="${un.name}"`));assert.doesNotMatch(r2,/href="\/player\//);}
});
test('scoring pulse: canonical names link out; event body is a separate focus button; unresolved names are text',()=>{
 const holes=new Map(LIVE.live.hole_scores.map(h=>[h.slug||h.name,h.holes]));const ev=pulseEvents(LIVE.movement.points,{holes,round:2,limit:500});const html=pulseList(ev);
 assert.match(html,/<a class="pl-name" href="\/player\/austin-smotherman-q106782591"[^>]*>SMOTHERMAN<\/a> <button type="button" class="pl-go"/);
 assert.doesNotMatch(html,/<button[^>]*>[^<]*<a /);
 for(const x of ev)for(const w of x.who||[])if(!w.slug)assert.ok(!html.includes(`>${w.label}</a>`)||html.includes(`href="/player/`),'unresolved never linked');
 const m=ev.find(x=>x.move);if(m)assert.match(pulseList([m]),/class="pl-mv (up|down)"/);
});
test('DNA radar: missing never plotted as zero, line breaks at gaps, not-comparable rows off the radar, no composite',()=>{
 const m=dnaModel(fp);const svg=dnaRadar(m,{title:'X'});
 assert.equal((svg.match(/class="dr-pt/g)||[]).length,m.metrics.filter(x=>!x.missing&&x.percentile!==null).length,'one point per published value');
 assert.match(svg,/class="dr-axis is-na"/);assert.doesNotMatch(svg,/<polygon class="dr-shape"/,'no closed polygon through a gap');
 assert.match(svg,/Majors<\/tspan><tspan class="dr-val" dx="6">—/);
 for(const s of [svg,dnaHero(doc,m),dnaBody(doc,m),metricBars(m)])assert.doesNotMatch(s,/composite score [0-9]|overall rating|DNA score|\b0th percentile/i);
 assert.match(dnaHero(doc,m),/no composite score/);
 // chart and text agree: every published value appears in both the radar label and the dimension rows
 for(const x of m.ranked){assert.match(svg,new RegExp(`dr-val" dx="6">${x.percentile}<`));assert.match(metricBars(m),new RegExp(`mbar-pct">${x.percentile}<`));}
});
test('DNA cards: best edge, most reliable (confidence then sample), recent form, contention profile without repetition',()=>{
 const h=dnaHero(doc,dnaModel(fp));
 assert.match(h,/Best DNA edge<\/span><b>Contention \(top 5\)<\/b><span class="dna-card-v">73rd percentile/);
 assert.match(h,/Most reliable<\/span><b>Under-par rounds<\/b><span class=\"dna-card-v\">72nd percentile<\/span><span class=\"dna-card-s\">n=87 rounds · High confidence/);
 assert.match(h,/Contention profile<\/span><dl class="dna-cdl"><div><dt>Top 5 \(contention\)<\/dt><dd>73rd <small>n=28 starts<\/small><\/dd><\/div><div><dt>Top 10<\/dt><dd>71st/);
 assert.equal((h.match(/Contention \(top 5\)<\/b>/g)||[]).length,1,'headline not repeated as a card title');
 assert.match(h,/last 8 of 8 observed full-field events/);
 const empty=dnaHero({name:'New Player'},dnaModel({...fp,dimensions:fp.dimensions.map(d=>({...d,percentile:null}))}));assert.match(empty,/does not yet have enough comparable sample/);assert.doesNotMatch(empty,/data-w=|dr-pt/);
});
test('window toggle: a premium window becomes the same fingerprint shape; definitions and samples follow the window',()=>{
 const w={division:'men',window:{key:'all',label:'All observed'},cohort:'c',editions:90,metrics:{scoring:{value:-0.3,sample:300,basis:'rounds',confidence:'HIGH',cohort_size:900,percentile:64},majors:{value:null,sample:1,basis:'starts',confidence:null,percentile:null}}};
 const m=dnaModel(windowFingerprint(w));assert.equal(m.window,'All observed');const sc=m.metrics.find(x=>x.key==='scoring');assert.equal(sc.sample_n,300);assert.equal(sc.percentile,64);
 assert.equal(m.metrics.find(x=>x.key==='majors').percentile,null);assert.equal(windowFingerprint(null),null);
});
test('PBEcast compact DNA uses the public player DNA model (top 4), degrades cleanly, never zeros',()=>{
 const c=compactDna(doc);assert.equal((c.match(/<div><dt>/g)||[]).length,4);assert.match(c,/Contention \(top 5\)<\/dt><dd><b>73<\/b>/);assert.match(c,/href="\/player\/austin-smotherman-q106782591#dna"/);
 const none=compactDna({...doc,dna_public:null});assert.match(none,/Player DNA does not yet have enough comparable sample/);assert.doesNotMatch(none,/<b>0<\/b>/);
 assert.equal(compactDna({name:'Unresolved',dna_public:fp}),'','no slug -> no DNA, no link');
 const r=LIVE.live.event.leaderboard[0];const fpnl=focusPanel(LIVE.live.event,r,{dnaBlock:c,player:{slug:r.slug,name:r.name}});assert.match(fpnl,/data-cv3-dna/);assert.match(fpnl,/cv3-plink/);
});
test('analytics: new events allowlisted; parameters are slug-shaped only (no names)',()=>{
 for(const n of ['pbecast_player_click','pbecast_dna_open','dna_window_change','dna_dimension_focus'])assert.ok(EVENTS.has(n));
 assert.deepEqual(sanitize({entity_type:'player',entity_id:'austin-smotherman-q106782591',dna_window:'l24m',dna_dimension:'par4'}),{surface:'golf',entity_type:'player',entity_id:'austin-smotherman-q106782591',dna_window:'l24m',dna_dimension:'par4'});
 assert.equal(sanitize({entity_id:'Austin Smotherman'}).entity_id,undefined,'a name is rejected');
});
