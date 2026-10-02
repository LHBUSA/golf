// Golf Newsroom V4. Source change -> materiality -> entities -> frozen packet -> editor -> gates -> plans -> publish or hold.
// The packet owns truth. The model (when configured) writes tokenized prose only; the application renders values and links.
import {store,stableId} from '../../shared/store.js';
import {adminAllowed} from '../../shared/admin.js';
import {TYPES,THRESHOLD} from '../../shared/news/types.js';
import {changedFacts} from '../../shared/news/facts.js';
import {deskDraft,DESK_VERSION,DESK_V5,deskVersionFor} from '../../shared/news/desk.js';
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
 const movement=s=>getJSON(env.PUBLIC,'live/v1/movement/'+s+'.json').catch(()=>null);
 return {ix,today,as_of:ix.as_of,window,recent,forced,live,movement,ed:s=>get('editions/'+s+'.json'),pl:s=>get('players/'+s+'.json'),co:s=>get('courses/'+s+'.json'),ixPlayer:s=>ixPlayers.get(s)};
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
   if(mode==='compare'){out.compared=(out.compared||0)+1;out.stories.push({topic:packet.topic,compare:(await compareEditors(env,packet,ctx)).summary});continue;}
   const wantsPublish=mode==='publish'||mode==='canary'&&canary.has(packet.type);
   const deskStale=rec?.desk_version&&rec.desk_version!==deskVersionFor(packet.type,v5Types(env))||!rec?.desk_version&&V5ON(env,packet.type);
   if(rec&&rec.packet_sha===packet.hash&&!force&&!deskStale&&(rec.state==='published'||!wantsPublish)){out.unchanged++;continue;}
   await putJSON(PRIV,'news/v2/packets/'+packet.hash+'.json',packet);
   // Draft: the topic's validated draft re-renders with new facts (tokens), else the editor (new topics only), else the desk.
   const deskVersion=deskVersionFor(packet.type,v5Types(env)),desk=deskDraft(packet,{version:deskVersion}),deskV=validateDraft(packet,desk,{resolve:resolveHref});
   let chosen=null,editor={mode:'deterministic_fallback',version:deskVersion},editorLog=null;
   const prevDraft=rec?.draft_key?await getJSON(PRIV,rec.draft_key):null;
   // A deterministic draft written by an older desk is replaced by the current desk (model drafts are kept).
   // 'desk' is the legacy label for a deterministic draft.
   const staleDesk=['deterministic_fallback','desk'].includes(prevDraft?.editor?.mode)&&prevDraft.editor.version!==deskVersion&&deskV.ok;
   if(prevDraft&&!staleDesk){const v=validateDraft(packet,prevDraft.draft,{resolve:resolveHref});if(v.ok){chosen=prevDraft.draft;editor=prevDraft.editor;}}
   if(!chosen&&!rec&&mode!=='desk'){
    const ep=await editorialPass(env,packet,desk,{resolve:resolveHref});editorLog={status:ep.status,reason:ep.reason||null,attempts:ep.attempts||[],usd:ep.usd||0,model:ep.model||null,draft:ep.draft||null};
    if(ep.status==='unavailable')out.editor.unavailable=ep.reason;else if(ep.status==='error')out.editor.errors++;
    out.editor.usd+=ep.usd||0;
    if(ep.status==='validated'){chosen=ep.draft;editor={mode:'openai',model:ep.model,version:EDITOR_VERSION};out.editor.openai++;}
   }
   // Never present a fallback as AI output: the desk draft is labelled deterministic_fallback with the reason.
   if(!chosen&&deskV.ok){chosen=desk;editor={mode:'deterministic_fallback',reason:editorLog?(editorLog.reason||editorLog.status):staleDesk?'desk_upgrade':'existing_topic_no_new_model_call',version:deskVersion};out.editor.desk++;}
   if(editorLog)await putJSON(PRIV,'news/v2/compare/'+packet.topic.replace(/[^a-z0-9:-]/gi,'_')+'.json',compareDoc(packet,desk,deskV,editorLog,editor));
   let slug=rec?.slug||articleSlug(packet);
   if(!rec){const owner=await env.STATE.get('news:slug:'+slug);if(owner&&owner!==packet.topic)slug=slug+'-'+packet.hash.slice(0,6);}
   const hold=chosen?[]:deskV.reasons,publishable=Boolean(chosen)&&wantsPublish,now=new Date().toISOString();
   const prior=rec?.state==='published'?await getJSON(env.PUBLIC,'news/v2/articles/'+slug+'.json'):null;
   const article=chosen?buildArticle({packet,draft:chosen,editor,slug,ctx,hero:await pickHero(packet,ctx),video:pickVideo(packet,videos),prior,now,status:publishable?'published':'shadow'}):null;
   if(article&&prior&&prior.packet_sha256!==packet.hash){
    const prevPacket=await getJSON(PRIV,'news/v2/packets/'+prior.packet_sha256+'.json');const ch=changedFacts(prevPacket,packet);
    const prevIds=new Set((prevPacket?.facts||[]).map(f=>f.id)),onlyAdded=ch.length>0&&ch.every(id=>!prevIds.has(id)),textOnly=!ch.length;
    const kind=UPDATE_TYPES.has(packet.type)?'update':onlyAdded?'enrichment':textOnly?'rewrite':'correction';
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
   const record={desk_version:chosen&&editor.mode==='deterministic_fallback'?editor.version:rec?.desk_version||null,topic:packet.topic,type:packet.type,slug,state:rec?.state==='published'&&!publishable?'published':state,packet_sha:packet.hash,draft_key:chosen?draftKey:rec?.draft_key||null,editor:editor.mode,hold_reasons:hold,first_seen:rec?.first_seen||now,updated_at:now,published_at:publishable?(rec?.published_at||now):rec?.published_at||null};
   await env.STATE.put(recKey,JSON.stringify(record));if(!rec)await env.STATE.put('news:slug:'+slug,packet.topic);
   out.stories.push({topic:packet.topic,slug,status:state,editor:editor.mode,materiality:packet.materiality.score,hold,editor_log:editorLog?{status:editorLog.status,reason:editorLog.reason,reasons:editorLog.attempts.map(a=>a.reasons)}:null});
  }
  if(indexDirty){index.sort((a,b)=>String(b.published_at).localeCompare(String(a.published_at)));await putJSON(env.PUBLIC,'news/v2/index.json',index.slice(0,1000));}
  out.finished=new Date().toISOString();out.editor.usd=Math.round(out.editor.usd*1e6)/1e6;
  await env.STATE.put('news:health',JSON.stringify({...out,stories:out.stories.slice(0,80)}));
  return out;
 }finally{const cur=await env.STATE.get('news:lease',{type:'json'});if(cur?.token===token)await env.STATE.delete('news:lease');}
}
// Side-by-side record of one packet: deterministic desk vs OpenAI, with every gate and plan element.
function planSummary(packet,draft,{hero=null,video=null,editor='deterministic_fallback'}={}){if(!draft)return null;const slug=articleSlug(packet);const a=buildArticle({packet,draft,editor:{mode:editor,version:'c'},slug,ctx:{},hero,video});
 return {editor:a.editor.mode,slug,canonical:'https://golf.propbetedge.ai/news/'+slug,og_image:'https://golf.propbetedge.ai/og/news/'+slug+'.png',jsonld_type:['course_intelligence','player_form','major_history'].includes(packet.type)?'AnalysisNewsArticle':'NewsArticle',media:{hero:a.hero?.kind||null,hero_subject:a.hero?.name||null,hero_licence:a.hero?.photo?.licence||null,video:a.video?.video_id||null},evidence_facts:a.evidence.length,facts_used:a.evidence.map(f=>f.fact),derived_used:a.evidence.filter(f=>String(f.source).startsWith('Derived from')).length,modules:a.sections.filter(s=>s.module).map(s=>s.module),headline:a.headline_text,dek:a.dek_text,seo:a.seo,links:a.entities.filter(x=>a.sections.some(s=>s.paragraphs.some(p=>p.some(g=>g.t==='link'&&g.href===x.href)))).map(x=>x.href),charts:a.charts.map(c=>c.id),words:a.sections.flatMap(s=>s.paragraphs).map(p=>p.map(x=>x.v).join('')).join(' ').split(/\s+/).length,sections:a.sections.map(s=>({heading:s.heading,text:s.paragraphs.map(p=>p.map(x=>x.v).join('')).join(' ')}))};}
