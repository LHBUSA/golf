// Narrative context layer: derivations, the v5 desk story and the gates that keep it honest.
import test from 'node:test';import assert from 'node:assert/strict';
import {TYPES} from '../workers/shared/news/types.js';
import {deskDraft,DESK_V5} from '../workers/shared/news/desk.js';
import {validateDraft,resolveHref,segments,plain} from '../workers/shared/news/validate.js';
import {buildArticle} from '../workers/shared/news/plan.js';
import {articlePage} from '../src/lib/article.js';
import {RULES} from '../workers/shared/news/narrative.js';
const R=(round,strokes,to_par)=>({round,strokes,to_par});
// 18-hole layout: par 71 (pars 4,3,4,5,4,4,3,4,5 | 4,4,3,4,5,4,3,4,4).
const PARS=[4,3,4,5,4,4,3,4,5,4,4,3,4,5,4,3,4,4];
const card=(round,toPars)=>({round,scores:toPars.map((t,i)=>({hole:i+1,strokes:PARS[i]+t,to_par:t}))});
const even=()=>Array(18).fill(0);
function comebackEdition(){
 // Winner W: -3,-3,-4 then -9 (61... par 71 so 62); leader L: -6,-6,-6 then +1. Runner-up U matches W's final round.
 const filler=Array.from({length:37},(_,i)=>({player:{slug:'f'+i,name:'Filler '+String.fromCharCode(65+i%26)+'x'+i},position:5+i,tied:false,status:'finished',to_par:-5+Math.floor(i/3),strokes:279+Math.floor(i/3),rounds:[R(1,70,-1),R(2,70,-1),R(3,70,-1),R(4,69+Math.floor(i/3)%3,-2+Math.floor(i/3)%3)],holes:[]}));
 const wFinal=[-1,0,-1,-1,-1,0,0,-1,0, -1,0,0,-1,-2,-1,0,0,0];// front -5, back -5? compute below
 const W={player:{slug:'w',name:'Will Winner'},position:1,tied:false,status:'finished',winner:true,to_par:-19,strokes:265,rounds:[R(1,68,-3),R(2,68,-3),R(3,67,-4),R(4,62,-9)],
  holes:[card(1,[-1,0,0,-1,0,0,0,-1,0, 0,0,0,0,0,0,0,0,0]),card(2,[0,0,0,-1,0,0,0,0,-1, 0,0,0,0,-1,0,0,0,0]),card(3,[0,0,0,-1,0,0,0,0,-1, 0,-1,0,0,-1,0,0,0,0]),card(4,[-1,0,-1,-1,0,-1,0,-1,0, -1,0,0,-1,-1,-1,0,0,0])]};
 const L={player:{slug:'l',name:'Lee Leader'},position:3,tied:false,status:'finished',to_par:-17,strokes:267,rounds:[R(1,65,-6),R(2,65,-6),R(3,65,-6),R(4,72,1)],holes:[]};
 const U={player:{slug:'u',name:'Uma Second'},position:2,tied:false,status:'finished',to_par:-18,strokes:266,rounds:[R(1,69,-2),R(2,68,-3),R(3,67,-4),R(4,62,-9)],holes:[]};
 const C={player:{slug:'c',name:'Cal Fourth'},position:4,tied:false,status:'finished',to_par:-10,strokes:274,rounds:[R(1,66,-5),R(2,68,-3),R(3,69,-2),R(4,71,0)],holes:[]};
 return {slug:'narr-open-2026',name:'2026 Narr Open',year:2026,tournament:{name:'Narr Open'},status:'completed',coverage:'full_field',division:'men',is_major:false,starts_on:'2026-09-24',ends_on:'2026-09-27',
  course:{slug:'narr-links',name:'Narr Links'},espn:{tour_label:'PGA TOUR',course:{par:71,yards:7200,city:'Narrville',state:'TX'}},layout:{par:71,holes:PARS.map((p,i)=>({hole:i+1,par:p}))},provenance:{id:'cap'},leaderboard:[W,U,L,C,...filler]};
}
const pl={slug:'w',name:'Will Winner',summary:{wins_observed:2,major_wins:0},dna:{l24m:{window:{label:'Last 24 months'},metrics:{form:{percentile:95},contention:{percentile:91},par4:{percentile:88},par3:{percentile:40},scoring:{percentile:70}}}},
 visuals:{form:[{slug:'a',name:'2026 Alpha Classic',ends_on:'2026-08-01',position:4,tied:true,status:'finished'},{slug:'b',name:'Beta Open',ends_on:'2026-08-15',position:9,tied:false,status:'finished'},{slug:'c',name:'Gamma Invitational',ends_on:'2026-09-01',position:30,tied:true,status:'finished'}]},photo:null};
