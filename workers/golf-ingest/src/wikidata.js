import seeds from '../../../data/bootstrap.json' with {type:'json'};
import {safeFetch,digest} from '../../shared/http.js';
import {stableId} from '../../shared/store.js';
export const PARSER='wikidata-golf/1.1.0';
export const claims=(e,p)=>(e?.claims?.[p]||[]).filter(x=>x.rank!=='deprecated'&&x.mainsnak?.snaktype==='value');
export function single(e,p){const a=claims(e,p);return a.length===1?a[0].mainsnak.datavalue?.value:null;}
export const item=(e,p)=>single(e,p)?.id||null;
export const label=e=>e?.labels?.en?.value||e?.labels?.['en-gb']?.value||null;
export function day(value){return value?.precision===11&&/^\+\d{4}-\d{2}-\d{2}T/.test(value.time)?value.time.slice(1,11):null;}
export const slug=(name,id)=>name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+'-'+id.toLowerCase();
export async function captureEntities(ids,env,db,labelsOnly=false){
 if(ids.length>40||ids.some(x=>!/^Q\d+$/.test(x)))throw Error('entity_bound');
 const url='https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=info%7Clabels%7Cdescriptions'+(labelsOnly?'':'%7Cclaims')+'&languages=en%7Cen-gb&languagefallback=1&ids='+ids.join('%7C');
 const r=await safeFetch(url,{allowedHosts:['www.wikidata.org'],maxBytes:3000000});
 const hash=await digest(r.bytes),key='golf/raw/wikidata/sha256/'+hash;
 if(!env.RAW)throw Error('immutable_archive_required');
 await env.RAW.put(key,r.bytes,{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/json'}});
 const captured_at=new Date().toISOString(),id=await stableId('capture:'+hash+':'+captured_at);
 const existing=await db('golf_source_captures','id=eq.'+id+'&select=id');
 if(!existing.length)await db('golf_source_captures','',{method:'POST',body:JSON.stringify({id,source_id:'wikidata',source_url:url,captured_at,http_status:200,sha256:hash,archive_key:key,parser_version:PARSER,rights_version:'CC0-1.0/golf-2'})});
 await db('golf_source_state','source_id=eq.wikidata',{method:'PATCH',body:JSON.stringify({last_capture:captured_at})});
 const body=JSON.parse(r.text);if(!body.entities)throw Error('invalid_entities');
 return Object.fromEntries(Object.entries(body.entities).map(([q,e])=>[q,{...e,capture_id:id}]));
}
export async function planGraph(entities,now=new Date()){
 const rows=[],held=[];
 const add=async(table,key,e,fields)=>{const id=await stableId(table+':'+key);rows.push({table,row:{id,capture_id:e.capture_id,...fields}});return id;};
 const ids={},kinds=new Map(seeds.entities.map(x=>[x.qid,x]));
 for(const s of seeds.entities.filter(x=>x.kind==='edition')){
  const e=entities[s.qid];if(!e)continue;
  const winner=item(e,'P1346'),course=item(e,'P276'),series=item(e,'P31');
  if(winner&&!kinds.has(winner))kinds.set(winner,{qid:winner,kind:'player'});
  if(course&&!kinds.has(course))kinds.set(course,{qid:course,kind:'course'});
  if(series&&!kinds.has(series))kinds.set(series,{qid:series,kind:'tournament',major:s.major});
 }
 for(const s of kinds.values()){
  const e=entities[s.qid],name=label(e);if(!e||e.missing||!name){held.push({qid:s.qid,reason:'missing_identity_label'});continue;}
  if(s.kind==='player'){
   const human=item(e,'P31')==='Q5',golf=claims(e,'P641').some(x=>x.mainsnak.datavalue?.value?.id==='Q5377');
   if(!human||!golf||!day(single(e,'P569'))){held.push({qid:s.qid,reason:'identity_requires_human_golf_birth_date',capture_id:e.capture_id});continue;}
   ids[s.qid]=await add('golf_players',s.qid,e,{full_name:name,slug:slug(name,s.qid),birth_date:day(single(e,'P569')),nationality_code:single(entities[item(e,'P27')],'P297')||null,identity_status:'verified'});
   await add('golf_player_identities',s.qid,e,{player_id:ids[s.qid],source_id:'wikidata',provider_id:s.qid,evidence:{basis:'single Wikidata human entity + golf sport + day-precision DOB; no cross-source name merge',entity_revision:e.lastrevid,country_name:label(entities[item(e,'P27')]),claims:e.claims,reference_status:'source_assertions; references retained, not independently reverified'},verified_at:'2026-10-01T00:00:00Z'});
  }else if(s.kind==='course'){
   if(!claims(e,'P641').some(x=>x.mainsnak.datavalue?.value?.id==='Q5377')&&!/golf (course|club)/i.test(e.descriptions?.en?.value||'')){held.push({qid:s.qid,reason:'venue_not_verified_as_course'});continue;}
   ids[s.qid]=await add('golf_courses',s.qid,e,{name,slug:slug(name,s.qid),country_code:single(entities[item(e,'P17')],'P297')||null,locality:label(entities[item(e,'P131')])||null});
   ids[s.qid+':layout']=await add('golf_course_layouts',s.qid+':metadata',e,{course_id:ids[s.qid],version_label:'Venue metadata only; tournament routing unavailable',par:null,yardage:null,routing_basis:null,specifications:{coverage:'venue identity only',wikidata_id:s.qid}});
  }else if(s.kind==='tour')ids[s.qid]=await add('golf_tours',s.qid,e,{name,slug:s.slug,division:s.division,organizer:null});
  else if(s.kind==='tournament')ids[s.qid]=await add('golf_tournaments',s.qid,e,{name,slug:slug(name,s.qid),major_division:s.major,organizer:label(entities[item(e,'P664')])||'Not supplied by source'});
 }
 for(const s of seeds.entities.filter(x=>x.kind==='edition')){
  const e=entities[s.qid];if(!e||!label(e))continue;
  const series=item(e,'P31'),winner=item(e,'P1346'),course=item(e,'P276');if(!ids[series]){held.push({qid:s.qid,reason:'unresolved_tournament'});continue;}
  const start=day(single(e,'P580')),end=day(single(e,'P582')),point=single(e,'P585');
  const year=start?.slice(0,4)||point?.time?.slice(1,5)||label(e).match(/^\d{4}/)?.[0];if(!year){held.push({qid:s.qid,reason:'missing_edition_year'});continue;}
  const completed=Boolean(winner&&ids[winner]&&Number(year)<=now.getUTCFullYear());
  const eid=await add('golf_tournament_editions',s.qid,e,{tournament_id:ids[series],edition_key:year,starts_on:start,ends_on:end,status:completed?'completed':'unknown',format:'other',rules:{source_name:label(e),wikidata_id:s.qid,venue_wikidata_id:course,winner_wikidata_id:completed?winner:null,date_precision:point?.precision||null,source_date:point?.time||null,coverage:'selected edition metadata; winner-only where supplied; no full field, scores or live state',source_revision:e.lastrevid,claim_references:e.claims}});
  if(ids[course+':layout'])await add('golf_edition_courses',s.qid+':'+course,e,{edition_id:eid,layout_id:ids[course+':layout'],usage_role:'source-reported venue; layout unverified'});
  if(completed){const entry=await add('golf_entries',s.qid+':'+winner,e,{edition_id:eid,player_id:ids[winner],status:'finished'});await add('golf_results',s.qid+':winner',e,{edition_id:eid,entry_id:entry,position:1,tied:null,strokes:null,score_to_par:null,finish_status:'finished',winner:true,winning_margin:null});}
 }
 for(const h of held.filter(x=>x.capture_id))await add('golf_identity_queue',h.qid,entities[h.qid],{source_id:'wikidata',provider_id:h.qid,candidates:[],evidence:h,status:'pending'});
 return {rows,held};
}
export async function ingestWikidata(env,db){
 const first=await captureEntities(seeds.entities.map(x=>x.qid),env,db),related=new Set();
 for(const e of Object.values(first))for(const p of ['P1346','P276','P131','P664',...(seeds.entities.some(s=>s.qid===e.id&&s.kind==='edition')?['P31']:[])]){const q=item(e,p);if(q&&!first[q])related.add(q);}
 if(related.size)await new Promise(r=>setTimeout(r,1100));
 const second=related.size?await captureEntities([...related].slice(0,40),env,db):{};
 const all={...first,...second};
 const missing=new Set();for(const e of Object.values(all))for(const p of ['P131','P27','P17']){const q=item(e,p);if(q&&!all[q])missing.add(q);}
 if(missing.size){await new Promise(r=>setTimeout(r,1100));Object.assign(all,await captureEntities([...missing].slice(0,40),env,db,true));}
 // Freeze a complete dependency packet before normalization so each canonical row's
 // capture contains both the source assertion and the labels/codes it references.
 const manifest={source:'wikidata',parser:PARSER,capture_ids:[...new Set(Object.values(all).map(e=>e.capture_id))],entities:all};
 const bytes=new TextEncoder().encode(JSON.stringify(manifest)),hash=await digest(bytes),key='golf/raw/wikidata/sha256/'+hash;
 await env.RAW.put(key,bytes,{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/json'}});
 const bundleId=await stableId('bundle:'+hash),captured_at=new Date().toISOString();
 await db('golf_source_captures','',{method:'POST',body:JSON.stringify({id:bundleId,source_id:'wikidata',source_url:'https://www.wikidata.org/w/api.php?action=wbgetentities',captured_at,http_status:200,sha256:hash,archive_key:key,parser_version:PARSER,rights_version:'CC0-1.0/golf-2'})});
 for(const e of Object.values(all))e.capture_id=bundleId;
 const plan=await planGraph(all);
 const existingResults=await db('golf_results','winner=eq.true&limit=200');
 for(const seed of seeds.entities.filter(s=>s.kind==='edition'&&all[s.qid]&&!all[s.qid].missing)){
  const eid=await stableId('golf_tournament_editions:'+seed.qid);
  if(!plan.rows.some(x=>x.table==='golf_results'&&x.row.edition_id===eid))for(const old of existingResults.filter(r=>r.edition_id===eid))plan.rows.push({table:'golf_results',row:{...old,capture_id:bundleId,winner:null,position:null,tied:null,strokes:null,score_to_par:null,winning_margin:null,finish_status:'unknown'}});
 }
 await db('golf_source_state','source_id=eq.wikidata',{method:'PATCH',body:JSON.stringify({last_parse:new Date().toISOString()})});
 const counts=await db('rpc/golf_write_batch','',{method:'POST',body:JSON.stringify({p_rows:plan.rows})});
 const state={status:'ok',lease_until:null,parser_version:PARSER,last_write:new Date().toISOString(),records_processed:plan.rows.length,records_inserted:counts.inserted,records_updated:counts.updated,records_held:plan.held.length,identity_conflicts:plan.held.filter(x=>x.reason.startsWith('identity')).length,last_error:null};
 await db('golf_source_state','source_id=eq.wikidata',{method:'PATCH',body:JSON.stringify(state)});return {...state,unchanged:counts.unchanged,held:plan.held};
}
