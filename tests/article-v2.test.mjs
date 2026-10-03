// Golf Newsroom V6 / Article Experience V2 (golf-article/5): packet-owned highlights, course fingerprint,
// compact DNA + form modules, back-compat with golf-article/4, and the truth/premium gates staying intact.
import test from 'node:test';import assert from 'node:assert/strict';
import {TYPES} from '../workers/shared/news/types.js';
import {deskDraft,deskVersionFor,DESK_V6} from '../workers/shared/news/desk.js';
import {validateDraft,resolveHref} from '../workers/shared/news/validate.js';
import {buildArticle,articleExtras,ARTICLE_VERSION} from '../workers/shared/news/plan.js';
import {articlePage} from '../src/lib/article.js';

const holes=Array.from({length:18},(_,i)=>{const par=[4,4,3,5,4,4,3,4,5,4,4,3,4,5,4,4,3,4][i];return {hole:i+1,par,yards:par===3?190+i:par===5?560:i%3?470:380,avg_to_par:par===5?-0.5:par===3?0.12:(i%4?0.08:-0.1)+(i===13?0.3:0),sample:300};});
const course={slug:'test-links',name:'Test Links',dna:{edition_range:[2015,2025],dimensions:[{code:'birdie_window',value:55.2,percentile:70},{code:'spread',percentile:85},{code:'difficulty',percentile:30},{code:'winning_score',value:-17.4,sample:6}]},
 contender_hole_scoring:{year:2025,holes},editions:[{year:2025,coverage:'full_field',winner:{slug:'champ',name:'Cam Champion'},to_par:-18},{year:2024,coverage:'full_field',winner:{slug:'other',name:'Otto Other'},to_par:-15}],player_history:[]};
const champ={slug:'champ',name:'Cam Champion',summary:{wins_observed:4,major_wins:0},photo:null,
 dna:{l24m:{window:{label:'Last 24 months'},metrics:{scoring:{percentile:91,confidence:'HIGH',sample:120,value:2.731},form:{percentile:88,confidence:'HIGH',sample:30,value:1.9},cuts:{percentile:80,confidence:'MEDIUM',sample:40,value:0.91},par5:{percentile:null,confidence:'LOW',sample:3,value:-0.4}}}},
 visuals:{form:Array.from({length:8},(_,i)=>({slug:'e'+i,name:'Event '+i,ends_on:`2026-0${i+1}-15`,position:i+2,tied:i%2===0,status:'finished',rounds:4,vs_field:1.234+i}))}};
const up={slug:'test-open-2026',name:'2026 Test Open',year:2026,tournament:{name:'Test Open'},status:'scheduled',coverage:'full_field',division:'men',is_major:false,starts_on:'2026-10-08',ends_on:'2026-10-11',course:{slug:'test-links',name:'Test Links'},
 espn:{tour_label:'PGA TOUR',course:{par:71,yards:7200,city:'Testville',state:'TX'},purse_text:'$8,000,000',field_size:120},provenance:{id:'cap-1'},leaderboard:[],
 defending_champion:{slug:'champ',name:'Cam Champion'},past_editions:[{slug:'test-open-2025',year:2025,winner:{slug:'champ',name:'Cam Champion'},to_par:-18},{slug:'test-open-2024',year:2024,winner:{slug:'other',name:'Otto Other'},to_par:-15}],field:{players:120,major_champions:[]}};
const ctx={ix:{players:[]},today:'2026-10-02',as_of:'x',window:[up],recent:[],ed:async()=>up,pl:async s=>s==='champ'?champ:null,co:async()=>course,live:async()=>null,ixPlayer:()=>null};
async function preview(){const P=await TYPES.preview.build(ctx,{type:'preview',topic:'preview:'+up.slug,edition:up.slug});assert.ok(P,'preview built');return P.freeze();}

test('v2: previews get the v6 desk; other classes keep v5',()=>{assert.equal(deskVersionFor('preview',['preview']),DESK_V6);assert.notEqual(deskVersionFor('final',['final']),DESK_V6);assert.equal(ARTICLE_VERSION,'golf-article/5');});

test('v2: preview packet carries public DNA percentiles and exact finishes only (no raw DNA, no strokes-vs-field)',async()=>{
 const pk=await preview();assert.ok(pk.charts.includes('player_dna'),'dna chart');assert.ok(pk.charts.includes('player_form'),'form chart');
 const blob=JSON.stringify(pk.chart_data.player_dna)+JSON.stringify(pk.chart_data.player_form);
 for(const raw of ['2.731','1.9','0.91','1.234','vs_field','"value"'])assert.ok(!blob.includes(raw),'premium/raw value leaked: '+raw);
 assert.ok(!pk.chart_data.player_dna.dims.some(d=>d.code==='par5'),'null percentile dimension omitted');});