const ctx=ed=>({today:'2026-09-28',as_of:'x',recent:[ed],window:[],ed:async()=>ed,pl:async s=>s==='w'?pl:null,co:async()=>null});
async function packet(ed=comebackEdition()){const P=await TYPES.final.build(ctx(ed),{type:'final',topic:'final:'+ed.slug,edition:ed.slug});return P.freeze();}
const F=(pk,id)=>pk.facts.find(f=>f.id===id);

test('narrative: comeback derivations are exact (deficit, players ahead, gain on leader, round rank)',async()=>{const pk=await packet();
 assert.equal(F(pk,'winner_deficit').value,8);assert.equal(F(pk,'players_ahead_entering').value,1);assert.equal(F(pk,'players_ahead_entering').display,'one player');
 assert.equal(F(pk,'gain_on_r3_leader').value,10,'leader +1 vs winner -9');assert.equal(F(pk,'r3_leader_final_round').value,72);
 assert.equal(F(pk,'final_round_rank').display,'tied for the low round of the day');
 assert.equal(F(pk,'runner_up_final_round').value,62);
 const sig=pk.context.signals.map(s=>s.name);for(const s of ['final_round_comeback','runner_up_matched_final_round','close_finish','best_round_last','final_round_surge'])assert.ok(sig.includes(s),s);
 assert.ok(!sig.includes('wire_to_wire'));assert.ok(!sig.includes('dominant_finish'));
 assert.equal(F(pk,'gain_on_r3_leader').source.startsWith('Derived from'),true);assert.equal(F(pk,'gain_on_r3_leader').class,'D');});

test('narrative: hole-card facts come from the winner card only; runs never cross the turn',async()=>{const pk=await packet();
 assert.equal(F(pk,'final_front_nine').value,-5);assert.equal(F(pk,'final_back_nine').value,-4);
 assert.equal(F(pk,'final_birdie_run').value,3);assert.deepEqual(F(pk,'final_birdie_run_holes').value,[13,15]);
 const ed=comebackEdition();ed.leaderboard[0].holes[3]=card(4,[0,0,0,0,0,0,-1,-1,-1, -1,-1,0,0,0,-1,-1,-1,0]);// 7-8-9 and 10-11 are separate runs
 const pk2=await packet(ed);assert.equal(F(pk2,'final_birdie_run').value,3);assert.deepEqual(F(pk2,'final_birdie_run_holes').value,[7,9]);});

test('narrative: a DNA trait is tied to the week only when the cards single it out',async()=>{const pk=await packet();
 // Week: par 4s are the clear best hole type (-10 vs -9 on par 5s) and par4 is a DNA strength -> linked.
 assert.equal(F(pk,'week_par4').value,-10);assert.equal(F(pk,'week_par5').value,-9);assert.equal(pk.context.dna_event_link,'par4');
 const ed=comebackEdition();for(const h of ed.leaderboard[0].holes)for(const s of h.scores)if(PARS[s.hole-1]===4&&s.to_par===0&&s.hole===1)s.to_par=-1;
 // A tie between hole types never produces a link.
 const ed2=comebackEdition();ed2.leaderboard[0].holes=[1,2,3,4].map(k=>card(k,PARS.map(p=>p===4?-0:p===5?0:0)));const pk2=await packet(ed2);assert.equal(pk2.context.dna_event_link,undefined);});

