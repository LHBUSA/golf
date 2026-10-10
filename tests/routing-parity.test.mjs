import test from 'node:test';import assert from 'node:assert/strict';import crypto from 'node:crypto';
import {routingParity,publishRouting,hadCoords,objectsToRemove} from '../workers/shared/routing-parity.js';
// golf#14 publish gate. Rows mirror osm-routing/v1/index.json course rows.
const row=(slug,status,holes,extra={})=>({slug,coords:true,status,decision:status==='held'?'review_weak_identity':status==='no-routing'?'no_osm_course':'exact',holes_mapped:holes,osm_course:holes?'way/'+slug.length:null,features:holes?{green:18,bunker:60}:null,...extra});
const live={courses:[row('aronimink','full',18),row('crooked','full',18),row('augusta','partial',17),row('broadmoor','held',0,{osm_course:'way/9'}),row('nowhere','no-routing',0)]};
const lost=c=>({...c,coords:false,status:'no-routing',decision:'no_canonical_coords',holes_mapped:0,osm_course:null,features:null});

test('complete export: identical index publishes',()=>{const r=routingParity(live,live);assert.equal(r.ok,true);assert.deepEqual(r.regressions,[]);});
test('dropped coordinates on mapped and held courses fail closed',()=>{
 const next={courses:live.courses.map(c=>['aronimink','crooked','broadmoor'].includes(c.slug)?lost(c):c)};
 const r=routingParity(live,next);assert.equal(r.ok,false);
 assert.deepEqual([...new Set(r.regressions.map(x=>x.slug))].sort(),['aronimink','broadmoor','crooked']);
 assert.ok(r.regressions.some(x=>x.slug==='broadmoor'&&x.kind==='coords_missing'));assert.ok(r.regressions.some(x=>x.slug==='aronimink'&&x.kind==='holes_lost'));
});
test('a course that never had coordinates is not a coords_missing false positive',()=>{
 const L={courses:[{slug:'cand',coords:false,status:'held',decision:'review_auto_identity_insufficient',holes_mapped:0,candidate:'way/1'}]};
 const N={courses:[{slug:'cand',coords:false,status:'no-routing',decision:'no_canonical_coords',holes_mapped:0,candidate:'way/1'}]};
 const r=routingParity(L,N,[{slug:'cand',evidence_id:'x',allow:['status_downgrade']}]);assert.equal(r.ok,true);assert.equal(r.regressions.length,0);
});
test('legacy live rows (no coords field): inferred only from coordinate-path decisions',()=>{
 assert.equal(hadCoords({decision:'exact'}),true);assert.equal(hadCoords({decision:'review_weak_identity'}),true);
 assert.equal(hadCoords({decision:'exact',cleared_by:'yokohama-2026-10-10'}),false);assert.equal(hadCoords({decision:'review_auto_identity_insufficient'}),false);
 assert.equal(hadCoords({decision:'exact',coords:false}),false);
});
test('coordinate loss hidden behind a candidate/auto decision is still caught and never revocable',()=>{
 const next={courses:live.courses.map(c=>c.slug==='crooked'?{...c,coords:false,status:'held',decision:'review_auto_identity_insufficient',holes_mapped:0,osm_course:'way/2',candidate:'way/2',features:null}:c)};
 const r=routingParity(live,next,[{slug:'crooked',evidence_id:'bad',allow:['status_downgrade','holes_lost','coords_missing']}]);
 assert.deepEqual(r.regressions.map(x=>x.kind),['coords_missing']);
});
test('a reviewed revocation explains only its listed kinds',()=>{
 const next={courses:live.courses.map(c=>c.slug==='augusta'?{...c,status:'held',holes_mapped:0}:c)};
 const r=routingParity(live,next,[{slug:'augusta',evidence_id:'aug-rev',allow:['status_downgrade','holes_lost']}]);
 assert.equal(r.ok,true);assert.deepEqual(r.explained.map(x=>x.kind).sort(),['holes_lost','status_downgrade']);
});
test('same status, worse content: OSM element change, feature layer lost, review lost, older extract',()=>{
 const L={courses:[row('a','full',18),row('bb','full',18),row('ccc','reviewed',18,{human_review:{evidence_id:'h1'}}),row('dddd','full',18,{retrieved_at:'2026-10-03'})]};
 const N={courses:[{...L.courses[0],osm_course:'way/999'},{...L.courses[1],features:{green:18,bunker:0}},{...L.courses[2],status:'full',human_review:null},{...L.courses[3],retrieved_at:'2026-09-01'}]};
 assert.deepEqual(routingParity(L,N).regressions.map(x=>x.slug+':'+x.kind),['a:osm_element_changed','bb:features_lost','ccc:review_lost','dddd:older_extract']);
});
test('partial loses a hole -> regression; removed row -> regression; gains are improvements',()=>{
 const next={courses:[...live.courses.filter(c=>c.slug!=='nowhere').map(c=>c.slug==='augusta'?{...c,holes_mapped:16}:c.slug==='broadmoor'?{...c,status:'partial',decision:'exact',holes_mapped:12}:c),row('yokohama','partial',17)]};
 const r=routingParity(live,next);
 assert.deepEqual(r.regressions.map(x=>x.slug+':'+x.kind).sort(),['augusta:holes_lost','nowhere:row_removed']);
 assert.deepEqual(r.improvements.map(x=>x.slug),['broadmoor']);assert.deepEqual(r.added,[{slug:'yokohama',status:'partial'}]);
});
test('objectsToRemove: only courses that were mapped and no longer are',()=>{
 const next={courses:live.courses.map(c=>c.slug==='augusta'?{...c,status:'held',holes_mapped:0}:c)};
 assert.deepEqual(objectsToRemove(live,next),['osm-routing/v1/courses/augusta.json','osm-routing/v1/dataset/augusta.geojson']);
});

