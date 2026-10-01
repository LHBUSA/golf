import {store} from '../../shared/store.js';
import {adminAllowed} from '../../shared/admin.js';
import {SourceBlockedError} from '../../shared/http.js';
import {ingestWikidata} from './wikidata.js';
const json=(b,s=200)=>Response.json(b,{status:s,headers:{'cache-control':'no-store'}});
export default {
 async fetch(request,env={}){
  const path=new URL(request.url).pathname,db=store(env);
  if(path==='/health')return json({mode:db?'production_metadata':'unconfigured',ingestion_enabled:Boolean(db&&env.RAW),publication_enabled:false,source:'wikidata',scoring_enabled:false});
  if(path!=='/admin/bootstrap'||request.method!=='POST')return json({error:'not_found'},404);
  if(!await adminAllowed(request,env))return json({error:'unauthorized'},401);
  if(!db||!env.RAW)return json({error:'infrastructure_unavailable'},503);
  const source=(await db('golf_sources','id=eq.wikidata'))[0];
  if(source?.verdict!=='APPROVED'||source.automated_access!==true)return json({error:'source_disabled'},409);
  if(!await db('rpc/golf_claim_source','',{method:'POST',body:JSON.stringify({p_source:'wikidata'})}))return json({error:'source_blocked_or_busy'},409);
  try{return json(await ingestWikidata(env,db));}
  catch(error){const state=(await db('golf_source_state','source_id=eq.wikidata'))[0];await db('golf_source_state','source_id=eq.wikidata',{method:'PATCH',body:JSON.stringify({status:error instanceof SourceBlockedError?'blocked':'error',lease_until:null,last_error:error.message,source_errors:(state?.source_errors||0)+1})});return json({error:'ingestion_failed',reason:error.message},502);}
 },
 async scheduled(){console.log(JSON.stringify({worker:'golf-ingest',status:'manual_only',reason:'No unattended metadata or scoring ingestion enabled'}));}
};

