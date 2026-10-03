import test from 'node:test';import assert from 'node:assert/strict';
import {projectionPublic,publicPlayer,matchupPublic,publicCourse} from '../workers/shared/views.js';
// Premium values (raw DNA windows/values, Course Fit, field form) never leave GET /v1/projection unauthenticated,
// and the public views give the same result from a raw doc or an already-stripped doc (the static build path).
const dna={l24m:{division:'men',window:{key:'l24m',label:'Last 24 months'},cohort:'c',editions:5,metrics:{scoring:{value:-0.4,sample:40,basis:'rounds',numerator:null,confidence:'HIGH',cohort_size:300,percentile:61}}},all:{division:'men',window:{key:'all',label:'All observed'},cohort:'c',editions:9,metrics:{scoring:{value:-0.2,sample:90,basis:'rounds',confidence:'HIGH',cohort_size:500,percentile:55}}}};
const raw={slug:'p',name:'P',division:'men',results:[],course_history:[],summary:{},dna};
test('player projection doc: no raw DNA, public fingerprint kept, public view identical',()=>{
 const s=projectionPublic('players/p.json',raw);assert.equal(s.dna,undefined);assert.doesNotMatch(JSON.stringify(s),/"value":|"numerator"|"all":/);
 assert.deepEqual(publicPlayer(s).dna_public,publicPlayer(raw).dna_public);assert.equal(publicPlayer(s).premium.available,true);
 assert.deepEqual(matchupPublic(s,s).dna,matchupPublic(raw,raw).dna);
});
test('course and edition docs: Course Fit and premium field form stripped; bundle covers all lists',()=>{
 const c={slug:'c',player_history:[{slug:'p',fit:{score:1}}]};assert.equal(projectionPublic('courses/c.json',c).player_history[0].fit,undefined);
 assert.deepEqual(projectionPublic('courses/c.json',projectionPublic('courses/c.json',c)),publicCourse(c),'idempotent');
 const e={slug:'e',field:{method:'m',time_safe:true,players:[],major_champions:[{slug:'p',form:1,form_rounds:2,course_vs_field:3,course_rounds:4}],first_observed_appearances:[]}};
 assert.equal(projectionPublic('editions/e.json',e).field.major_champions[0].form,undefined);
 const b=projectionPublic('bundle.json',{index:{},players:[raw],courses:[c],editions:[e],stories:[]});assert.equal(b.players[0].dna,undefined);assert.equal(b.courses[0].player_history[0].fit,undefined);
 assert.deepEqual(projectionPublic('index.json',{a:1}),{a:1});
});
