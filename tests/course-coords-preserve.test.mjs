import test from 'node:test';import assert from 'node:assert/strict';
import {planCatalog,knownCoords} from '../workers/golf-ingest/src/plan.js';
// golf#14: a catalog run whose Wikidata venue has no P625 must not send latitude/longitude at all (the write RPC
// updates only the keys it is given), so coordinates sourced by another approved lane survive.
const venue=(qid,lat,lon)=>({qid,name:'Alpha Golf Club',golf_venue:true,country_code:'US',locality:'Pennsylvania',latitude:lat,longitude:lon,capture_id:'00000000-0000-5000-8000-000000000001'});
const course=p=>p.rows.find(r=>r.table==='golf_courses').row;
test('catalog course row omits coordinates the source does not have',async()=>{
 const p=await planCatalog({series:[],editions:[],players:[],venues:[venue('Q1',null,null)],existing:{}});
 const r=course(p);assert.equal('latitude' in r,false);assert.equal('longitude' in r,false);assert.equal(r.name,'Alpha Golf Club');
});
test('catalog course row carries coordinates when the source has them',async()=>{
 const p=await planCatalog({series:[],editions:[],players:[],venues:[venue('Q2',40.01,-75.4)],existing:{}});
 assert.deepEqual([course(p).latitude,course(p).longitude],[40.01,-75.4]);
});
test('knownCoords: half or non-numeric coordinates are treated as unknown',()=>{
 assert.deepEqual(knownCoords({latitude:1,longitude:null}),{});assert.deepEqual(knownCoords({latitude:NaN,longitude:2}),{});assert.deepEqual(knownCoords(null),{});
 assert.deepEqual(knownCoords({latitude:0,longitude:0}),{latitude:0,longitude:0});
});
// golf#14 review: no ingest writer may send an explicit null coordinate for golf_courses (an upsert onto an existing
// row would erase coordinates another lane sourced). Inserts default to null without the keys.
test('no golf-ingest writer upserts golf_courses with literal null coordinates',async()=>{
 const fs=await import('node:fs');const dir=new URL('../workers/golf-ingest/src/',import.meta.url);
 for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.js'))){const src=fs.readFileSync(new URL(f,dir),'utf8');
  for(const m of src.matchAll(/add\('golf_courses'[^\n]*/g))assert.doesNotMatch(m[0],/latitude:\s*null|longitude:\s*null/,f);}
});
