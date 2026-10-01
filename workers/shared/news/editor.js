// OpenAI editorial pass (Responses API, strict Structured Outputs). The model writes prose with tokens;
// it never owns a number, URL, chart value, video id, image licence, date, score, equipment or caddie fact.
import {validateDraft} from './validate.js';
export const EDITOR_VERSION='golf-editor/4.0.0';
// Hard-coded so a price change is a reviewed code change (USD per million tokens).
export const PRICE={input:1.25,output:10.0};
export function articleSchema(packet){
 const charts=packet.charts.length?packet.charts:['none'],ents=packet.entities.length?packet.entities.map(x=>x.key):['none'];
 const str={type:'string'},arr=items=>({type:'array',items});
 return {type:'object',additionalProperties:false,required:['headline','dek','sections','chart_intents','link_intents','known_limits','seo_title','seo_description','social_headline'],properties:{
  headline:str,dek:str,
  sections:arr({type:'object',additionalProperties:false,required:['heading','paragraphs'],properties:{heading:str,paragraphs:arr(str)}}),
  chart_intents:arr({type:'string',enum:charts}),link_intents:arr({type:'string',enum:ents}),known_limits:arr(str),
  seo_title:str,seo_description:str,social_headline:str}};
}
export const SYSTEM=`You are the PropBetEdge Golf Desk editor. You write one factual golf story from a frozen fact packet.

TRUTH
- The packet is the only source of truth. Do not use outside knowledge about players, courses, history, equipment, caddies or weather.
- Every value (score, total, position, count, date, distance, money, percentage, year, speed) must be written as a fact token {f:FACT_ID} from the packet. Never type a digit. Never spell a count or placing in words ("three", "fifth"); use the fact token.
- To name a player, course, tournament or comparison with a link, write an entity token {e:ENTITY_KEY}. Never write a URL.
- Do not invent quotes, feelings, motivations, injuries, equipment, caddies, sponsorships, course firmness or green speed.
- No betting language, predictions, odds, favourites or certainty words. No superlatives such as historic or best ever.

CRAFT
- Lead with what happened or what matters this week, using the strongest facts. Plain, confident sports-desk English.
- Three to five sections, each with a short descriptive heading (plain text, no tokens needed) and one to three paragraphs.
- Headline names the subject; dek is one or two sentences. seo_title at most about sixty characters once tokens render; seo_description is a single sentence; social_headline is short and specific.
- chart_intents: choose only charts that support the story. link_intents: the entity keys you linked.
- known_limits: restate the packet limits that matter to a reader, in plain words.
- If a fact is not in the packet, leave it out. Shorter and true beats longer.`;
const usageOf=r=>({input:r?.usage?.input_tokens||0,output:r?.usage?.output_tokens||0});
const cost=u=>(u.input*PRICE.input+u.output*PRICE.output)/1e6;
export const redact=s=>String(s||'').replace(/\b(sk|pk|rk)-[A-Za-z0-9_-]{8,}/g,'$1-[redacted]').replace(/Bearer\s+[A-Za-z0-9._-]+/gi,'Bearer [redacted]');
async function call(env,body){
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),90000);
 try{const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',signal:ctl.signal,headers:{authorization:'Bearer '+env.OPENAI_API_KEY,'content-type':'application/json'},body:JSON.stringify(body)});
  const j=await r.json().catch(()=>null);if(!r.ok)throw Error('openai_http_'+r.status+':'+redact(j?.error?.message||'').slice(0,160));
  if(j.status==='incomplete'||j.status==='failed')throw Error('openai_'+j.status+':'+(j.incomplete_details?.reason||''));
  const parts=(j.output||[]).flatMap(o=>o.content||[]);if(parts.some(p=>p.type==='refusal'))throw Error('openai_refusal');
  const text=parts.filter(p=>p.type==='output_text').map(p=>p.text).join('');return {draft:JSON.parse(text),usage:usageOf(j)};
 }finally{clearTimeout(timer);}
}
function packetForModel(packet){
 return {type:packet.type,topic:packet.topic,facts:packet.facts.map(f=>({id:f.id,label:f.label,value:f.display,source:f.source})),entities:packet.entities.map(x=>({key:x.key,type:x.type,name:x.name})),charts:packet.charts.map(id=>({id,title:packet.chart_data[id]?.title||id})),limits:packet.limits,context:packet.context};
}
// Daily spend ledger in KV; the breaker refuses calls once today's nominal spend reaches the cap.
async function ledger(env,day){try{return JSON.parse(await env.STATE?.get('news:openai:'+day)||'null')||{day,calls:0,input:0,output:0,usd:0,stories:[]};}catch{return {day,calls:0,input:0,output:0,usd:0,stories:[]};}}
async function record(env,l,u,topic,outcome){l.calls++;l.input+=u.input;l.output+=u.output;l.usd=Math.round((l.usd+cost(u))*1e6)/1e6;l.stories.push({topic,outcome,input:u.input,output:u.output,at:new Date().toISOString()});l.stories=l.stories.slice(-200);await env.STATE?.put('news:openai:'+l.day,JSON.stringify(l),{expirationTtl:40*86400});}
export async function editorialPass(env,packet,baseline,{resolve}={}){
 if(!env.OPENAI_API_KEY)return {status:'unavailable',reason:'no_api_key'};
 const day=new Date().toISOString().slice(0,10),l=await ledger(env,day),cap=Number(env.GOLF_OPENAI_DAILY_MAX_USD||5);
 if(l.usd>=cap)return {status:'deferred',reason:'daily_cap',spent_usd:l.usd};
 const model=env.GOLF_EDITORIAL_MODEL||'gpt-5.6-sol',max=Number(env.GOLF_EDITORIAL_MAX_OUTPUT_TOKENS||6000);
 const schema=articleSchema(packet),fmt={type:'json_schema',name:'golf_article',strict:true,schema};
 const input=`FACT PACKET:\n${JSON.stringify(packetForModel(packet))}\n\nBASELINE (deterministic desk draft; improve it, keep every rule):\n${JSON.stringify(baseline)}`;
 const out={model,attempts:[],usd:0};
 try{
  const a=await call(env,{model,store:false,reasoning:{effort:'low'},instructions:SYSTEM,input,max_output_tokens:max,text:{format:fmt}});
  await record(env,l,a.usage,packet.topic,'generated');out.usd+=cost(a.usage);
  const clean=d=>({...d,chart_intents:(d.chart_intents||[]).filter(x=>x!=='none'),link_intents:(d.link_intents||[]).filter(x=>x!=='none')});
  let draft=clean(a.draft),v=validateDraft(packet,draft,{resolve});out.attempts.push({kind:'generate',reasons:v.reasons,usage:a.usage});
  // One targeted repair when the failures are few; never a second free-form generation.
  if(!v.ok&&v.reasons.length<=4&&(await ledger(env,day)).usd<cap){
   const r=await call(env,{model,store:false,reasoning:{effort:'low'},instructions:SYSTEM,input:`${input}\n\nYOUR DRAFT:\n${JSON.stringify(draft)}\n\nIT FAILED THESE GATES:\n${v.reasons.join('\n')}\n\nReturn the full corrected article. Fix only what failed.`,max_output_tokens:max,text:{format:fmt}});
   await record(env,l,r.usage,packet.topic,'repair');out.usd+=cost(r.usage);draft=clean(r.draft);v=validateDraft(packet,draft,{resolve});out.attempts.push({kind:'repair',reasons:v.reasons,usage:r.usage});
  }
  return {...out,status:v.ok?'validated':'held',draft,validation:v};
 }catch(e){return {...out,status:'error',reason:redact(e.message).slice(0,200)};}
}
