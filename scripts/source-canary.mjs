import fs from 'node:fs/promises'; import {safeFetch,digest,SourceBlockedError} from '../workers/shared/http.js';
const registry=JSON.parse(await fs.readFile('data/source-registry/sources.json','utf8'));
const requests=[['wikidata','https://www.wikidata.org/wiki/Special:EntityData/Q1.json'],['commons','https://commons.wikimedia.org/w/api.php?action=query&format=json&meta=siteinfo&siprop=general']];
const evidence={at:new Date().toISOString(),mode:'metadata_only',requests:[]};
for(const [id,url] of requests){
 const source=registry.sources.find(s=>s.id===id);
 if(source.verdict!=='APPROVED'||source.automated_access!=='approved_metadata_canary_only')throw new Error('source_not_approved');
 try{const r=await safeFetch(url,{allowedHosts:[new URL(source.url_family).hostname]});JSON.parse(r.text);evidence.requests.push({id,url,status:r.status,bytes:r.bytes.length,sha256:await digest(r.bytes),result:'reachable_metadata',data_ingested:false});}
 catch(error){evidence.requests.push({id,url,result:error instanceof SourceBlockedError?'stopped_access_barrier':'failed',reason:error.message,data_ingested:false});}
}
await fs.mkdir('docs/evidence',{recursive:true});await fs.writeFile('docs/evidence/source-canary.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));

