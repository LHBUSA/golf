import {golfAccess} from '../../shared/access.js';
const json=(body,status=200,cache='no-store')=>Response.json(body,{status,headers:{'cache-control':cache,'x-content-type-options':'nosniff'}});
const publicCollections=new Set(['today','live','tournaments','players','courses','rankings','news']);
const premium=new Set(['player-dna','course-dna','course-fit','pbecast','history','matchups']);
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(request.method!=='GET')return json({error:'method_not_allowed'},405);
  if(url.pathname==='/health')return json({ok:true,mode:'foundation',graph_connected:false});
  if(url.pathname==='/v1/membership'){const access=await golfAccess(request,env);return json({membership:access.membership,verification:access.reason});}
  const module=url.pathname.split('/')[3];
  if(url.pathname.startsWith('/v1/intelligence/')){
   if(!premium.has(module))return json({error:'not_found'},404);
   const access=await golfAccess(request,env);
   if(!access.granted)return json({error:'all_access_required',membership:access.membership},403);
   return json({data:null,availability:'unavailable',reason:'canonical_data_not_connected',membership:access.membership});
  }
  const collection=url.pathname.match(/^\/v1\/([a-z-]+)$/)?.[1];
  if(publicCollections.has(collection))return json({data:[],availability:'unavailable',reason:'canonical_data_not_connected',source:null,as_of:null},200,'public, max-age=60');
  return json({error:'not_found'},404);
 }
};