test('narrative: v5 desk story passes every gate, introduces every module and stays inside the packet',async()=>{const pk=await packet();const d=deskDraft(pk,{version:DESK_V5});const v=validateDraft(pk,d,{resolve:resolveHref});
 assert.deepEqual(v.reasons,[]);assert.ok(v.words>=250,'words '+v.words);
 const heads=d.sections.map(s=>s.heading);for(const h of ['The result','How it turned','The profile behind it','What the numbers say','What it means'])assert.ok(heads.includes(h),h);
 for(const s of d.sections.filter(s=>s.module))assert.ok(s.paragraphs.length>=1&&pk.charts.concat('pbecast').includes(s.module),s.module);
 const text=d.sections.flatMap(s=>s.paragraphs).map(p=>plain(segments(p,pk,resolveHref,{links:false}))).join(' ');
 for(const w of ['Lee Leader','Uma Second','Will Winner'])assert.ok(text.includes(w),w);
 assert.match(text,/consistent with that profile/);assert.doesNotMatch(text,/because|thanks to/);});

test('narrative: a thin packet yields a short story, not padding',async()=>{const ed=comebackEdition();for(const r of ed.leaderboard)r.holes=[];ed.layout=null;
 const P=await TYPES.final.build({...ctx(ed),pl:async()=>null},{type:'final',topic:'final:x',edition:ed.slug});const pk=await P.freeze();const d=deskDraft(pk,{version:DESK_V5});const v=validateDraft(pk,d,{resolve:resolveHref});
 assert.deepEqual(v.reasons,[]);const full=validateDraft(await packet(),deskDraft(await packet(),{version:DESK_V5}),{resolve:resolveHref});assert.ok(v.words<full.words-80,`thin ${v.words} vs full ${full.words}`);
 assert.ok(!d.sections.some(s=>s.heading==='The profile behind it'));});

test('narrative gates: causation, hype, atmosphere, wrong pronoun and unknown modules are held',async()=>{const pk=await packet();const d=deskDraft(pk,{version:DESK_V5});
 const add=t=>validateDraft(pk,{...d,sections:[...d.sections,{heading:'X',paragraphs:[t]}]},{resolve:resolveHref}).reasons.join(' ');
 assert.match(add('{f:winner} won because of the putter work.'),/unsupported_causation/);
 assert.match(add('It was a stunning finish.'),/unsupported_superlative/);
 assert.match(add('The crowd roared as {f:winner} closed.'),/invented_atmosphere/);
 assert.match(add('She closed with {f:final_round}.'),/pronoun_not_supported/);
 assert.doesNotMatch(add('He closed with {f:final_round} on the back nine.'),/pronoun|number_word/);
 assert.match(validateDraft(pk,{...d,sections:[...d.sections,{heading:'X',paragraphs:['{f:winner} again.'],module:'shot_map'}]},{resolve:resolveHref}).reasons.join(),/unknown_module:shot_map/);});

test('narrative render: each module renders directly after the prose that introduces it',async()=>{const pk=await packet();const d=deskDraft(pk,{version:DESK_V5});
 const a=buildArticle({packet:pk,draft:d,editor:{mode:'deterministic_fallback',version:DESK_V5},slug:'s',ctx:{},hero:null});const html=articlePage(a);
 for(const s of a.sections.filter(s=>s.module&&s.module!=='pbecast')){const hi=html.indexOf('<h2>'+s.heading+'</h2>'),ci=html.indexOf(`data-chart="${s.module}"`),next=html.indexOf('<section class="story-section',hi+1);assert.ok(hi>=0&&ci>hi&&(next<0||ci<next),s.module);}
 assert.equal((html.match(/Open the PBEcast replay/g)||[]).length,1);
 for(const k of ['leaderboard','round_progress','winner_dna'])assert.ok(html.includes(`data-chart="${k}"`),k);});