function compareDoc(packet,desk,deskV,log,editor,media={}){
 const numeric=r=>(r||[]).filter(x=>/unsupported_number|number_word|ordinal_word/.test(x));
 const openaiV=log.attempts?.at(-1)?{ok:log.status==='validated',reasons:log.attempts.at(-1).reasons}:null;
 return {at:new Date().toISOString(),topic:packet.topic,type:packet.type,packet_sha256:packet.hash,packet:{facts:packet.facts.map(f=>({id:f.id,label:f.label,display:f.display,source:f.source})),entities:packet.entities,charts:packet.charts,limits:packet.limits},
  chosen_editor:editor.mode,fallback_reason:editor.mode==='deterministic_fallback'?editor.reason||null:null,
  desk:{gates:{ok:deskV.ok,fact:deskV.reasons.filter(x=>!numeric([x]).length),numeric:numeric(deskV.reasons)},plan:planSummary(packet,desk,{...media,editor:'deterministic_fallback'})},
  openai:{status:log.status,reason:log.reason||null,model:log.model||null,usd:log.usd||0,attempts:(log.attempts||[]).map(a=>({kind:a.kind,usage:a.usage,fact:(a.reasons||[]).filter(x=>!numeric([x]).length),numeric:numeric(a.reasons)})),gates:openaiV,plan:log.draft&&openaiV?.ok?planSummary(packet,log.draft,{...media,editor:'openai'}):null,draft:log.draft||null}};
}
async function compareEditors(env,packet,ctx){
 const desk=deskDraft(packet,{version:DESK_V5}),deskV=validateDraft(packet,desk,{resolve:resolveHref});
 const v4=deskDraft(packet,{version:DESK_VERSION}),v4V=validateDraft(packet,v4,{resolve:resolveHref});
 const ep=await editorialPass(env,packet,desk,{resolve:resolveHref});
 const log={status:ep.status,reason:ep.reason||null,attempts:ep.attempts||[],usd:ep.usd||0,model:ep.model||null,draft:ep.draft||null};
 const videos=(await getJSON(env.PUBLIC,'video/v1/index.json').catch(()=>null))?.videos||[];
 const media={hero:await pickHero(packet,ctx),video:pickVideo(packet,videos)};
 const doc=compareDoc(packet,desk,deskV,log,{mode:ep.status==='validated'?'openai':'deterministic_fallback',reason:ep.status==='validated'?null:(ep.reason||ep.status)},media);
 doc.desk.version=DESK_V5;doc.desk.draft=desk;doc.desk_v4={version:DESK_VERSION,gates:{ok:v4V.ok,reasons:v4V.reasons},plan:planSummary(packet,v4,{...media,editor:'deterministic_fallback'}),draft:v4};
 await putJSON(env.PRIVATE,'news/v2/compare/'+packet.topic.replace(/[^a-z0-9:-]/gi,'_')+'.json',doc);
 return {summary:{editor:doc.chosen_editor,openai_status:ep.status,reason:doc.fallback_reason,desk_ok:deskV.ok,openai_ok:doc.openai.gates?.ok??null,usd:ep.usd||0}};
}
const v5Types=env=>String(env.NEWS_DESK_V5_TYPES||'').split(',').filter(Boolean);
const V5ON=(env,t)=>v5Types(env).includes(t);
async function listDocs(bucket,prefix,limit){const l=await bucket.list({prefix,limit});const rows=[];for(const o of l.objects)rows.push(await getJSON(bucket,o.key));return rows;}
export default {
 async fetch(request,env={}){
  const url=new URL(request.url),path=url.pathname;
  if(path==='/health'){const h=await env.STATE?.get('news:health',{type:'json'}).catch(()=>null);
   // Promotion ladder: each class earns publication separately (NEWS_CANARY_TYPES); counts from topic records.
   const LADDER=['final','round_recap','preview','notable_round','cut','course_weather','course_intelligence','major_history','player_form','play_suspended','playoff'];
   const recs=[];if(env.STATE){let cur;do{const l=await env.STATE.list({prefix:'news:topic:',cursor:cur});cur=l.list_complete?null:l.cursor;for(const k of l.keys){const r=await env.STATE.get(k.name,{type:'json'});if(r)recs.push(r);}}while(cur);}
   const live=new Set(String(env.NEWS_CANARY_TYPES||'').split(',').filter(Boolean));
   const ladder=LADDER.map((t,i)=>({rung:i+1,class:t,state:env.NEWS_MODE==='publish'||live.has(t)?'publishing':'shadow',published:recs.filter(r=>r.type===t&&r.state==='published').length,shadow_validated:recs.filter(r=>r.type===t&&r.state==='shadow_validated').length,held:recs.filter(r=>r.type===t&&r.state==='held').length,editors:[...new Set(recs.filter(r=>r.type===t).map(r=>r.editor))]}));
   return json({ladder,mode:env.NEWS_MODE||'shadow',publication_enabled:env.PUBLISH_ENABLED==='true',canary_types:env.NEWS_CANARY_TYPES||'',openai_configured:Boolean(env.OPENAI_API_KEY),last_run:h?{started:h.started,finished:h.finished,mode:h.mode,candidates:h.candidates,built:h.built,published:h.published,updated:h.updated,shadow:h.shadow,held:h.held,below_threshold:h.below_threshold,editor:h.editor}:null});}
  if(!['/admin/news-shadow','/admin/news-publish','/admin/news-drafts','/admin/news-cost','/admin/news-compare'].includes(path)||request.method!=='POST')return json({error:'not_found'},404);
  if(!await adminAllowed(request,env))return json({error:'unauthorized'},401);
  const q=k=>url.searchParams.get(k),L=k=>(q(k)||'').split(',').filter(Boolean);
  if(path==='/admin/news-drafts')return json(q('published')?await listDocs(env.PUBLIC,'news/v2/articles/',Number(q('limit'))||100):await listDocs(env.PRIVATE,'news/v2/shadow/',Number(q('limit'))||100));
  // Editor canary comparison: ?run=1 runs the editor on current packets (no publication); otherwise lists records.
  if(path==='/admin/news-compare'){if(q('run'))return json(await run(env,{mode:'compare',types:L('types').length?L('types'):['final'],editions:L('editions'),limit:Number(q('limit'))||5,today:q('today')||undefined}));return json(await listDocs(env.PRIVATE,'news/v2/compare/',Number(q('limit'))||50));}
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
