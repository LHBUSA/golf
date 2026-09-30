export default {
 async fetch(request){return Response.json({mode:'foundation',publication_enabled:false,reason:'canonical_evidence_and_editorial_approval_required'},{status:new URL(request.url).pathname==='/health'?200:404,headers:{'cache-control':'no-store'}});},
 async scheduled(){console.log(JSON.stringify({worker:'golf-news',status:'held',reason:'Publication disabled; no canonical evidence packets'}));}
};

