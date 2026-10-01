import {golfAccess} from '../../shared/access.js';
import {store,SPORTS_REF} from '../../shared/store.js';
import {adminAllowed} from '../../shared/admin.js';
import {graph,envelope,findEntity} from './graph.js';
const json=(body,status=200,cache='no-store')=>Response.json(body,{status,headers:{'cache-control':cache,'x-content-type-options':'nosniff'}});
const publicCollections=new Set(['today','live','tournaments','players','courses','rankings','news']);
const premium=new Set(['player-dna','course-dna','course-fit','pbecast','history','matchups']);
export default {
 async fetch(request,env={}){
  const url=new URL(request.url);
  if(url.pathname==='/admin/bootstrap'||url.pathname==='/admin/news-shadow'){
   if(request.method!=='POST')return json({error:'method_not_allowed'},405);
   if(!await adminAllowed(request,env))return json({error:'unauthorized'},401);
   const service=url.pathname==='/admin/bootstrap'?env.INGEST:env.NEWS;
   if(!service?.fetch)return json({error:'service_unavailable'},503);
   return service.fetch(new Request('https://golf-internal'+url.pathname,{method:'POST',headers:{authorization:request.headers.get('authorization')}}));
  }
  if(request.method!=='GET')return json({error:'method_not_allowed'},405);
  if(url.pathname==='/v1/membership'){const access=await golfAccess(request,env);return json({membership:access.membership,verification:access.reason});}
  const module=url.pathname.split('/')[3];
  if(url.pathname.startsWith('/v1/intelligence/')){
   if(!premium.has(module))return json({error:'not_found'},404);
   const access=await golfAccess(request,env);
   if(!access.granted)return json({error:'all_access_required',membership:access.membership},403);
   return json({data:null,availability:'unavailable',reason:'comparable_performance_sample_unavailable',source:null,as_of:null,coverage:{performance_statistics:false},method:'golf-descriptive/1.0.0',version:'golf-intelligence/1.0.0',membership:access.membership});
  }
  const [collection,id,sub,round]=url.pathname.replace(/^\/v1\//,'').split('/');
  if(url.pathname!=='/health'&&!publicCollections.has(collection)&&!['player','course','tournament','source-health','graph'].includes(collection))return json({error:'not_found'},404);
  const db=store(env);if(!db)return json(envelope(null,[],{reason:'canonical_data_not_connected'}),url.pathname==='/health'?503:200);
  try{
   const g=await graph(db);
   if(url.pathname==='/health')return json({ok:true,mode:'production_metadata',graph_connected:true,project:SPORTS_REF,counts:{players:g.players.length,tournaments:g.tournaments.length,courses:g.courses.length,results:g.results.length},as_of:g.as_of,source_age_seconds:g.source_age_seconds,scoring_connected:false});
   if(collection==='source-health')return json(envelope(g,g.source_state));
   if(collection==='graph')return json(envelope(g,g),200,'public, max-age=60');
   if(collection==='live')return json(envelope(g,[],{availability:'unavailable',reason:'approved_live_scoring_feed_not_established'}));
   if(collection==='rankings'||collection==='news')return json(envelope(g,[],{availability:'unavailable',reason:collection==='news'?'newsroom_shadow_mode_no_published_stories':'licensed_ranking_snapshots_unavailable'}));
   if(collection==='today')return json(envelope(g,{current:[],upcoming:[],recent:g.tournaments.slice(0,8),results:g.results},{availability:'partial',reason:'current_schedule_and_scoring_unavailable; selected_major_history_available'}));
   if(['players','courses','tournaments'].includes(collection))return json(envelope(g,g[collection]),200,'public, max-age=60');
   const rows=collection==='player'?g.players:collection==='course'?g.courses:g.tournaments,entity=findEntity(rows,id);
   if(!entity)return json(envelope(g,null,{availability:'unavailable',error:'not_found'}),404);
   const history=g.results.filter(r=>collection==='player'?r.player?.id===entity.id:collection==='course'?r.tournament?.course?.id===entity.id:r.edition_id===entity.id);
   if(sub&& !['history','leaderboard','field','round'].includes(sub))return json({error:'not_found'},404);
   if(['leaderboard','field','round'].includes(sub))return json(envelope(g,[],{availability:'unavailable',reason:'winner_only_history_does_not_support_'+sub,round:round||null}));
   if(sub==='history')return json(envelope(g,history));
   return json(envelope(g,{...entity,history,results:collection==='tournament'?history:undefined,related_tournaments:collection==='course'?g.tournaments.filter(t=>t.course?.id===entity.id):undefined,unsupported:['round_scores','scorecards','tee_times','purse','defending_champion','player_statistics']}),200,'public, max-age=60');
  }catch(error){console.error(JSON.stringify({worker:'golf-api',error:error.message}));return json(envelope(null,null,{reason:'canonical_graph_unavailable'}),503);}
 }
};