test('narrative rules are encoded thresholds',()=>{assert.deepEqual(RULES.close_finish,{margin_max:2});assert.equal(RULES.contention_window.strokes,3);assert.equal(RULES.dna_strength.percentile_min,80);});
test('narrative SEO: titles are never cut inside a word',async()=>{const ed=comebackEdition();ed.tournament.name='Extraordinarily Long Sponsored Invitational Championship Presented Locally';ed.name='2026 '+ed.tournament.name;
 const pk=await packet(ed);const a=buildArticle({packet:pk,draft:deskDraft(pk,{version:DESK_V5}),editor:{mode:'x'},slug:'s',ctx:{},hero:null});
 assert.ok(a.seo.title.length<=65);const words=new Set(`Will Winner wins comes from back to win rallies the at ${ed.tournament.name} eight strokes`.split(/\s+/));for(const w of a.seo.title.split(' '))assert.ok(words.has(w),'whole word: '+w);});
// ---------------------------------------------------------------- preview / course / recap (v5)
import {applyEmphasis} from '../workers/shared/news/plan.js';
const HOLES=PARS.map((p,i)=>({hole:i+1,par:p,yards:p===3?200+i:p===5?560+i:(i%2?470:380)+i,sample:300,avg_to_par:p===5?-0.5:p===3?0.15:(i%2?0.2:-0.05)}));
const courseDoc={slug:'narr-links',name:'Narr Links',dna:{full_field_editions:3,confidence:'MEDIUM',edition_range:[2023,2025],dimensions:[{code:'difficulty',label:'Scoring difficulty',value:-0.5,unit:'u',percentile:40,confidence:'MEDIUM',sample:3},{code:'spread',label:'Spread',value:3.3,percentile:80,confidence:'MEDIUM',sample:3},{code:'birdie_window',label:'Under-par rounds',value:55.2,percentile:60,confidence:'MEDIUM',sample:3},{code:'winning_score',label:'Winning score',value:-17.3,percentile:null,sample:3}]},
 contender_hole_scoring:{edition:'narr-open-2025',year:2025,holes:HOLES},editions:[{year:2025,coverage:'full_field',winner:{slug:'w',name:'Will Winner'},to_par:-18},{year:2024,coverage:'full_field',winner:{slug:'u',name:'Uma Second'},to_par:-16}],
 player_history:[{slug:'w',name:'Will Winner',full_field_starts:3,top10:2,wins:1,best_finish:1,scoring_vs_field:2.9,fit:{secret:1}},{slug:'c',name:'Cal Fourth',full_field_starts:3,top10:1,wins:0,best_finish:6}]};
function upcoming(){const e=comebackEdition();return {...e,slug:'narr-open-2026u',status:'scheduled',starts_on:'2026-10-08',ends_on:'2026-10-11',leaderboard:[],defending_champion:{slug:'w',name:'Will Winner'},past_editions:[{slug:'a',year:2025,winner:{slug:'w',name:'Will Winner'},to_par:-18},{slug:'b',year:2024,winner:{slug:'u',name:'Uma Second'},to_par:-16}]};}
const preCtx=ed=>({today:'2026-10-05',as_of:'x',window:[ed],recent:[],ed:async()=>ed,pl:async s=>s==='w'?pl:null,co:async()=>courseDoc,ixPlayer:()=>null,live:async()=>null,movement:async()=>null});
async function v5(type,ed=upcoming()){const c=preCtx(ed);const P=await TYPES[type].build(c,TYPES[type].detect(c)[0]);const pk=await P.freeze();const d=deskDraft(pk,{version:DESK_V5});return {pk,d,v:validateDraft(pk,d,{resolve:resolveHref}),text:d.sections.flatMap(s=>s.paragraphs).map(p=>plain(segments(p,pk,resolveHref,{links:false}))).join(' ')};}

