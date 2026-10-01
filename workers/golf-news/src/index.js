import {store,stableId} from '../../shared/store.js';import {adminAllowed} from '../../shared/admin.js';import {freezePacket,validateDraft,renderDraft} from './pipeline.js';
const json=(b,s=200)=>Response.json(b,{status:s,headers:{'cache-control':'no-store'}});
const EDITORIAL='golf-final-desk/2.0.0',QUALITY='golf-gates/2.0.0';
const toPar=v=>v===0?'even par':v<0?Math.abs(v)+' under par':v+' over par';
const names=rows=>rows.map(r=>r.player?.name).filter(Boolean);
const list=a=>a.length<=1?a.join(''):a.slice(0,-1).join(', ')+' and '+a.at(-1);
async function doc(env,key){const o=await env.PUBLIC.get('projection/v2/'+key);return o?JSON.parse(await o.text()):null;}
// One material story per completed edition with a published leaderboard: the final result.
export async function buildStory(ed){
 const board=ed.leaderboard||[],w=board.find(r=>r.winner);
 if(ed.status!=='completed'||!w?.player?.slug||['winner_only','schedule_only','none'].includes(ed.coverage))return {skip:'not_material'};
 const cap=ed.provenance?.id;if(!cap)return {skip:'no_capture'};
 const facts=[{id:'event',capture_id:cap,value:ed.name},{id:'championship',capture_id:cap,value:ed.tournament?.name||ed.name},{id:'winner',capture_id:cap,value:w.player.name}];
 if(ed.course)facts.push({id:'course',capture_id:cap,value:ed.course.name});
 if(Number.isInteger(w.strokes))facts.push({id:'total',capture_id:cap,value:w.strokes});
 if(Number.isInteger(w.to_par))facts.push({id:'to_par',capture_id:cap,value:w.to_par,display:toPar(w.to_par)});
 if(w.rounds?.length)facts.push({id:'winner_rounds',capture_id:cap,value:w.rounds.map(r=>r.strokes).join('-'),display:list(w.rounds.map(r=>String(r.strokes)))});
 const second=board.filter(r=>r.status==='finished'&&r.position===2);
 if(second.length)facts.push({id:'runner_up',capture_id:cap,value:list(names(second))});
 if(Number.isFinite(w.margin)&&w.margin>0)facts.push({id:'margin',capture_id:cap,value:w.margin,display:w.margin===1?'one stroke':w.margin+' strokes'});
 const t3=ed.timeline?.find(t=>t.after_round===3);if(t3)facts.push({id:'r3_leaders',capture_id:cap,value:list(t3.leaders.map(l=>l.name))});
 if(ed.results_source?.cut&&Number.isInteger(ed.results_source.cut.score_to_par))facts.push({id:'cut',capture_id:cap,value:ed.results_source.cut.score_to_par,display:toPar(ed.results_source.cut.score_to_par)});
 if(ed.results_source?.made_cut)facts.push({id:'made_cut',capture_id:cap,value:ed.results_source.made_cut});
 const has=id=>facts.some(f=>f.id===id);
 const paragraphs=[{kind:'fact_sentence',template:has('course')?'{winner} won the {event} at {course}.':'{winner} won the {event}.'}];
 if(has('total')&&has('to_par'))paragraphs.push({kind:'fact_sentence',template:'The winning total was {total}, {to_par}.'});
 if(has('winner_rounds'))paragraphs.push({kind:'fact_sentence',template:'{winner} posted rounds of {winner_rounds}.'});
 if(w.margin===0&&has('runner_up'))paragraphs.push({kind:'fact_sentence',template:'The title was decided in a playoff over {runner_up}.'});
 else if(has('margin')&&has('runner_up'))paragraphs.push({kind:'fact_sentence',template:'The margin over {runner_up} was {margin}.'});
 if(has('r3_leaders'))paragraphs.push({kind:'fact_sentence',template:'{r3_leaders} held the lead after the third round.'});
 if(has('cut')&&has('made_cut'))paragraphs.push({kind:'fact_sentence',template:'The cut fell at {cut}, with {made_cut} players advancing to the weekend.'});
 const packet=await freezePacket({event_key:'final:'+ed.slug,capture_ids:[cap],materiality:'tournament_final',facts});
 return {packet,draft:{title:`${w.player.name} wins the ${ed.tournament?.name||'tournament'}`,paragraphs},ed,winner:w};
}
async function run(env,{publish}){
 const db=store(env);if(!db||!env.PUBLIC)return {error:'unconfigured'};
 const ix=await doc(env,'index.json');if(!ix)return {error:'projection_unavailable'};
 const horizon=new Date(Date.parse(ix.as_of)-75*86400000).toISOString().slice(0,10);
 const candidates=ix.recent.filter(e=>e.ends_on&&e.ends_on>=horizon&&!['winner_only','schedule_only'].includes(e.coverage)).slice(0,20);
 const out={mode:publish?'publish':'shadow',candidates:candidates.length,published:0,validated:0,held:0,duplicates:0,skipped:0,stories:[]};
 const published=[];try{published.push(...JSON.parse(await (await env.PUBLIC.get('news/v1/index.json'))?.text()||'[]'));}catch{}
 for(const c of candidates){
  const ed=await doc(env,'editions/'+c.slug+'.json');if(!ed){out.skipped++;continue;}
  const s=await buildStory(ed);if(s.skip){out.skipped++;continue;}
  const prior=(await db('golf_articles','select=id,status&dedupe_key=eq.'+encodeURIComponent(s.packet.event_key)))[0];
  // A validated shadow draft may be promoted on a later publish run; published stories are never duplicated.
  if(prior&&(prior.status==='published'||!publish)){out.duplicates++;continue;}
  const verdict=validateDraft(s.packet,s.draft,[]),reasons=[...verdict.reasons];
  if(!s.winner.player?.slug)reasons.push('identity_unresolved');
  const ok=!reasons.length,status=ok&&publish?'published':ok?'validated':'held',now=new Date().toISOString();
  const photo=s.winner.player?.photo?.derivatives?s.winner.player.photo:null;
  const id=await stableId('packet:'+s.packet.hash),articleId=await stableId('article:'+s.packet.hash);
  await db('golf_news_packets','on_conflict=event_key',{method:'POST',headers:{prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify({id,event_key:s.packet.event_key,sha256:s.packet.hash,packet_version:s.packet.version,materiality:s.packet.materiality,facts:s.packet.facts,evidence:{capture_ids:s.packet.capture_ids,source:'golf projection '+ix.as_of,edition:'/tournament/'+ed.slug,results_source:ed.results_source?.attribution||null}})});
  const packetId=(await db('golf_news_packets','select=id&event_key=eq.'+encodeURIComponent(s.packet.event_key)))[0]?.id||id;
  for(const capture_id of s.packet.capture_ids)await db('golf_news_packet_captures','on_conflict=packet_id,capture_id',{method:'POST',headers:{prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify({packet_id:packetId,capture_id})});
  const article={id:prior?.id||articleId,packet_id:packetId,slug:ed.slug,headline:s.draft.title,body:s.draft.paragraphs,status,hold_reasons:ok?(publish?[]:['shadow_mode']):reasons,dedupe_key:s.packet.event_key,numeric_claims:s.packet.facts.filter(f=>typeof f.value==='number'),editorial_version:EDITORIAL,quality_version:QUALITY,media_id:null,published_at:status==='published'?now:null};
  await db('golf_articles','on_conflict=dedupe_key',{method:'POST',headers:{prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(article)});
  out.stories.push({slug:ed.slug,status,reasons});out[status]++;
  if(status==='published')published.unshift({slug:ed.slug,headline:s.draft.title,kicker:(ed.is_major?(ed.division==='women'?'Women’s major':'Men’s major'):(ed.tours?.[0]||'Golf')).toUpperCase()+' · FINAL',paragraphs:renderDraft(s.packet,s.draft),edition:'/tournament/'+ed.slug,winner:'/player/'+s.winner.player.slug,photo,published_at:now,packet_sha256:s.packet.hash,source_note:`Facts frozen from ${ed.results_source?.attribution||'the canonical record'} (CC BY-SA 4.0) and Wikidata (CC0). Every number traces to packet ${s.packet.hash.slice(0,12)}.`});
 }
 if(out.published)await env.PUBLIC.put('news/v1/index.json',JSON.stringify(published.slice(0,60)),{httpMetadata:{contentType:'application/json'}});
 return out;
}
export default {
 async fetch(request,env={}){
  const path=new URL(request.url).pathname;
  if(path==='/health')return json({mode:env.PUBLISH_ENABLED==='true'?'publish_gated':'shadow',publication_enabled:env.PUBLISH_ENABLED==='true',automatic_publication:false});
  if(!['/admin/news-shadow','/admin/news-publish'].includes(path)||request.method!=='POST')return json({error:'not_found'},404);
  if(!await adminAllowed(request,env))return json({error:'unauthorized'},401);
  const publish=path==='/admin/news-publish';
  if(publish&&env.PUBLISH_ENABLED!=='true')return json({error:'publication_disabled'},409);
  return json(await run(env,{publish}));
 },
 async scheduled(){console.log(JSON.stringify({worker:'golf-news',status:'manual_runs_only'}));}
};
