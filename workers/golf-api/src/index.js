import {store} from '../../shared/store.js';
import {golfAccess} from '../../shared/access.js';
import {publicEvent,orderEvents,FRESH_SECONDS,STALE_SECONDS} from '../../shared/live.js';
import {renderNews,feed,newsSitemap,newsUrlset,newsIndex} from './news-ssr.js';
// The card renderer (wasm + fonts) loads only for /og requests.
const ogImage=(...a)=>import('./og.js').then(m=>m.ogImage(...a));
import {adminAllowed} from '../../shared/admin.js';
import {noTransform} from './transport.js';
import {courseMap,openData} from './course-map.js';
import {canonicalPair,searchIndex,matchupPublic,matchupPremium,publicPlayer,premiumPlayer,publicCourse,premiumCourse,publicEdition,premiumEdition,projectionPublic,publicDoc,PUBLIC_SOURCE,PUBLIC_ATTRIBUTION} from '../../shared/views.js';
export const CONTRACT='golf-public/2.0.0';
const headers=(cache)=>({'cache-control':cache,'x-content-type-options':'nosniff'});
const LIVE_CACHE='public, max-age=60, s-maxage=60';
const json=(body,status=200,cache='no-store')=>Response.json(body,{status,headers:headers(cache)});
const PUBLIC_CACHE='public, max-age=120, s-maxage=300';
let memo={at:0,index:null},vmemo={at:0,v:null},pubIx={ix:null,text:null};
const publicIndexText=ix=>{if(pubIx.ix!==ix)pubIx={ix,text:JSON.stringify(projectionPublic('index.json',ix))};return pubIx.text;};
async function videoIndex(env){if(vmemo.v&&Date.now()-vmemo.at<300000)return vmemo.v;const o=await env.PUBLIC.get('video/v1/index.json');const v=o?JSON.parse(await o.text()).videos||[]:[];vmemo={at:Date.now(),v};return v;}
async function doc(env,key){const o=await env.PUBLIC?.get('projection/v2/'+key);return o?JSON.parse(await o.text()):null;}
async function index(env){if(memo.index&&Date.now()-memo.at<120000)return memo.index;const i=await doc(env,'index.json');if(i)memo={at:Date.now(),index:i};return i;}
function envelope(ix,data,{availability='available',coverage=null,reason=null,source=null,provenance=null,method=null}={}){
 const age=ix?.as_of?Math.floor((Date.now()-Date.parse(ix.as_of))/1000):null;
 // Customer contract names PropSports (network source standard); licence-required credits travel in attribution.
 return {data:publicDoc(data),availability,reason,source:source||PUBLIC_SOURCE,attribution:PUBLIC_ATTRIBUTION,as_of:ix?.as_of||null,source_age_seconds:age,stale:age===null||age>2*86400,coverage:publicDoc(coverage||ix?.coverage||null),provenance,method,contract_version:CONTRACT};
}
const unavailable=(ix,reason,extra={})=>envelope(ix,null,{availability:'unavailable',reason,...extra});
const ADMIN=new Set(['/admin/bootstrap','/admin/news-shadow','/admin/run','/admin/tick','/admin/media-derivative','/admin/news-publish','/admin/news-drafts','/admin/news-cost','/admin/news-compare']);
export default {
 // Every response leaves with no-transform: see transport.js (Vercel cache vs Accept-Encoding).
 async fetch(request,env={}){return noTransform(await route(request,env));}
};
async function route(request,env){
  const url=new URL(request.url),path=url.pathname;
  if(ADMIN.has(path)){
   if(request.method!=='POST')return json({error:'method_not_allowed'},405);
   if(!await adminAllowed(request,env))return json({error:'unauthorized'},401);
   const service=/news/.test(path)?env.NEWS:env.INGEST;if(!service?.fetch)return json({error:'service_unavailable'},503);
   const body=path==='/admin/media-derivative'?await request.arrayBuffer():null;
   return service.fetch(new Request('https://golf-internal'+path+url.search,{method:'POST',headers:{authorization:request.headers.get('authorization')},body}));
  }
  if(request.method!=='GET'&&request.method!=='HEAD')return json({error:'method_not_allowed'},405);
  if(path==='/v1/membership'){const access=await golfAccess(request,env);return json({membership:access.membership,verification:access.reason});}
  // Media derivatives: content-addressed, rights-reviewed images only.
  const m=path.match(/^\/v1\/media\/([0-9a-f]{64})\/(160|320|640|960)\.(avif|webp|jpg)$/);
  if(m){const o=await env.PUBLIC?.get(`media/${m[1]}/${m[2]}.${m[3]}`);if(!o)return json({error:'not_found'},404);return new Response(o.body,{headers:{'content-type':m[3]==='avif'?'image/avif':m[3]==='jpg'?'image/jpeg':'image/webp','cache-control':'public, max-age=31536000, immutable','x-content-type-options':'nosniff'}});}
  const parts=path.replace(/^\/v1\//,'').split('/').filter(Boolean);
  // Premium intelligence: authorization before any read.
  if(parts[0]==='intelligence'){
   if(!['player-dna','course-dna','course-fit','pbecast','history','matchups','field'].includes(parts[1]))return json({error:'not_found'},404);
   const access=await golfAccess(request,env);
   if(!access.granted)return json({error:'all_access_required',membership:access.membership},403);
   const ix=await index(env);if(!ix)return json(unavailable(null,'projection_unavailable'),503);
   let data=null;
   if(parts[1]==='player-dna'&&parts[2]){const d=await doc(env,'players/'+parts[2]+'.json');data=d&&premiumPlayer(d);}
   else if(parts[1]==='course-dna'&&parts[2]){const d=await doc(env,'courses/'+parts[2]+'.json');data=d&&premiumCourse(d);}
   else if(parts[1]==='course-fit'&&parts[2]&&parts[3]){const c=await doc(env,'courses/'+parts[2]+'.json');data=c?.player_history?.find(p=>p.slug===parts[3])?.fit||null;}
   else if((parts[1]==='field'||parts[1]==='pbecast')&&parts[2]){const d=await doc(env,'editions/'+parts[2]+'.json');data=d&&premiumEdition(d);}
   else if(parts[1]==='matchups'&&parts[2]&&parts[3]){const [a,b]=await Promise.all([doc(env,'players/'+parts[2]+'.json'),doc(env,'players/'+parts[3]+'.json')]);data=a&&b?matchupPremium(a,b):null;}
   else if(parts[1]==='history'&&parts[2]){const d=await doc(env,'players/'+parts[2]+'.json');data=d?{results:d.results,seasons:d.seasons}:null;}
   if(!data)return json({...unavailable(ix,'not_found_or_insufficient_sample'),membership:access.membership},404);
   return json({...envelope(ix,data,{method:ix.methods}),membership:access.membership});
  }
  const ix=await index(env);
  // Server-rendered newsroom and feeds (proxied by the frontend for /news, /feed.xml and news sitemaps).
  {const og=path.match(/^\/og\/([a-z]+)\/([a-z0-9-]+)\.png$/);if(og){try{return await ogImage(env,og[1],og[2]);}catch(e){console.error(JSON.stringify({worker:'golf-api',og_error:e.message}));return new Response('Card unavailable',{status:503,headers:{'retry-after':'60'}});}}}
  if(path==='/feed.xml')return feed(env);
  if(path==='/news-sitemap.xml')return newsSitemap(env);
  if(path==='/sitemaps/news.xml')return newsUrlset(env);
  if(path==='/render/news'||/^\/render\/news\/[a-z0-9-]+$/.test(path)){if(!ix)return new Response('Service unavailable',{status:503});try{return await renderNews(env,ix,path.replace(/^\/render/,''));}catch(e){console.error(JSON.stringify({worker:'golf-api',ssr_error:e.message}));return new Response('Service unavailable',{status:503,headers:{'retry-after':'60'}});}}
  if(path==='/health')return json({ok:Boolean(ix),mode:'production_projection',contract:CONTRACT,as_of:ix?.as_of||null,coverage:ix?.coverage||null,live_scoring:'observed'},ix?200:503);
  if(!ix)return json(unavailable(null,'projection_unavailable'),503);
  const [col,id,sub]=parts;
  const ok=(data,opts)=>json(envelope(ix,data,opts),200,PUBLIC_CACHE);
  try{
   switch(col){
    case 'projection':{
     const key=id&&['players','editions','courses'].includes(id)&&sub?`${id}/${sub}`:id;
     if(!key||!/^(manifest|index|bundle|schedule)\.json$|^(players|editions|courses)\/[a-z0-9-]+\.json$/.test(key))return json({error:'not_found'},404);
     const o=await env.PUBLIC.get('projection/v2/'+key);if(!o)return json({error:'not_found'},404);
     // Premium values are stripped server-side (views.projectionPublic), which also applies the customer source
     // boundary to every key. index.json is serialized once per memoized index.
     if(key==='index.json'){o.body?.cancel?.();return new Response(publicIndexText(ix),{headers:{...headers(PUBLIC_CACHE),'content-type':'application/json'}});}
     return new Response(JSON.stringify(projectionPublic(key,await o.json())),{headers:{...headers(PUBLIC_CACHE),'content-type':'application/json'}});
    }
    case 'graph':return ok({as_of:ix.as_of,coverage:publicDoc(ix.coverage),source_state:ix.source_state});
    case 'newsroom':{if(id!=='health')return json({error:'not_found'},404);const r=env.NEWS?.fetch?await env.NEWS.fetch('https://golf-internal/health').then(r=>r.json()).catch(()=>null):null;return json(r||{error:'unavailable'},r?200:503,'public, max-age=60');}
    case 'source-health':{const r=env.INGEST?.fetch?await env.INGEST.fetch('https://golf-internal/health').then(r=>r.json()).catch(()=>null):null;return json(envelope(ix,r||{source_state:ix.source_state},{availability:r?'available':'partial'}));}
    case 'today':return ok({current:ix.current,upcoming:ix.upcoming,recent:ix.recent},{availability:ix.current.length||ix.upcoming.length?'available':'partial',reason:'Schedule status from tour season schedules; observed scoring for current events is at /v1/live.'});
    case 'live':{
     // Observed scoring snapshots. State comes from the live contract: never from dates alone.
     const cur=await env.PUBLIC.get('live/v1/current.json').then(o=>o?o.json():null).catch(()=>null);const now=Date.now();
     if(id){const snap=await env.PUBLIC.get('live/v1/events/'+id+'.json').then(o=>o?o.json():null).catch(()=>null);
      if(sub==='movement'){
       // Durable history first (golf_live_snapshots); the R2 change log is the fallback and the archive of record.
       const db=store(env);let points=null,history='r2';
       if(db&&snap?.edition?.id){try{const hs=await db('golf_live_snapshots',`select=id,captured_at,round,status&edition_id=eq.${snap.edition.id}&order=captured_at.asc&limit=600`);
        if(hs?.length){const names=new Map(snap.players.map(p=>[p.espn_id,p]));const rows=[];for(let i=0;i<hs.length;i+=40){const pg=await db('golf_live_snapshot_rows',`select=snapshot_id,espn_id,position,tied,score_to_par,thru,status&snapshot_id=in.(${hs.slice(i,i+40).map(h=>h.id).join(',')})&status=eq.active&position=not.is.null&position=lte.40&limit=1000`);rows.push(...pg);}
         const by=new Map();for(const r of rows)(by.get(r.snapshot_id)||by.set(r.snapshot_id,[]).get(r.snapshot_id)).push(r);
         points=hs.map(h=>({t:h.captured_at.replace('+00:00','Z'),round:h.round,status:h.status,top:(by.get(h.id)||[]).sort((a,b)=>a.position-b.position).map(r=>({slug:names.get(r.espn_id)?.slug||null,name:names.get(r.espn_id)?.name||r.espn_id,pos:r.position,tied:r.tied,to_par:r.score_to_par,thru:r.thru}))}));history='db';}}catch(e){if(!/PGRST205|42P01/.test(e.message))console.error(JSON.stringify({worker:'golf-api',movement_db_error:e.message.slice(0,160)}));}}
       if(!points){const mv=await env.PUBLIC.get('live/v1/movement/'+id+'.json').then(o=>o?o.json():null).catch(()=>null);points=mv?.points||[];}
       return json({source:PUBLIC_SOURCE,history,edition:id,points},200,LIVE_CACHE);}
      if(!snap)return json({availability:'unavailable',edition:id,event:null},200,LIVE_CACHE);
      const ev=publicEvent(snap,now),me=snap.players.filter(p=>p.holes?.length).map(p=>({slug:p.slug,name:p.name,round:p.current_round,holes:p.holes}));
      // Weather join: the forecast hour covering now (NWS), with the forecast point's precision.
      let weather_now=null;try{const w=await env.PUBLIC.get('weather/v1/forecast/'+snap.edition.id+'.json').then(o=>o?o.json():null);if(w?.hours?.length){const h=w.hours.filter(x=>Date.parse(x.t)<=now).at(-1);if(h&&now-Date.parse(h.t)<2*3600000)weather_now={...h,precision:w.precision||'venue',locality:w.locality?.label||null,issued:w.forecast_update_time||w.fetched_at,age_seconds:Math.round((now-Date.parse(w.fetched_at))/1000),source:w.source};}}catch{}
      // Course context: sourced hole par/yardage from the edition layout (never inferred).
      let course_holes=null;try{const d=await doc(env,'editions/'+id+'.json');course_holes=d?.layout?.holes?.length?d.layout.holes.map(h=>({hole:h.hole,par:h.par??null,yards:h.yards??null})):null;}catch{}
      return json({availability:ev.state==='unavailable'?'unavailable':'available',source:PUBLIC_SOURCE,as_of:snap.fetched_at,freshness_seconds:ev.age_seconds,event:ev,hole_scores:me,weather_now,course_holes},200,LIVE_CACHE);}
     const who=url.searchParams.get('player');
     if(who){for(const s of cur?.events||[]){const p=s.players.find(x=>x.slug===who);if(p){const ev=publicEvent(s,now);return json({availability:'available',source:PUBLIC_SOURCE,event:{...ev,leaderboard:[]},player:ev.leaderboard.find(x=>x.slug===who)},200,LIVE_CACHE);}}return json({availability:'unavailable',player:null},200,LIVE_CACHE);}
     const events=orderEvents((cur?.events||[]).map(s=>publicEvent(s,now))).map(ev=>({...ev,leaderboard:ev.leaderboard.slice(0,Number(url.searchParams.get('top'))||10)}));
     const fresh=events.filter(e=>['live','suspended','round_complete'].includes(e.state));
     return json({availability:events.some(e=>e.state!=='unavailable')?'available':'unavailable',source:PUBLIC_SOURCE,as_of:cur?.as_of||null,freshness_seconds:fresh.length?Math.min(...fresh.map(e=>e.age_seconds)):null,contract:{fresh_seconds:FRESH_SECONDS,stale_seconds:STALE_SECONDS,live_requires:'verified in-progress status + posted scores + snapshot within fresh_seconds'},events},200,LIVE_CACHE);}
    case 'rankings':return json(unavailable(ix,'licensed_ranking_source_not_established',{coverage:{official_rankings:false,pbe_rating:'research only; not published'}}),200,PUBLIC_CACHE);
    case 'news':{
     if(id){const o=await env.PUBLIC.get('news/v2/articles/'+id+'.json');const a=o?JSON.parse(await o.text()):null;if(!a||a.status!=='published')return json({error:'not_found'},404);return ok(a);}
     const v2=await newsIndex(env);const o=await env.PUBLIC.get('news/v1/index.json');const v1=o?JSON.parse(await o.text()):[];
     return ok(v2.length?v2:v1,{availability:v2.length||v1.length?'available':'unavailable',reason:v2.length||v1.length?null:'no_story_has_passed_all_publication_gates'});}
    case 'videos':{
     // Same eligibility as the UI and VideoObject: published link status, confident resolution, not unembeddable.
     const vx=await videoIndex(env);const q=k=>url.searchParams.get(k);const lim=Math.min(24,Number(q('limit'))||8);
     let rows=vx.filter(v=>v.link_status==='published'&&v.embeddable!==false&&['high','medium'].includes(v.resolver?.confidence));
     if(q('edition'))rows=rows.filter(v=>v.entities.editions.includes(q('edition')));if(q('player'))rows=rows.filter(v=>v.entities.players.includes(q('player')));if(q('course'))rows=rows.filter(v=>v.entities.courses.includes(q('course')));if(q('type'))rows=rows.filter(v=>v.video_type===q('type'));
     const pub=rows.slice(0,lim).map(v=>({video_id:v.video_id,title:v.title,channel:v.channel,channel_id:v.channel_id,published_at:v.published_at,video_type:v.video_type,round:v.entities.round,editions:v.entities.editions,players:v.entities.players,courses:v.entities.courses,embeddable:v.embeddable,availability:v.embeddable===true?'embeddable':'unverified'}));
     return json({data:pub,availability:pub.length?'available':'unavailable',source:'YouTube official channels (keyless feeds)'},200,'public, max-age=300, s-maxage=600');}
    case 'search':return ok(searchIndex(ix,url.searchParams.get('q')||'',Number(url.searchParams.get('limit'))||12));
    case 'tournaments':{
     if(!id){let rows=ix.editions;const d=url.searchParams.get('division'),major=url.searchParams.get('major'),year=url.searchParams.get('year'),series=url.searchParams.get('series');if(d)rows=rows.filter(r=>r.division===d);if(major)rows=rows.filter(r=>r.is_major===(major==='true'));if(year)rows=rows.filter(r=>String(r.year)===year);if(series)rows=rows.filter(r=>r.series_key===series);return ok(rows,{coverage:{editions:rows.length,with_leaderboards:rows.filter(r=>!['winner_only','schedule_only'].includes(r.coverage)).length}});}
     const d=await doc(env,'editions/'+id+'.json');if(!d)return json(unavailable(ix,'not_found'),404);const e=publicEdition(d);
     const cov={coverage:e.coverage,rows_listed:e.results_source?.rows_listed??null,rows_stored:e.results_source?.rows_stored??null,field_complete:e.coverage==='full_field'},src={source:e.results_source?`Wikipedia (CC BY-SA 4.0): ${e.results_source.attribution}`:'Wikidata (CC0)',provenance:e.provenance};
     if(!sub)return ok(e,{...src,coverage:cov});
     if(sub==='leaderboard'||sub==='field'){if(!e.leaderboard.length||['winner_only','schedule_only'].includes(e.coverage))return json(unavailable(ix,e.coverage==='winner_only'?'winner_only_history':'leaderboard_not_published_in_source',{coverage:cov}),200,PUBLIC_CACHE);return ok(sub==='field'?e.leaderboard.map(r=>({player:r.player,status:r.status})):e.leaderboard,{...src,coverage:cov});}
     if(sub==='rounds'){const rows=['winner_only','schedule_only'].includes(e.coverage)?[]:e.leaderboard.filter(r=>r.rounds.length);if(!rows.length)return json(unavailable(ix,'round_scores_not_available',{coverage:cov}),200,PUBLIC_CACHE);return ok({rounds:rows.map(r=>({player:r.player,rounds:r.rounds,holes:r.holes})),timeline:e.timeline,par:e.par,layout:e.layout},{...src,coverage:cov});}
     if(sub==='history')return ok(e.past_editions,{coverage:{editions:e.past_editions.length}});
     return json({error:'not_found'},404);
    }
    case 'players':{
     if(!id){let rows=ix.players;const q=url.searchParams.get('division');if(q)rows=rows.filter(r=>r.division===q);const c=url.searchParams.get('country');if(c)rows=rows.filter(r=>r.country_code===c);return ok(rows,{coverage:{players:rows.length,note:'Observed in PropBetEdge coverage; not career totals.'}});}
     const d=await doc(env,'players/'+id+'.json');if(!d)return json(unavailable(ix,'not_found'),404);const p=publicPlayer(d);
     if(!sub)return ok(p,{provenance:d.provenance,method:ix.methods.dna});
     if(sub==='results')return ok(p.results,{coverage:{events_observed:p.summary.events_observed,note:'Observed in PropBetEdge coverage'}});
     if(sub==='history')return ok({seasons:p.seasons,course_history:p.course_history});
     if(sub==='majors')return ok({summary:{wins:p.summary.major_wins,appearances_observed:p.summary.major_appearances_observed,full_field_starts:p.summary.major_full_field_starts,top10:p.summary.major_top10,best_finish:p.summary.best_major_finish},results:p.results.filter(r=>r.edition.is_major)});
     return json({error:'not_found'},404);
    }
    case 'courses':{
     if(!id)return ok(ix.courses);
     if(sub==='map'){const r=await courseMap(env,ix,id,url.searchParams.get('edition'));return json(publicDoc(r.body),r.status,r.status===200?'public, max-age=300, s-maxage=1800':'no-store');}
     const d=await doc(env,'courses/'+id+'.json');if(!d)return json(unavailable(ix,'not_found'),404);const c=publicCourse(d);
     if(!sub)return ok(c,{provenance:d.provenance,method:ix.methods.course});
     if(sub==='history')return ok(c.editions);
     return json({error:'not_found'},404);
    }
    case 'open-data':{
     if(id!=='course-routing')return json({error:'not_found'},404);
     const r=await openData(env,parts.slice(2));
     if(r.text)return new Response(r.text,{status:200,headers:{...headers(r.cache),'content-type':'text/markdown; charset=utf-8'}});
     if(r.stream)return new Response(r.stream,{status:200,headers:{...headers(r.cache),'content-type':r.type,'access-control-allow-origin':'*'}});
     return json(r.body,r.status,r.status===200?r.cache:'no-store');
    }
    case 'matchups':{
     if(!id||!sub)return ok({featured:ix.featured_matchups||[]});
     const [a,b]=canonicalPair(id,sub);if(a===b)return json(unavailable(ix,'same_player'),400);
     const [da,dbb]=await Promise.all([doc(env,'players/'+a+'.json'),doc(env,'players/'+b+'.json')]);
     if(!da||!dbb)return json(unavailable(ix,'not_found'),404);
     return ok({canonical:`/matchups/${a}/${b}`,...matchupPublic(da,dbb)},{method:'golf-matchup-descriptive/1.0.0'});
    }
    default:return json({error:'not_found'},404);
   }
  }catch(error){console.error(JSON.stringify({worker:'golf-api',error:error.message}));return json(unavailable(ix,'projection_read_failed'),503);}
}
