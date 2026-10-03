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
