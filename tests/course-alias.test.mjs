import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {prepare} from '../workers/shared/projection.js';
// Minimal graph: every table loadGraph reads, empty unless set below.
const src=fs.readFileSync(new URL('../workers/shared/projection.js',import.meta.url),'utf8');
const keys=[...src.matchAll(/(\w+):\['golf_\w+'/g)].map(m=>m[1]);
const base=()=>Object.fromEntries(keys.map(k=>[k,[]]));
test('reviewed course alias: the duplicate folds into its primary; nothing else is merged',()=>{
 const g=base();g.captures=[{id:'cap1',source_id:'espn'},{id:'cap2',source_id:'wikidata'}];
 g.tournaments=[{id:'t',name:'The Open',slug:'the-open'}];
 g.courses=[{id:'P',slug:'old-course-at-st-andrews-q167245',name:'Old Course at St Andrews',capture_id:'cap2'},{id:'D',slug:'st-andrews-links-old-course-ec37',name:'St Andrews Links (Old Course)',locality:'St. Andrews',capture_id:'cap1'},{id:'S',slug:'siam-country-club-pattaya-old-course-ec10671',name:'Siam CC (Old Course)',capture_id:'cap1'}];
 g.layouts=[{id:'L1',course_id:'D',version_label:'2027 The Open setup (ESPN)',par:72,yardage:7297},{id:'L2',course_id:'S',version_label:'2026 setup',par:72}];
 g.editions=[{id:'E1',tournament_id:'t',edition_key:'2027',starts_on:'2027-07-15',rules:{}},{id:'E2',tournament_id:'t',edition_key:'2026',starts_on:'2026-03-01',rules:{}}];
 g.editionCourses=[{edition_id:'E1',layout_id:'L1',usage_role:'championship setup'},{edition_id:'E2',layout_id:'L2',usage_role:'championship setup'}];
 const P=prepare(g,{asOf:'2026-10-03T00:00:00Z'});
 assert.equal(P.editions.find(e=>e.id==='E1').course.slug,'old-course-at-st-andrews-q167245','edition follows the alias to the primary');
 assert.equal(P.editions.find(e=>e.id==='E2').course.slug,'siam-country-club-pattaya-old-course-ec10671','name-similar course untouched');
 assert.deepEqual(P.courses.map(c=>c.slug).sort(),['old-course-at-st-andrews-q167245','siam-country-club-pattaya-old-course-ec10671']);
 const doc=P.courseDoc(P.courses.find(c=>c.id==='P'));assert.equal(doc.aliases[0].slug,'st-andrews-links-old-course-ec37');assert.equal(doc.aliases[0].provenance.source,'espn');assert.equal(doc.aliases[0].evidence_id,'st-andrews-2026-10-02');
});
test('TPC Sawgrass: Stadium (ec19) folds into the Players history record; Dye\'s Valley and Sawgrass CC stay distinct',()=>{
 const g=base();g.captures=[{id:'c1',source_id:'espn'},{id:'c2',source_id:'wikidata'}];g.tournaments=[{id:'t',name:'The Players',slug:'the-players'},{id:'q',name:'Q-School',slug:'q-school'}];
 g.courses=[{id:'P',slug:'tpc-sawgrass-q4586108',name:'TPC Sawgrass',capture_id:'c2'},{id:'S',slug:'tpc-sawgrass-the-players-stadium-course-ec19',name:'TPC Sawgrass (THE PLAYERS Stadium Course)',capture_id:'c1'},
  {id:'V',slug:'tpc-sawgrass-dye-s-valley-course-ec11094',name:"TPC Sawgrass (Dye's Valley Course)",capture_id:'c1'},{id:'C',slug:'sawgrass-country-club-q7428632',name:'Sawgrass Country Club',capture_id:'c2'}];
 g.layouts=[{id:'LS',course_id:'S',version_label:'2026 THE PLAYERS Championship setup (ESPN)',par:72},{id:'LV',course_id:'V',version_label:'2025 Q-School setup (ESPN)',par:70},{id:'LC',course_id:'C',version_label:'Venue metadata only; tournament routing unavailable'}];
 g.editions=[{id:'E1',tournament_id:'t',edition_key:'2026',rules:{}},{id:'E2',tournament_id:'q',edition_key:'2025',rules:{}},{id:'E3',tournament_id:'t',edition_key:'1979',rules:{}}];
 g.editionCourses=[{edition_id:'E1',layout_id:'LS'},{edition_id:'E2',layout_id:'LV'},{edition_id:'E3',layout_id:'LC'}];
 const P=prepare(g,{asOf:'2026-10-03T00:00:00Z'});const at=id=>P.editions.find(e=>e.id===id).course.slug;
 assert.equal(at('E1'),'tpc-sawgrass-q4586108');assert.equal(at('E2'),'tpc-sawgrass-dye-s-valley-course-ec11094');assert.equal(at('E3'),'sawgrass-country-club-q7428632');
 assert.deepEqual(P.courses.map(c=>c.slug).sort(),['sawgrass-country-club-q7428632','tpc-sawgrass-dye-s-valley-course-ec11094','tpc-sawgrass-q4586108']);
 assert.equal(P.courseDoc(P.courses.find(c=>c.id==='P')).aliases[0].slug,'tpc-sawgrass-the-players-stadium-course-ec19');
});
