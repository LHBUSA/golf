import test from 'node:test';import assert from 'node:assert/strict';import crypto from 'node:crypto';
import {routingParity,publishRouting} from '../workers/shared/routing-parity.js';
// golf#14 publish gate. Rows mirror osm-routing/v1/index.json course rows.
const row=(slug,status,holes,extra={})=>({slug,status,decision:status==='held'?'review_weak_identity':status==='no-routing'?'no_osm_course':'exact',holes_mapped:holes,osm_course:holes?'way/'+slug.length:null,...extra});
const live={courses:[row('aronimink',  'full',18),row('crooked','full',18),row('augusta','partial',17),row('broadmoor','held',0,{osm_course:'way/9'}),row('nowhere','no-routing',0)]};
test('complete export: identical index publishes',()=>{const r=routingParity(live,live);assert.equal(r.ok,true);assert.deepEqual(r.regressions,[]);});
test('dropped coordinates on mapped courses fail closed (status, holes and coords_missing all reported)',()=>{
 const next={courses:live.courses.map(c=>['aronimink','crooked','broadmoor'].includes(c.slug)?{...c,status:'no-routing',decision:'no_canonical_coords',holes_mapped:0,osm_course:null}:c)};
 const r=routingParity(live,next);assert.equal(r.ok,false);
 assert.deepEqual([...new Set(r.regressions.map(x=>x.slug))].sort(),['aronimink','broadmoor','crooked']);
 assert.ok(r.regressions.some(x=>x.slug==='broadmoor'&&x.kind==='coords_missing'),'held row losing coords is a regression too');
 assert.ok(r.regressions.some(x=>x.slug==='aronimink'&&x.kind==='holes_lost'));
});
test('a reviewed revocation explains only its listed kinds; a missing export field is never revocable',()=>{
 const next={courses:live.courses.map(c=>c.slug==='augusta'?{...c,status:'held',holes_mapped:0}:c.slug==='crooked'?{...c,status:'no-routing',decision:'no_canonical_coords',holes_mapped:0,osm_course:null}:c)};
 const rev=[{slug:'augusta',evidence_id:'aug-rev',allow:['status_downgrade','holes_lost']},{slug:'crooked',evidence_id:'bad',allow:['status_downgrade','holes_lost','coords_missing']}];
 const r=routingParity(live,next,rev);
 assert.deepEqual(r.explained.filter(x=>x.slug==='augusta').map(x=>x.kind).sort(),['holes_lost','status_downgrade']);
 assert.deepEqual(r.regressions.map(x=>x.slug+':'+x.kind),['crooked:coords_missing']);
});
test('identity change on a mapped course (same status, different OSM element) is a regression',()=>{
 const next={courses:live.courses.map(c=>c.slug==='aronimink'?{...c,osm_course:'way/999'}:c)};
 assert.deepEqual(routingParity(live,next).regressions.map(x=>x.kind),['osm_element_changed']);
});
test('partial loses a hole (stale OSM edit / new withhold) -> regression; removed row -> regression; gains are improvements',()=>{
 const next={courses:[...live.courses.filter(c=>c.slug!=='nowhere').map(c=>c.slug==='augusta'?{...c,holes_mapped:16}:c.slug==='broadmoor'?{...c,status:'partial',decision:'exact',holes_mapped:12}:c),row('yokohama','partial',17)]};
 const r=routingParity(live,next);
 assert.deepEqual(r.regressions.map(x=>x.slug+':'+x.kind).sort(),['augusta:holes_lost','nowhere:row_removed']);
 assert.deepEqual(r.improvements.map(x=>x.slug),['broadmoor']);assert.deepEqual(r.added,[{slug:'yokohama',status:'partial'}]);
});
// publish orchestration with an in-memory R2
const sha=t=>crypto.createHash('sha256').update(t).digest('hex');
function fakeR2(text,{mutateAfterObjects=false,corruptIndexPut=false}={}){const st={index:text,objects:[],puts:[],backups:[]};
 return {st,io:{getLiveIndex:async()=>({text:st.index}),backup:async t=>{st.backups.push(t);return 'mem://backup';},
  putObject:async(k)=>{st.objects.push(k);if(mutateAfterObjects&&st.objects.length===1)st.index=st.index+' ';},
  putIndexText:async t=>{st.puts.push(t);st.index=corruptIndexPut&&st.puts.length===1?'{}':t;},sha}};}
const L=JSON.stringify(live),objs=[{key:'osm-routing/v1/courses/a.json',file:'a',contentType:'application/json'}];
test('publish: backup, objects first, index last; read-back verified',async()=>{
 const next=JSON.stringify({courses:[...live.courses,row('yokohama','partial',17)]});const {st,io}=fakeR2(L);
 const r=await publishRouting({io,localIndexText:next,objects:objs});assert.equal(r.published,true);
 assert.deepEqual(st.backups,[L]);assert.deepEqual(st.objects,['osm-routing/v1/courses/a.json']);assert.equal(st.index,next);
});
test('publish: regressions never touch R2',async()=>{
 const next=JSON.stringify({courses:live.courses.filter(c=>c.slug!=='aronimink')});const {st,io}=fakeR2(L);
 const r=await publishRouting({io,localIndexText:next,objects:objs});assert.equal(r.published,false);assert.equal(r.reason,'parity_regressions');
 assert.deepEqual([st.objects,st.puts,st.backups],[[],[],[]]);
});
test('publish: dry run writes nothing; unreadable live index refuses',async()=>{
 const {st,io}=fakeR2(L);const r=await publishRouting({io,localIndexText:L,objects:objs,dryRun:true});assert.equal(r.reason,'dry_run');assert.deepEqual([st.objects,st.puts],[[],[]]);
 await assert.rejects(publishRouting({io:{...io,getLiveIndex:async()=>null},localIndexText:L,objects:objs}),/live index unreadable/);
});
test('publish: concurrent change to the live index refuses the switch',async()=>{
 const {st,io}=fakeR2(L,{mutateAfterObjects:true});const r=await publishRouting({io,localIndexText:L,objects:objs});
 assert.equal(r.reason,'live_index_changed_during_publish');assert.deepEqual(st.puts,[]);
});
test('publish: read-back mismatch restores the previous index',async()=>{
 const {st,io}=fakeR2(L,{corruptIndexPut:true});const next=JSON.stringify({courses:[...live.courses,row('y','partial',3)]});
 const r=await publishRouting({io,localIndexText:next,objects:objs});assert.equal(r.reason,'index_readback_mismatch_restored');assert.equal(st.index,L);
});