test('v2: the v6 preview passes every gate; highlights and fingerprint are packet facts, never the quick-data row',async()=>{
 const pk=await preview();const d=deskDraft(pk,{version:DESK_V6});const v=validateDraft(pk,d,{resolve:resolveHref});assert.deepEqual(v.reasons,[]);
 const a=buildArticle({packet:pk,draft:d,editor:{mode:'desk'},slug:'2026-test-open-preview',ctx:{},hero:null});
 const facts=new Map(pk.facts.map(f=>[f.id,f])),quick=new Set(a.quick_facts.map(q=>q.fact));
 assert.ok(a.highlights.length>=3);for(const h of a.highlights){assert.equal(h.display,facts.get(h.fact).display);assert.ok(!quick.has(h.fact),'highlight repeats quick data: '+h.fact);}
 assert.ok(a.fingerprint?.items.length>=3);for(const x of [...a.highlights,...a.fingerprint.items])assert.ok(a.evidence.some(e=>e.fact===x.fact),'shown fact missing from evidence: '+x.fact);
 assert.ok(!a.sections.some(s=>s.heading==='Who fits the course'),'no named players → "What the course rewards"');
 assert.ok(a.sections.every(s=>s.paragraphs.length),'no empty sections');});

test('v2 render: modules, collapsible evidence, story-built block, no inline styles, Course View host hidden until verified',async()=>{
 const pk=await preview();const d=deskDraft(pk,{version:DESK_V6});const a=buildArticle({packet:pk,draft:d,editor:{mode:'desk'},slug:'s',ctx:{},hero:null});
 a.related={course:{name:'Test Links',href:'/course/test-links'}};const html=articlePage(a);
 for(const cls of ['story-glance','story-fp','sh2-col','sdna-row','sform-list','story-built','<details><summary>'])assert.ok(html.includes(cls),cls);
 assert.ok(!/ style=/.test(html),'no inline styles (CSP)');assert.match(html,/data-article-course-map data-course="test-links"[^>]*hidden/);
 assert.equal((html.match(/class="sh2-col/g)||[]).length,18);assert.match(html,/aria-label="Hole 14, par 5/);
 assert.ok(!html.includes('2.731')&&!html.includes('1.234'),'no raw values rendered');
 assert.match(html,/Explore full Player DNA/);assert.match(html,/<h2 id="evidence-h">Evidence ledger<\/h2>/);});

test('v2 render: a golf-article/4 document (no highlights field) still renders, deriving highlights only from its ledger',()=>{
 const v4={version:'golf-article/4',slug:'old',type:'preview',category:'PREVIEW',headline:[{t:'text',v:'Old story'}],dek:[{t:'text',v:'Dek.'}],sections:[{heading:'The week',paragraphs:[[{t:'text',v:'Text.'}]]}],quick_facts:[],charts:[],entities:[],
  evidence:[{fact:'cd_under_par_rounds',label:'Rounds under par',display:'56% of rounds',source:'Derived'},{fact:'cd_par5_total',label:'Par 5s per round',display:'−1.19 strokes per round',source:'Derived'},{fact:'max_gust',label:'Max gust',display:'20 mph',source:'NWS'}],
  sources:['ESPN'],known_limits:[],published_at:'2026-10-01T00:00:00Z',updated_at:'2026-10-01T00:00:00Z',packet_sha256:'abc',revisions:[],corrections:[]};
 const html=articlePage(v4);assert.match(html,/The week at a glance/);assert.match(html,/56% of rounds/);assert.ok(!html.includes('story-nav'),'thin story: no section nav');assert.ok(!html.includes('data-article-course-map'),'no course chart → no Course View');});

test('v2: extras never invent — no hole chart means no fingerprint; fewer than three highlight facts means none',()=>{
 const pk={type:'preview',facts:[{id:'cd_front_nine',label:'F',display:'−1'},{id:'cd_back_nine',label:'B',display:'+1'}],entities:[],chart_data:{}};
 const x=articleExtras(pk);assert.equal(x.fingerprint,null);assert.deepEqual(x.highlights,[]);assert.equal(x.callouts[0].kind,'split');});
