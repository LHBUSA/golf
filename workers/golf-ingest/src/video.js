// Keyless YouTube lane: verified official channels -> public Atom feed -> classify -> resolve entities in the
// video's own historical context -> oEmbed embeddability -> stored record. No API key, no downloads, no rehosting.
import registry from '../../../data/source-registry/youtube-channels.json' with {type:'json'};
import {capture} from './capture.js';
export const VIDEO_PARSER='golf-youtube-feed/1.0.0';
const DAY=86400000;
export const norm=s=>' '+String(s||'').normalize('NFKD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/&amp;/g,'&').replace(/['’]/g,'').replace(/[^a-z0-9]+/g,' ').trim()+' ';
const dec=s=>String(s||'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');
export function parseFeed(xml){
 const head=(xml.match(/<title>([^<]*)<\/title>/)||[])[1]||null;
 const entries=[...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(m=>{const e=m[1],g=re=>(e.match(re)||[])[1]||null;const link=g(/<link rel="alternate" href="([^"]+)"/);
  return {video_id:g(/<yt:videoId>([^<]+)<\/yt:videoId>/),channel_id:g(/<yt:channelId>([^<]+)<\/yt:channelId>/),title:dec(g(/<title>([^<]*)<\/title>/)),published_at:g(/<published>([^<]+)<\/published>/),updated_at:g(/<updated>([^<]+)<\/updated>/),description:dec(g(/<media:description>([\s\S]*?)<\/media:description>/)||'').slice(0,400),thumbnail:g(/<media:thumbnail url="([^"]+)"/),views:Number(g(/<media:statistics views="(\d+)"/))||null,is_short:/\/shorts\//.test(link||'')};}).filter(v=>v.video_id);
 return {feed_title:dec(head),entries};
}
// Title-first classification; the first matching family wins. Evidence is kept with the record.
const FAMILIES=[
 ['full_round',/\bfull (final |third |second |first )?round\b|\bfull broadcast\b|\bround [1-4] full\b|\bfull replay\b/i],
 ['witb',/what'?s in the bag|\bwitb\b/i],
 ['player_highlights',/\ball shots\b|\bevery shot\b(?!.*\bwin)/i],
 ['press_conference',/press conference|\bpresser\b|media day/i],
 ['course_flyover',/fly-?over/i],
 ['course_preview',/course (preview|tour|guide)|hole[- ]by[- ]hole (guide|preview)|course strategy/i],
 ['tournament_highlights',/(full )?tournament highlights|highlights from the week|every round highlights/i],
 ['round_highlights',/\b(round|r) ?[1-4]\b.*highlights|highlights.*\b(round|r) ?[1-4]\b|(first|second|third|final) round highlights|\bday [1-4]\b.*highlights|highlights.*\bday [1-4]\b|\bsingles highlights\b|\bfoursomes\b|\bfourballs?\b/i],
 ['winner_highlights',/\bwinning (moments|highlights|putt)\b|\bwins\b.*\bhighlights\b|\bevery shot\b|\bvictory\b/i],
 ['shot_highlights',/\bshot of the (day|week|year)\b|\bbest shots\b|\btop shots\b|hole[- ]in[- ]one|\bace\b|\balbatross\b|\bholes? out\b/i],
 ['interview',/\binterview\b|mic'?d up|sits down with|\breacts?\b|\breaction\b|\bspeaks\b/i],
 ['historical',/\bclassic\b|\bthrowback\b|\bfrom the vault\b|\bon this day\b|\bretro\b/i],
 ['player_highlights',/\bhighlights\b/i]];
export function classify(title){for(const [type,re] of FAMILIES){const m=title.match(re);if(m)return {video_type:type,evidence:m[0]};}return {video_type:'other',evidence:null};}
const ROUND=t=>{const m=t.match(/\b(?:round|r) ?([1-4])\b/i)||t.match(/\bday ([1-4])\b/i);if(m)return Number(m[1]);const w=t.match(/\b(first|second|third|final) round\b/i);return w?{first:1,second:2,third:3,final:4}[w[1].toLowerCase()]:null;};
// Indexes built once per run from the published projection index.
export function buildResolver(ix){
 const players=new Map();for(const p of ix.players||[]){const k=norm(p.name);if(k.trim().split(' ').length<2)continue;(players.get(k)||players.set(k,[]).get(k)).push(p.slug);}
 const tnames=new Map();for(const e of ix.editions||[]){const t=e.tournament?.name;if(!t)continue;const k=norm(t.replace(/^the /i,''));if(k.trim().length<6)continue;(tnames.get(k)||tnames.set(k,[]).get(k)).push(e);}
 const ALIAS=[[' masters ','masters tournament'],[' the open ','open championship'],[' open championship ','open championship'],[' u s open ','u s open'],[' us open ','u s open']];
 return {players,tnames,ALIAS,editions:ix.editions||[]};
}
export function resolve(v,R){
 const t=norm(v.title),pub=Date.parse(v.published_at);const year=(v.title.match(/\b(19[5-9]\d|20[0-4]\d)\b/)||[])[1];
 // Players: exact full-name matches that are unique in our record.
 const players=[];for(const [k,slugs] of R.players)if(slugs.length===1&&t.includes(k))players.push(slugs[0]);
 // Tournament: name match, then the edition nearest the video's own date (or the year named in the title).
 let cands=[];for(const [k,eds] of R.tnames)if(t.includes(k))cands.push(...eds);
 for(const [a,name] of R.ALIAS)if(t.includes(a))cands.push(...R.editions.filter(e=>norm(e.tournament?.name||'').includes(' '+name+' ')));
 cands=[...new Map(cands.map(e=>[e.slug,e])).values()];
 let edition=null,basis=null;
 if(cands.length){
  if(year){const y=cands.filter(e=>String(e.year)===year);if(y.length===1){edition=y[0];basis='title_year';}}
  if(!edition){const near=cands.filter(e=>e.starts_on&&e.ends_on&&pub>=Date.parse(e.starts_on)-10*DAY&&pub<=Date.parse(e.ends_on)+45*DAY).sort((a,b)=>Math.abs(Date.parse(a.ends_on)-pub)-Math.abs(Date.parse(b.ends_on)-pub));
   if(near.length===1||near.length>1&&Math.abs(Date.parse(near[0].ends_on)-pub)<Math.abs(Date.parse(near[1].ends_on)-pub)-7*DAY){edition=near[0];basis='publish_date_window';}}
 }
 const round=edition?ROUND(v.title):null;
 const confidence=edition&&(players.length||['round_highlights','tournament_highlights','full_round','winner_highlights','course_flyover','course_preview','press_conference'].includes(v.video_type))?'high':edition||players.length===1?'medium':'low';
 return {editions:edition?[edition.slug]:[],courses:edition?.course?.slug?[edition.course.slug]:[],players:players.slice(0,6),round,basis,confidence};
}
async function oembed(id){
 try{const r=await fetch('https://www.youtube.com/oembed?format=json&url='+encodeURIComponent('https://www.youtube.com/watch?v='+id),{headers:{'user-agent':'PropBetEdgeGolfVideo/1.0 (+https://golf.propbetedge.ai)'}});
  if(r.status===200)return true;if([400,401,403,404].includes(r.status))return false;return null;}catch{return null;}
}
export async function runVideo(env,db,{now=new Date()}={}){
 const ixo=await env.PUBLIC.get('projection/v2/index.json');if(!ixo)return {lane:'video',status:'projection_unavailable'};
 const ix=JSON.parse(await ixo.text()),R=buildResolver(ix);
 const store=JSON.parse(await env.PUBLIC.get('video/v1/index.json').then(o=>o?.text())||'null')||{videos:[]};
 const byId=new Map(store.videos.map(v=>[v.video_id,v]));
 const out={lane:'video',channels:0,entries:0,new:0,published:0,review:0,skipped_off_topic:0,feed_mismatch:[],inserted:0,updated:0};
 for(const ch of registry.channels.filter(c=>c.enabled&&c.id)){
  const cap=await capture(env,db,'youtube',`https://www.youtube.com/feeds/videos.xml?channel_id=${ch.id}`,{parser:VIDEO_PARSER,contentType:'application/atom+xml',accept:'application/atom+xml'});
  const f=parseFeed(cap.text);out.channels++;
  // Re-prove the channel every run: the feed title must still match the reviewed name.
  if(f.feed_title!==ch.verification.feed_title){out.feed_mismatch.push({channel:ch.handle,expected:ch.verification.feed_title,got:f.feed_title});continue;}
  for(const e of f.entries){out.entries++;if(e.channel_id&&e.channel_id!==ch.id&&e.channel_id!=='UC'+ch.id.slice(2))continue;
   const prev=byId.get(e.video_id);if(prev){prev.title=e.title;prev.views=e.views;continue;}
   const cls=classify(e.title),v={...e,channel_id:ch.id,channel:ch.name,channel_class:ch.class,...cls,classification:{evidence:cls.evidence,parser:VIDEO_PARSER},capture_id:cap.id,first_seen:now.toISOString()};
   const ent=resolve(v,R);v.entities={editions:ent.editions,courses:ent.courses,players:ent.players,round:ent.round};v.resolver={basis:ent.basis,confidence:ent.confidence};
   if(ch.golf_filter&&!ent.editions.length&&!ent.players.length&&!/\bgolf\b/i.test(e.title)){out.skipped_off_topic++;continue;}
   v.embeddable=ent.confidence==='low'&&!e.is_short?null:await oembed(e.video_id);v.oembed_checked_at=now.toISOString();
   v.link_status=e.is_short||ent.confidence==='low'||v.embeddable===false?'review':'published';
   out.new++;out[v.link_status==='published'?'published':'review']++;byId.set(e.video_id,v);
  }
 }
 const videos=[...byId.values()].sort((a,b)=>String(b.published_at).localeCompare(String(a.published_at))).slice(0,4000);
 await env.PUBLIC.put('video/v1/index.json',JSON.stringify({version:'golf-video/1',as_of:now.toISOString(),videos}),{httpMetadata:{contentType:'application/json'}});
 return out;
}
