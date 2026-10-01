// Immutable capture before parse: every source response is archived to R2 by content hash and
// registered in golf_source_captures before any parser sees it.
import {safeFetch,digest} from '../../shared/http.js';
import {stableId} from '../../shared/store.js';
export const UA='PropBetEdgeGolfIngest/0.2 (+https://golf.propbetedge.ai; data@propbetedge.ai)';
export const HOSTS={wikidata:['www.wikidata.org','query.wikidata.org'],wikipedia:['en.wikipedia.org'],commons:['commons.wikimedia.org','upload.wikimedia.org','thumb.wikimedia.org']};
export const RIGHTS={wikidata:'CC0-1.0/golf-3',wikipedia:'CC-BY-SA-4.0/golf-1',commons:'per-asset-commons/golf-1'};
const lastRequest=new Map();
// Per-host spacing inside one leased run. The durable source lease prevents concurrent runs.
export async function spaced(host,minimumMs=1100){const last=lastRequest.get(host)||0,wait=last+minimumMs-Date.now();if(wait>0)await new Promise(r=>setTimeout(r,wait));lastRequest.set(host,Date.now());}
export async function capture(env,db,source,url,{parser,maxBytes=6000000,contentType='application/json',accept,binary=false,sourceUrl=null}={}){
 const host=new URL(url).hostname;await spaced(host,host==='query.wikidata.org'?2000:1100);
 const r=await safeFetch(url,{allowedHosts:HOSTS[source],maxBytes,fetcher:(u,o)=>fetch(u,{...o,headers:{...o.headers,'user-agent':UA,...(accept?{accept}:{})}}),binary});
 const hash=await digest(r.bytes),key=`golf/raw/${source}/sha256/${hash}`;
 if(!env.RAW)throw Error('immutable_archive_required');
 await env.RAW.put(key,r.bytes,{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:r.contentType||contentType}});
 const captured_at=new Date().toISOString(),id=await stableId('capture:'+source+':'+hash+':'+captured_at);
 await db('golf_source_captures','',{method:'POST',headers:{prefer:'return=minimal'},body:JSON.stringify({id,source_id:source,source_url:(sourceUrl||url).slice(0,2000),captured_at,http_status:200,sha256:hash,archive_key:key,parser_version:parser,rights_version:RIGHTS[source]})});
 await db('golf_source_state','source_id=eq.'+source,{method:'PATCH',headers:{prefer:'return=minimal'},body:JSON.stringify({last_capture:captured_at})});
 return {id,hash,key,captured_at,bytes:r.bytes,text:binary?null:r.text,contentType:r.contentType};
}
export async function sparql(env,db,query,parser){
 const url='https://query.wikidata.org/sparql?format=json&query='+encodeURIComponent(query);
 // The query text is archived by hash so the capture row stays short and the request is reproducible.
 const qbytes=new TextEncoder().encode(query),qhash=await digest(qbytes);
 await env.RAW.put(`golf/raw/wikidata/queries/${qhash}.rq`,qbytes,{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/sparql-query'}});
 const c=await capture(env,db,'wikidata',url,{parser,accept:'application/sparql-results+json',maxBytes:12000000,sourceUrl:'https://query.wikidata.org/sparql#query-sha256='+qhash});
 const body=JSON.parse(c.text);if(!body?.results?.bindings)throw Error('invalid_sparql_response');
 return {capture:c,rows:body.results.bindings.map(b=>Object.fromEntries(Object.entries(b).map(([k,v])=>[k.replace(/_$/,''),v.value])))};
}
export const qid=v=>typeof v==='string'?v.match(/(Q\d+)$/)?.[1]||null:null;
