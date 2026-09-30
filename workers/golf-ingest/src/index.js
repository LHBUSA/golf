export default {
 async fetch(request){return Response.json({mode:'foundation',ingestion_enabled:false,reason:'approved_scoring_source_required'},{status:new URL(request.url).pathname==='/health'?200:404,headers:{'cache-control':'no-store'}});},
 async scheduled(){console.log(JSON.stringify({worker:'golf-ingest',status:'disabled',reason:'No production graph or approved scoring source'}));}
};

