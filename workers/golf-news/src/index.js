// Golf Newsroom V4. Source change -> materiality -> entities -> frozen packet -> editor -> gates -> plans -> publish or hold.
// The packet owns truth. The model (when configured) writes tokenized prose only; the application renders values and links.
import {store,stableId} from '../../shared/store.js';
import {adminAllowed} from '../../shared/admin.js';
import {TYPES,THRESHOLD} from '../../shared/news/types.js';
import {changedFacts} from '../../shared/news/facts.js';
import {deskDraft,DESK_VERSION} from '../../shared/news/desk.js';
import {validateDraft,resolveHref,QUALITY_VERSION} from '../../shared/news/validate.js';
import {editorialPass,EDITOR_VERSION} from '../../shared/news/editor.js';
import {articleSlug,buildArticle,pickHero,summaryOf,pickVideo} from '../../shared/news/plan.js';
export {buildStory} from './legacy.js';
const json=(b,s=200)=>Response.json(b,{status:s,headers:{'cache-control':'no-store'}});
const DAY=86400000,days=(a,b)=>Math.round((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/DAY);
// Topics whose facts are expected to move (forecasts, fields): changes are updates, not corrections.
const UPDATE_TYPES=new Set(['preview','course_weather','major_history','course_intelligence','player_form']);
async function getJSON(bucket,key){const o=await bucket.get(key);return o?JSON.parse(await o.text()):null;}
const putJSON=(bucket,key,v)=>bucket.put(key,JSON.stringify(v),{httpMetadata:{contentType:'application/json'}});
export function makeCtx(env,ix,{today=new Date().toISOString().slice(0,10),editions=[]}={}){
 const memo=new Map(),get=k=>{if(!memo.has(k))memo.set(k,getJSON(env.PUBLIC,'projection/v2/'+k).catch(()=>null));return memo.get(k);};
 const ixPlayers=new Map((ix.players||[]).map(p=>[p.slug,p])),forced=new Set(editions);
 const window=ix.editions.filter(e=>forced.has(e.slug)||e.status!=='completed'&&e.starts_on&&days(today,e.starts_on)<=10&&days(e.ends_on||e.starts_on,today)<=1);
 const recent=ix.editions.filter(e=>forced.has(e.slug)||e.status==='completed'&&e.ends_on&&days(e.ends_on,today)>=0&&days(e.ends_on,today)<=14);
 const liveMemo=new Map(),live=s=>{if(!liveMemo.has(s))liveMemo.set(s,getJSON(env.PUBLIC,'live/v1/events/'+s+'.json').catch(()=>null));return liveMemo.get(s);};
 return {ix,today,as_of:ix.as_of,window,recent,forced,live,ed:s=>get('editions/'+s+'.json'),pl:s=>get('players/'+s+'.json'),co:s=>get('courses/'+s+'.json'),ixPlayer:s=>ixPlayers.get(s)};
}
// One run at a time (cron and admin share this lease).
async function lease(env,ms){
 const now=Date.now(),cur=await env.STATE.get('news:lease',{type:'json'});if(cur&&cur.until>now)return null;
 const token=crypto.randomUUID();await env.STATE.put('news:lease',JSON.stringify({token,until:now+ms}),{expirationTtl:Math.max(60,Math.ceil(ms/1000))});
 const check=await env.STATE.get('news:lease',{type:'json'});return check?.token===token?token:null;
}
export async function run(env,{mode='shadow',force=false,types=null,editions=[],limit=60,today}={}){
 if(!env.PUBLIC||!env.STATE||!env.PRIVATE)return {error:'unconfigured'};
 const token=await lease(env,9*60000);if(!token)return {status:'busy'};
 const started=new Date().toISOString(),db=store(env),PRIV=env.PRIVATE;
 const out={mode,started,candidates:0,built:0,below_threshold:0,unchanged:0,shadow:0,published:0,updated:0,held:0,skipped:{},editor:{openai:0,desk:0,errors:0,unavailable:null,usd:0},stories:[]};
 try{
  const ix=await getJSON(env.PUBLIC,'projection/v2/index.json');if(!ix)return {...out,error:'projection_unavailable'};
  const ctx=makeCtx(env,ix,{today:today||new Date().toISOString().slice(0,10),editions});
  const canary=new Set(String(env.NEWS_CANARY_TYPES||'').split(',').filter(Boolean));
  const cands=[];for(const [k,T] of Object.entries(TYPES)){if(T.verified_only||types&&!types.includes(k))continue;for(const c of T.detect(ctx))if(!editions.length||editions.includes(c.edition))cands.push(c);}
  out.candidates=cands.length;
  const index=await getJSON(env.PUBLIC,'news/v2/index.json')||[];let indexDirty=false;
  const videos=(await getJSON(env.PUBLIC,'video/v1/index.json').catch(()=>null))?.videos||[];
  for(const c of cands.slice(0,limit)){
   let P;try{P=await TYPES[c.type].build(ctx,c);}catch(e){out.skipped['build_error:'+c.type]=(out.skipped['build_error:'+c.type]||0)+1;console.error(JSON.stringify({worker:'golf-news',build_error:e.message,stack:String(e.stack).slice(0,300),c}));continue;}
   if(!P){out.skipped[c.type]=(out.skipped[c.type]||0)+1;continue;}
   const packet=await P.freeze();out.built++;
   if(packet.materiality.score<THRESHOLD){out.below_threshold++;out.stories.push({topic:packet.topic,status:'below_threshold',materiality:packet.materiality});continue;}
   const recKey='news:topic:'+packet.topic,rec=await env.STATE.get(recKey,{type:'json'});
   const wantsPublish=mode==='publish'||mode==='canary'&&canary.has(packet.type);
   if(rec&&rec.packet_sha===packet.hash&&!force&&(rec.state==='published'||!wantsPublish)){out.unchanged++;continue;}
   await putJSON(PRIV,'news/v2/packets/'+packet.hash+'.json',packet);
   // Draft: the topic's validated draft re-renders with new facts (tokens), else the editor (new topics only), else the desk.
   const desk=deskDraft(packet),deskV=validateDraft(packet,desk,{resolve:resolveHref});
   let chosen=null,editor={mode:'desk',version:DESK_VERSION},editorLog=null;
   const prevDraft=rec?.draft_key?await getJSON(PRIV,rec.draft_key):null;
   if(prevDraft){const v=validateDraft(packet,prevDraft.draft,{resolve:resolveHref});if(v.ok){chosen=prevDraft.draft;editor=prevDraft.editor;}}
   if(!chosen&&!rec&&mode!=='desk'){
    const ep=await editorialPass(env,packet,desk,{resolve:resolveHref});editorLog={status:ep.status,reason:ep.reason||null,attempts:ep.attempts||[],usd:ep.usd||0,model:ep.model||null,draft:ep.draft||null};
    if(ep.status==='unavailable')out.editor.unavailable=ep.reason;else if(ep.status==='error')out.editor.errors++;
    out.editor.usd+=ep.usd||0;
    if(ep.status==='validated'){chosen=ep.draft;editor={mode:'openai',model:ep.model,version:EDITOR_VERSION};out.editor.openai++;}
   }
   if(!chosen&&deskV.ok){chosen=desk;editor={mode:'desk',version:DESK_VERSION};out.editor.desk++;}
   let slug=rec?.slug||articleSlug(packet);
   if(!rec){const owner=await env.STATE.get('news:slug:'+slug);if(owner&&owner!==packet.topic)slug=slug+'-'+packet.hash.slice(0,6);}
   const hold=chosen?[]:deskV.reasons,publishable=Boolean(chosen)&&wantsPublish,now=new Date().toISOString();
   const prior=rec?.state==='published'?await getJSON(env.PUBLIC,'news/v2/articles/'+slug+'.json'):null;
   const article=chosen?buildArticle({packet,draft:chosen,editor,slug,ctx,hero:await pickHero(packet,ctx),video:pickVideo(packet,videos),prior,now,status:publishable?'published':'shadow'}):null;
   if(article&&prior&&prior.packet_sha256!==packet.hash){
    const prevPacket=await getJSON(PRIV,'news/v2/packets/'+prior.packet_sha256+'.json');const ch=changedFacts(prevPacket,packet);
    const kind=UPDATE_TYPES.has(packet.type)?'update':'correction';
    article.revisions.push({at:now,kind,packet_sha256:packet.hash,changed:ch});article.revisions=article.revisions.slice(-50);
    if(kind==='correction'&&ch.length){const pf=new Map((prevPacket?.facts||[]).map(f=>[f.id,f]));const facts=ch.filter(id=>pf.has(id)).map(id=>({fact:id,label:pf.get(id).label,was:pf.get(id).display,now:packet.facts.find(f=>f.id===id)?.display??null}));if(facts.length)article.corrections.push({at:now,facts});}
   }
   const draftKey='news/v2/drafts/'+packet.topic.replace(/[^a-z0-9:-]/gi,'_')+'.json';
   if(chosen)await putJSON(PRIV,draftKey,{draft:chosen,editor,packet_sha256:packet.hash});
   let state;
   if(publishable){
    await putJSON(env.PUBLIC,'news/v2/articles/'+slug+'.json',article);
    const i=index.findIndex(x=>x.slug===slug),sum=summaryOf(article);if(i>=0)index[i]=sum;else index.unshift(sum);indexDirty=true;
    state='published';if(prior)out.updated++;else out.published++;
    if(db){try{
     const packetId=await stableId('packet4:'+packet.topic);
     await db('golf_news_packets','on_conflict=event_key',{method:'POST',headers:{prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({id:packetId,event_key:packet.topic,sha256:packet.hash,packet_version:packet.version,materiality:packet.type,facts:packet.facts,evidence:{entities:packet.entities,charts:packet.charts,limits:packet.limits,context:packet.context}})});
     const pid=(await db('golf_news_packets','select=id&event_key=eq.'+encodeURIComponent(packet.topic)))[0]?.id||packetId;
     const existing=(await db('golf_articles','select=id&dedupe_key=eq.'+encodeURIComponent(packet.topic)))[0];
     await db('golf_articles','on_conflict=dedupe_key',{method:'POST',headers:{prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({id:existing?.id||await stableId('article4:'+packet.topic),packet_id:pid,slug,headline:article.headline_text,body:article,status:'published',hold_reasons:[],dedupe_key:packet.topic,numeric_claims:article.evidence.filter(f=>typeof packet.facts.find(x=>x.id===f.fact)?.value==='number'),editorial_version:editor.mode==='openai'?EDITOR_VERSION:DESK_VERSION,quality_version:QUALITY_VERSION,media_id:null,published_at:article.published_at})});
    }catch(e){out.db_error=String(e.message).slice(0,200);}}
   }else{
    state=chosen?'shadow_validated':'held';if(chosen)out.shadow++;else out.held++;
    await putJSON(PRIV,'news/v2/shadow/'+slug+'.json',{article,packet_sha256:packet.hash,topic:packet.topic,type:packet.type,hold_reasons:hold,desk_validation:deskV,editor:editorLog,materiality:packet.materiality,at:now});
   }
   const record={topic:packet.topic,type:packet.type,slug,state:rec?.state==='published'&&!publishable?'published':state,packet_sha:packet.hash,draft_key:chosen?draftKey:rec?.draft_key||null,editor:editor.mode,hold_reasons:hold,first_seen:rec?.first_seen||now,updated_at:now,published_at:publishable?(rec?.published_at||now):rec?.published_at||null};
   await env.STATE.put(recKey,JSON.stringify(record));if(!rec)await env.STATE.put('news:slug:'+slug,packet.topic);
   out.stories.push({topic:packet.topic,slug,status:state,editor:editor.mode,materiality:packet.materiality.score,hold,editor_log:editorLog?{status:editorLog.status,reason:editorLog.reason,reasons:editorLog.attempts.map(a=>a.reasons)}:null});
  }
  if(indexDirty){index.sort((a,b)=>String(b.published_at).localeCompare(String(a.published_at)));await putJSON(env.PUBLIC,'news/v2/index.json',index.slice(0,1000));}
  out.finished=new Date().toISOString();out.editor.usd=Math.round(out.editor.usd*1e6)/1e6;
  await env.STATE.put('news:health',JSON.stringify({...out,stories:out.stories.slice(0,80)}));
  return out;
 }finally{const cur=await env.STATE.get('news:lease',{type:'json'});if(cur?.token===token)await env.STATE.delete('news:lease');}
}
async function listDocs(bucket,prefix,limit){const l=await bucket.list({prefix,limit});const rows=[];for(const o of l.objects)rows.push(await getJSON(bucket,o.key));return rows;}
export default {
 async fetch(request,env={}){
  const url=new URL(request.url),path=url.pathname;
  if(path==='/health'){const h=await env.STATE?.get('news:health',{type:'json'}).catch(()=>null);return json({mode:env.NEWS_MODE||'shadow',publication_enabled:env.PUBLISH_ENABLED==='true',canary_types:env.NEWS_CANARY_TYPES||'',openai_configured:Boolean(env.OPENAI_API_KEY),last_run:h?{started:h.started,finished:h.finished,mode:h.mode,candidates:h.candidates,built:h.built,published:h.published,updated:h.updated,shadow:h.shadow,held:h.held,below_threshold:h.below_threshold,editor:h.editor}:null});}
  if(!['/admin/news-shadow','/admin/news-publish','/admin/news-drafts','/admin/news-cost'].includes(path)||request.method!=='POST')return json({error:'not_found'},404);
  if(!await adminAllowed(request,env))return json({error:'unauthorized'},401);
  const q=k=>url.searchParams.get(k),L=k=>(q(k)||'').split(',').filter(Boolean);
  if(path==='/admin/news-drafts')return json(q('published')?await listDocs(env.PUBLIC,'news/v2/articles/',Number(q('limit'))||100):await listDocs(env.PRIVATE,'news/v2/shadow/',Number(q('limit'))||100));
  if(path==='/admin/news-cost'){const d=q('day')||new Date().toISOString().slice(0,10);return json(await env.STATE.get('news:openai:'+d,{type:'json'})||{day:d,calls:0,usd:0});}
  const publish=path==='/admin/news-publish';
  if(publish&&env.PUBLISH_ENABLED!=='true')return json({error:'publication_disabled'},409);
  const mode=publish?(q('mode')==='publish'?'publish':'canary'):(q('desk')?'desk':'shadow');
  return json(await run(env,{mode,force:q('force')==='1',types:L('types').length?L('types'):null,editions:L('editions'),today:q('today')||undefined}));
 },
 async scheduled(event,env,ctx){
  const m=env.NEWS_MODE||'shadow',mode=['shadow','canary','publish'].includes(m)?m:'shadow';
  ctx.waitUntil(run(env,{mode}).then(r=>console.log(JSON.stringify({worker:'golf-news',mode,published:r.published,updated:r.updated,shadow:r.shadow,held:r.held,candidates:r.candidates,error:r.error||r.status||null}))));
 }
};
