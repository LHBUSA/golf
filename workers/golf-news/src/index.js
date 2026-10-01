import {store,stableId} from '../../shared/store.js';import {adminAllowed} from '../../shared/admin.js';import {graph} from '../../golf-api/src/graph.js';import {freezePacket,validateDraft} from './pipeline.js';
const json=(b,s=200)=>Response.json(b,{status:s,headers:{'cache-control':'no-store'}});
export default {
 async fetch(request,env={}){
  const path=new URL(request.url).pathname;
  if(path==='/health')return json({mode:'shadow',publication_enabled:false,automatic_publication:false});
  if(path!=='/admin/news-shadow'||request.method!=='POST')return json({error:'not_found'},404);
  if(!await adminAllowed(request,env))return json({error:'unauthorized'},401);
  const db=store(env);if(!db)return json({error:'canonical_graph_unavailable'},503);
  const g=await graph(db);let created=0,duplicates=0;
  for(const r of g.results.slice(0,20)){
   const event_key='major-history:'+r.edition_id+':'+r.capture_id;
   const previous=await db('golf_news_packets','event_key=eq.'+encodeURIComponent(event_key)+'&select=id');if(previous.length){duplicates++;continue;}
   const packet=await freezePacket({event_key,capture_ids:[r.capture_id,r.player.capture_id],materiality:'historical_context',facts:[{id:'edition',capture_id:r.capture_id,value:r.tournament.edition_key},{id:'championship',capture_id:r.capture_id,value:r.tournament.championship},{id:'winner',capture_id:r.capture_id,value:r.player.full_name}]});
   const draft={title:r.tournament.championship+' champion in the captured record',paragraphs:packet.facts.map(f=>({kind:'fact',fact_id:f.id}))};
   const verdict=validateDraft(packet,draft),id=await stableId('packet:'+packet.hash);
   const prior=await db('golf_news_packets','event_key=like.'+encodeURIComponent('major-history:'+r.edition_id+':*')+'&select=id&limit=20');
   const inserted=await db('golf_news_packets','on_conflict=event_key',{method:'POST',headers:{prefer:'resolution=ignore-duplicates,return=representation'},body:JSON.stringify({id,event_key,sha256:packet.hash,packet_version:packet.version,materiality:packet.materiality,facts:packet.facts,evidence:{capture_ids:packet.capture_ids,source:g.source,as_of:g.as_of,coverage:r.coverage,supersedes_packets:prior.map(p=>p.id),entity_links:{player:'/player/'+r.player.slug,tournament:'/tournament/'+r.tournament.slug,course:r.tournament.course?'/course/'+r.tournament.course.slug:null},reference_status:'source-reported historical assertion; not independently reverified'}})});
   if(!inserted?.length){duplicates++;continue;}
   for(const capture_id of [...new Set(packet.capture_ids)])await db('golf_news_packet_captures','',{method:'POST',body:JSON.stringify({packet_id:id,capture_id})});
   await db('golf_articles','',{method:'POST',body:JSON.stringify({id:await stableId('article:'+packet.hash),packet_id:id,slug:'major-history-'+id,headline:draft.title,body:draft.paragraphs,status:'held',hold_reasons:[...verdict.reasons,'shadow_mode','editorial_review_required','historical_metadata_not_current_news'],dedupe_key:event_key,numeric_claims:[{fact_id:'edition',value:r.tournament.edition_key,capture_id:r.capture_id}],editorial_version:'deterministic-history/1',quality_version:'golf-shadow/1',media_id:null})});created++;
  }
  return json({mode:'shadow',created,duplicates,publication_enabled:false,as_of:g.as_of});
 },
 async scheduled(){console.log(JSON.stringify({worker:'golf-news',status:'shadow_manual_only',publication_enabled:false}));}
};