test('course v5: derived course facts are exact and the story passes every gate',async()=>{const {pk,v,text,d}=await v5('course_intelligence');
 assert.deepEqual(v.reasons,[]);assert.equal(F(pk,'cd_window_type').display,'par 5s');assert.equal(F(pk,'cd_par5_total').value,-1.5);
 assert.equal(F(pk,'cd_demand_type').display,'par 3s');assert.match(text,/they played over par/);
 assert.ok(F(pk,'cd_long_par4s')&&pk.context.course_signature.long_iron,'long par 4s are 0.25 harder');
 assert.match(text,/Will Winner has two top-ten finishes in three starts, including a win/);
 for(const h of ['What kind of course is this?','Where it creates separation','Scoring profile','Hole and yardage demands','Player types that fit','Historical context','Course DNA'])assert.ok(d.sections.some(s=>s.heading===h),h);
 assert.doesNotMatch(JSON.stringify(pk.facts),/scoring_vs_field|secret|2\.9/,'no premium fit or strokes-vs-field values');});

test('preview v5: unpublished field is stated, defending champion form is public, no picks language',async()=>{const {pk,v,text}=await v5('preview');
 assert.deepEqual(v.reasons,[]);assert.match(text,/has not been published yet/);assert.match(text,/defending champion sits in the 95th percentile for recent form/);
 assert.doesNotMatch(text,/should win|best bet|favou?rite|lock/i);assert.ok(pk.charts.includes('course_dna')&&pk.charts.includes('hole_difficulty'));});

test('round recap v5: lead change, movers, low round and what remains; never an outcome claim',async()=>{const ed=comebackEdition();ed.status='in_progress';ed.starts_on='2026-10-01';ed.ends_on='2026-10-04';
 for(const r of ed.leaderboard){r.rounds=r.rounds.slice(0,3);r.status='unknown';delete r.winner;}
 const c={...preCtx(ed),today:'2026-10-03',window:[ed]};const P=await TYPES.round_recap.build(c,{type:'round_recap',edition:ed.slug});const pk=await P.freeze();const d=deskDraft(pk,{version:DESK_V5});const v=validateDraft(pk,d,{resolve:resolveHref});
 assert.deepEqual(v.reasons,[]);const text=d.sections.flatMap(s=>s.paragraphs).map(p=>plain(segments(p,pk,resolveHref,{links:false}))).join(' ');
 assert.equal(F(pk,'rounds_left').display,'one round');assert.match(text,/completed rounds only/);
 const bad=validateDraft(pk,{...d,sections:[...d.sections,{heading:'X',paragraphs:['{f:leaders} is in control.']}]},{resolve:resolveHref});assert.match(bad.reasons.join(),/outcome_claim/);});

test('emphasis: anchors and one standout per section, first mention only, never long phrases, budget of five',async()=>{const pk=await packet();const d=deskDraft(pk,{version:DESK_V5});
 const a=buildArticle({packet:pk,draft:d,editor:{mode:'x'},slug:'s',ctx:{},hero:null});const em=a.sections.flatMap(s=>s.paragraphs.flat()).filter(g=>g.em);
 assert.ok(em.length>=1&&em.length<=5,'count '+em.length);assert.equal(new Set(em.map(g=>g.fact)).size,em.length,'first mention only');
 for(const s of a.sections)for(const p of s.paragraphs)assert.ok(p.filter(g=>g.em).length<=1,'one per paragraph');for(const g of em)assert.ok(g.v.length<=22,g.v);
 const html=articlePage(a);assert.ok((html.match(/story-em/g)||[]).length===em.length);
 assert.equal(applyEmphasis([{heading:'x',paragraphs:[[{t:'fact',fact:'winner',v:'Will Winner'}]]}],pk,[{}])[0].paragraphs[0][0].em,undefined,'names are not emphasised');});
