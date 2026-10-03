// Customer source boundary (PropBetEdge network standard "DATA · PropSports"): public documents and rendered
// labels name PropSports; upstream ids/URLs stay internal; provenance blocks and licence credits pass through.
import test from 'node:test';
import assert from 'node:assert/strict';
import {publicDoc,projectionPublic,brandText,PUBLIC_SOURCE} from '../workers/shared/views.js';
import {customerSource,customerSources} from '../src/lib/brand.js';

test('public player doc: bio names PropSports; espn_id, profile_url and external_ids never leave the API',()=>{
 const raw={slug:'p',name:'P',external_ids:{espn:'1',owgr:'2'},wikidata_id:'Q1',bio:{source:'ESPN',espn_id:'9',college:'Texas',profile_url:'https://sports.core.api.espn.com/v2/x'},headshot:'https://a.espncdn.com/i/headshots/golf/players/full/9.png',season_stats:[{source:'ESPN season statistics'}],provenance:{source:'wikidata'},results:[],course_history:[]};
 const d=projectionPublic('players/p.json',raw);const s=JSON.stringify(d);
 assert.equal(d.bio.source,PUBLIC_SOURCE);assert.equal(d.bio.college,'Texas');
 assert.equal(d.external_ids,undefined);assert.doesNotMatch(s,/espn_id|profile_url|core\.api\.espn/);
 assert.equal(d.season_stats[0].source,'PropSports season statistics');
 assert.equal(d.wikidata_id,'Q1');assert.match(d.headshot,/espncdn/);assert.deepEqual(d.provenance,{source:'wikidata'});
 assert.equal(raw.bio.espn_id,'9','internal document untouched');
});
test('public edition doc: lane object becomes event_record without upstream ids; setup label drops the lane name',()=>{
 const d=publicDoc({espn:{event_id:'401',tour_label:'LPGA',purse_text:'$3,000,000',course:{name:'Black Desert',par:72,espn_id:'11307'},defending_champion_espn:null},layout:{label:'2025 Black Desert Championship setup (ESPN)'},defending_champion:{slug:'x',basis:'ESPN event record'}});
 assert.equal(d.espn,undefined);assert.equal(d.event_record.tour_label,'LPGA');assert.equal(d.event_record.event_id,undefined);assert.equal(d.event_record.course.espn_id,undefined);assert.equal(d.event_record.course.par,72);
 assert.equal(d.layout.label,'2025 Black Desert Championship setup');assert.equal(d.defending_champion.basis,'PropSports event record');
 assert.doesNotMatch(JSON.stringify(d),/espn/i);
});
test('coverage modes are provider-neutral; walker is idempotent',()=>{
 const c={live_scoring:'espn_core_snapshots',tee_times:'espn_core',official_rankings:false};
 assert.deepEqual(publicDoc(c),{live_scoring:'observed_snapshots',tee_times:'observed',official_rankings:false});
 const once=publicDoc({espn:{tour_label:'PGA Tour'},note:'Dates from tour schedules (Wikipedia) and ESPN event records.'});assert.deepEqual(publicDoc(once),once);
 assert.equal(once.note,'Dates from tour schedules (Wikipedia) and PropSports event records.');
});
test('rendered labels: upstream lane maps to PropSports; licence credits and publishers pass through',()=>{
 assert.equal(customerSource('ESPN (live scoring snapshot)'),'PropSports (live scoring snapshot)');
 assert.equal(customerSource('ESPN Golf core API'),'PropSports');
 assert.equal(customerSource('Wikipedia (CC BY-SA 4.0)'),'Wikipedia (CC BY-SA 4.0)');
 assert.equal(customerSource('MET Norway'),'MET Norway');
 assert.deepEqual(customerSources(['ESPN','Derived from round scores','ESPN']),['PropSports','Derived from round scores']);
 assert.equal(brandText('setup (ESPN)'),'setup');
});
test('source-brand guard: customer surfaces and public serializers carry no upstream branding',async()=>{
 const {scan}=await import('../scripts/guard-source-brand.mjs');assert.deepEqual(scan(),[]);
});