// ---- publish orchestration against an in-memory R2
const sha=t=>crypto.createHash('sha256').update(t).digest('hex');
function fakeR2(indexText,objects={},{mutateIndexOnPut=null,corruptIndexPut=false,failPutKey=null}={}){
 const st={store:{'osm-routing/v1/index.json':indexText,...objects},log:[],backups:{}};
 const io={getLiveIndex:async()=>({text:st.store['osm-routing/v1/index.json']}),getObject:async k=>k in st.store?{text:st.store[k]}:null,readFile:f=>f,
  backup:async(n,t)=>{st.backups[n]=t;return 'mem://'+n;},
  putObject:async(k,b)=>{if(k===failPutKey)throw Error('network');st.log.push('put '+k);st.store[k]=b.text;if(mutateIndexOnPut===k)st.store['osm-routing/v1/index.json']+=' ';},
  deleteObject:async k=>{st.log.push('delete '+k);delete st.store[k];},
  putIndexText:async t=>{st.log.push('put index');st.store['osm-routing/v1/index.json']=corruptIndexPut&&!st.corrupted?(st.corrupted=true,'{}'):t;},sha};
 return {st,io};
}
const L=JSON.stringify(live),K=s=>'osm-routing/v1/courses/'+s+'.json';
const obj=(slug,text)=>({key:K(slug),file:text,contentType:'application/json'});
test('publish: unchanged objects skipped, changed backed up, objects first, index last',async()=>{
 const next=JSON.stringify({courses:[...live.courses,row('yokohama','partial',17)]});
 const {st,io}=fakeR2(L,{[K('aronimink')]:'A1',[K('crooked')]:'C1'});
 const r=await publishRouting({io,localIndexText:next,objects:[obj('aronimink','A1'),obj('crooked','C2'),obj('yokohama','Y1')]});
 assert.equal(r.published,true);assert.deepEqual(r.changed,[K('crooked'),K('yokohama')]);
 assert.deepEqual(st.log,['put '+K('crooked'),'put '+K('yokohama'),'put index']);
 assert.equal(st.backups['objects/'+K('crooked')],'C1');assert.equal(st.backups['index.live-backup.json'],L);
});
test('publish: regressions never touch R2',async()=>{
 const {st,io}=fakeR2(L);const r=await publishRouting({io,localIndexText:JSON.stringify({courses:live.courses.filter(c=>c.slug!=='aronimink')}),objects:[obj('x','1')]});
 assert.equal(r.reason,'parity_regressions');assert.deepEqual(st.log,[]);assert.deepEqual(st.backups,{});
});
test('publish: dry run reports what would change and writes nothing; unreadable live index refuses',async()=>{
 const {st,io}=fakeR2(L,{[K('a')]:'1'});const r=await publishRouting({io,localIndexText:L,objects:[obj('a','1'),obj('b','2')],dryRun:true});
 assert.equal(r.reason,'dry_run');assert.deepEqual(r.changed,[K('b')]);assert.deepEqual(st.log,[]);
 await assert.rejects(publishRouting({io:{...io,getLiveIndex:async()=>null},localIndexText:L,objects:[]}),/live index unreadable/);
});
test('publish: concurrent change refuses the switch and restores every object it wrote',async()=>{
 const {st,io}=fakeR2(L,{[K('aronimink')]:'A1'},{mutateIndexOnPut:K('new')});
 const r=await publishRouting({io,localIndexText:L,objects:[obj('aronimink','A2'),obj('new','N1')]});
 assert.equal(r.reason,'live_index_changed_during_publish');assert.equal(st.store[K('aronimink')],'A1');assert.equal(K('new') in st.store,false);
});
test('publish: read-back mismatch restores the index and the objects',async()=>{
 const next=JSON.stringify({courses:[...live.courses,row('y','partial',3)]});const {st,io}=fakeR2(L,{[K('aronimink')]:'A1'},{corruptIndexPut:true});
 const r=await publishRouting({io,localIndexText:next,objects:[obj('aronimink','A2')]});
 assert.equal(r.reason,'index_readback_mismatch_restored');assert.equal(st.store['osm-routing/v1/index.json'],L);assert.equal(st.store[K('aronimink')],'A1');
});
test('publish: a failed upload part-way restores what was written',async()=>{
 const {st,io}=fakeR2(L,{[K('aronimink')]:'A1'},{failPutKey:K('crooked')});
 const r=await publishRouting({io,localIndexText:L,objects:[obj('aronimink','A2'),obj('crooked','C2')]});
 assert.equal(r.reason,'publish_error');assert.deepEqual(r.restore,['restored']);assert.equal(st.store[K('aronimink')],'A1');
});
test('publish: a reviewed revocation takes the course map down (objects removed after the switch, backed up)',async()=>{
 const next=JSON.stringify({courses:live.courses.map(c=>c.slug==='augusta'?{...c,status:'held',holes_mapped:0,features:null}:c)});
 const {st,io}=fakeR2(L,{[K('augusta')]:'G1','osm-routing/v1/dataset/augusta.geojson':'D1'});
 const r=await publishRouting({io,localIndexText:next,objects:[],revocations:[{slug:'augusta',evidence_id:'rev',allow:['status_downgrade','holes_lost','features_lost']}]});
 assert.equal(r.published,true);assert.equal(K('augusta') in st.store,false);assert.equal(st.backups['objects/'+K('augusta')],'G1');
 assert.deepEqual(st.log,['put index','delete '+K('augusta'),'delete osm-routing/v1/dataset/augusta.geojson']);
});
test('publish: an error before the switch never touches the live index; a failed revocation delete is reported',async()=>{
 const {st,io}=fakeR2(L,{[K('aronimink')]:'A1'},{failPutKey:K('crooked')});
 await publishRouting({io,localIndexText:L,objects:[obj('aronimink','A2'),obj('crooked','C2')]});assert.equal(st.log.includes('put index'),false);
 const next=JSON.stringify({courses:live.courses.map(c=>c.slug==='augusta'?{...c,status:'held',holes_mapped:0,features:null}:c)});
 const f=fakeR2(L,{[K('augusta')]:'G1'});f.io.deleteObject=async()=>{throw Error('denied');};
 const r=await publishRouting({io:f.io,localIndexText:next,objects:[],revocations:[{slug:'augusta',evidence_id:'rev',allow:['status_downgrade','holes_lost','features_lost']}]});
 assert.equal(r.published,true);assert.deepEqual(r.removeFailed.map(x=>x.key),[K('augusta')]);
});
