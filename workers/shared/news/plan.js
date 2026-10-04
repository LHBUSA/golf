// Deterministic content/chart/media/link plans and the published article document.
import {segments,plain,resolveHref} from './validate.js';
import {TYPES} from './types.js';
import {HIGHLIGHT_FACTS,FINGERPRINT_FACTS} from './extras.js';
export {HIGHLIGHT_FACTS,FINGERPRINT_FACTS};
export const ARTICLE_VERSION='golf-article/5';
export const slugify=s=>String(s).normalize('NFKD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,110);
const F=(p,id)=>p.facts.find(f=>f.id===id);
// Stable, readable slugs. Frozen at first publication by the caller (topic record keeps it).
export function articleSlug(p){
 const v=id=>F(p,id)?.display,ev=v('event'),yr=v('year');
 switch(p.type){
  case 'final':return slugify(`${v('winner')} wins ${yr} ${ev}`);
  case 'preview':return slugify(`${yr} ${ev} preview`);
  case 'round_recap':return slugify(`${yr} ${ev} round ${p.context.round} recap`);
  case 'notable_round':return slugify(`${v('player')} ${v('round_strokes')} ${yr} ${ev} ${v('round_word')} round`);
  case 'cut':return slugify(`${yr} ${ev} cut`);
  case 'course_weather':return slugify(`${yr} ${ev} weather forecast`);
  case 'major_history':return slugify(`${ev} history ${yr}`);
  case 'player_form':return slugify(`${v('player')} form ${yr} ${ev}`);
  case 'course_intelligence':return slugify(`${v('course')} course dna ${yr} ${ev}`);
  case 'play_suspended':return slugify(`${yr} ${ev} ${v('round_word')} round play suspended`);
  case 'playoff':return slugify(`${yr} ${ev} playoff`);
  default:return slugify(p.topic);
 }
}
const QUICK={final:['winner','to_par','total','margin','runner_up','course'],preview:['start_day','course','par','yards','purse','field_size','defending'],round_recap:['leaders','lead_score','lead_margin','round_average','low_round'],notable_round:['player','round_strokes','round_to_par','vs_field','birdies'],cut:['cut_line','made_cut','missed_major_champions'],course_weather:['max_gust','max_rain','max_temp','forecast_point','forecast_issued'],major_history:['editions_in_record','last_champions'],player_form:['player','recent_top10','recent_starts','form_vs_field'],course_intelligence:['dna_editions','difficulty','difficulty_pct','spread'],play_suspended:['leaders','lead_score','snapshot_time'],playoff:['playoff_players','playoff_score']};
const METHOD={
 final:'Facts are frozen from the published final leaderboard and round scores. Margin, comeback position and hole difficulty are computed from those scores; career counts cover events in our record.',
 preview:'Facts are frozen from the published schedule, field and tournament history in our record. Field form is strokes per round against the field over recent full-field events.',
 round_recap:'Standings are computed from posted round scores. Field averages include every player who completed the round.',
 notable_round:'Field-relative scoring is the difference between the round score and the average score of every player who completed that round.',
 cut:'Cut status is as published. Notable players are major champions or players in the top decile of our 24-month scoring DNA.',
 course_weather:'Hourly NOAA National Weather Service forecast summarized over 7am–7pm local time on tournament days. A forecast, not observed conditions.',
 major_history:'Champions are those recorded in our tournament history; earlier editions may be missing from the record.',
 player_form:'Form is the player’s most recent full-field starts in our record and strokes per round against the field.',
 course_intelligence:'Course DNA aggregates full-field editions at this course in our record.',
 play_suspended:'Status and scores from the PropSports live scoring snapshot at the time shown.',
 playoff:'Players and scores from the PropSports live scoring snapshot.'};
// Chart order: the writer's intents first (validated), then any packet chart the type always shows.
const ALWAYS={final:['leaderboard'],round_recap:['leaderboard','movement'],preview:['past_winners'],course_weather:['weather'],cut:['leaderboard'],notable_round:['scorecard'],major_history:['past_winners'],player_form:['player_form'],course_intelligence:['course_dna']};
// Restrained emphasis: prose facts are plain by default. A class's anchor facts and one standout per section
// (section.em) are emphasised at their first mention only, at most one per paragraph, never a long phrase.
const ANCHORS={final:['to_par','margin','playoff'],round_recap:['lead_score','lead_margin'],preview:[],course_intelligence:[]};
const EM_MAX=5,EM_MAX_CHARS=22;
export function applyEmphasis(sections,packet,draftSections=[]){
 const seen=new Set(),anchors=new Set(ANCHORS[packet.type]||[]);let budget=EM_MAX;
 return sections.map((s,i)=>{const pick=new Set([...anchors,draftSections[i]?.em].filter(Boolean));
  return {...s,paragraphs:s.paragraphs.map(p=>{let used=false;return p.map(g=>{if(g.t!=='fact')return g;const first=!seen.has(g.fact);seen.add(g.fact);
   if(!used&&budget>0&&first&&pick.has(g.fact)&&String(g.v).length<=EM_MAX_CHARS){used=true;budget--;if(!draftSections[i]?.em||g.fact!==draftSections[i].em)anchors.delete(g.fact);return {...g,em:true};}return g;});})};});
}
// ---------------------------------------------------------------- Article Experience V2 (golf-article/5)
// "At a glance" highlights, the course fingerprint and callouts are APPLICATION-OWNED selections of packet facts:
// value = the fact's own display, caption = the fact's own label. No new numbers, no prose parsing. Every fact
// they show is added to the evidence ledger.
const pickFacts=(packet,ids,min)=>{const xs=ids.map(id=>F(packet,id)).filter(Boolean).map(f=>({fact:f.id,label:f.label,display:f.display}));return xs.length>=min?xs:[];};
export function articleExtras(packet){
 // Never repeat the quick-data row: highlights are what the row does not already show.
 const highlights=pickFacts(packet,(HIGHLIGHT_FACTS[packet.type]||[]).filter(id=>!(QUICK[packet.type]||[]).includes(id)),3).slice(0,5);
 const fp=['preview','course_intelligence','course_weather','major_history'].includes(packet.type)&&packet.chart_data.hole_difficulty?pickFacts(packet,FINGERPRINT_FACTS,3):[];
 const fingerprint=fp.length?{course:packet.entities.find(x=>x.type==='course')?.name||F(packet,'course')?.display||null,items:fp,chart:'hole_difficulty'}:null;
 // Callout: the front/back split when it exists and the fingerprint does not already show it.
 const split=!fingerprint?pickFacts(packet,['cd_front_nine','cd_back_nine'],2):[];
 const callouts=split.length?[{kind:'split',title:'The split',items:split}]:[];
 return {highlights,fingerprint,callouts};
}
export function buildArticle({packet,draft,editor,slug,ctx,hero,video=null,prior=null,now=new Date().toISOString(),status='published'}){
 const res=x=>resolveHref(x);
 const seg=t=>segments(t,packet,res),txt=t=>plain(segments(t,packet,res,{links:false}));
 const chartIds=[...new Set([...(draft.chart_intents||[]),...(draft.sections||[]).map(s=>s.module).filter(Boolean),...(ALWAYS[packet.type]||[])])].filter(id=>packet.chart_data[id]);
 const used=new Set();for(const t of [draft.headline,draft.dek,...draft.sections.flatMap(s=>s.paragraphs)])for(const m of String(t).matchAll(/\{f:([a-z0-9_]+)\}/g))used.add(m[1]);
 const extras=articleExtras(packet);for(const x of [...extras.highlights,...(extras.fingerprint?.items||[]),...extras.callouts.flatMap(c=>c.items)])used.add(x.fact);
 const evidence=packet.facts.filter(f=>used.has(f.id)).map(f=>({fact:f.id,label:f.label,display:f.display,source:f.source,capture_id:f.capture_id}));
 const entities=packet.entities.map(x=>({key:x.key,type:x.type,name:x.name,href:res(x)}));
 const ent=t=>entities.filter(x=>x.type===t);
 // Never cut a title inside a word: first candidate that fits, else trim at a word boundary.
 const seoTitle=(()=>{for(const c of [draft.seo_title,draft.social_headline,draft.headline].filter(Boolean)){const t=txt(c);if(t.length<=65)return t;}const w=txt(draft.seo_title||draft.headline).split(' ');let t='';for(const x of w){if((t+' '+x).trim().length>65)break;t=(t+' '+x).trim();}return t.replace(/\s+(the|at|of|to|a|an|in|and|from)$/i,'');})();
 const sources=[...new Set(packet.facts.map(f=>f.source).filter(Boolean))];
 if(hero?.photo)sources.push(`Photo: ${hero.photo.attribution||hero.photo.author}`);
 const edition=packet.context.edition;
 // Canonical edition id (the markets registry's golf canonical_event_id): exact slug -> id from our own projection
 // index, never a name match. Stored on the article (context) so its market module links to exactly one tournament.
 const editionId=(ctx?.ix?.editions||[]).find(x=>x.slug===edition)?.id||null;
 const doc={version:ARTICLE_VERSION,slug,type:packet.type,category:TYPES[packet.type]?.category||'GOLF',topic:packet.topic,status,
  headline:seg(draft.headline),dek:seg(draft.dek),headline_text:txt(draft.headline),dek_text:txt(draft.dek),
  seo:{title:seoTitle,description:txt(draft.seo_description||draft.dek).slice(0,170),social:txt(draft.social_headline||draft.headline)},
  sections:applyEmphasis(draft.sections.map(s=>({heading:txt(s.heading),paragraphs:s.paragraphs.map(seg),...(s.module&&s.module!=='none'?{module:s.module}:{})})),packet,draft.sections),
  quick_facts:(QUICK[packet.type]||[]).map(id=>F(packet,id)).filter(Boolean).slice(0,6).map(f=>({fact:f.id,label:f.label,display:f.display})),
  charts:chartIds.map(id=>({id,...packet.chart_data[id]})),
  highlights:extras.highlights,fingerprint:extras.fingerprint,callouts:extras.callouts,story_class:packet.type,
  hero,video,
  entities,related:{players:ent('player').slice(0,6),course:ent('course')[0]||null,tournament:ent('tournament')[0]||null,matchups:ent('matchup'),majors:ent('majors')[0]||null},
  pbecast:edition&&packet.context.status!=='scheduled'?{href:'/pbecast?e='+encodeURIComponent(edition)}:null,
  evidence,sources,known_limits:[...new Set([...(packet.limits||[]),...(draft.known_limits||[]).map(txt)])].filter(Boolean),method:METHOD[packet.type]||null,
  context:{edition,...(editionId?{edition_id:editionId}:{}),division:packet.context.division,is_major:packet.context.is_major,tour:packet.context.tour,round:packet.context.round||null},
  editor:{mode:editor.mode,model:editor.model||null,version:editor.version},packet_sha256:packet.hash,
  first_published_at:prior?.first_published_at||now,published_at:prior?.published_at||now,updated_at:now,
  revisions:[...(prior?.revisions||[])],corrections:[...(prior?.corrections||[])],
  // The embedded market record (article-market/1 rule 3) is permanent: a later revision keeps it.
  ...(prior?.market_result?{market_result:prior.market_result}:{})};
 return doc;
}
// Hero: the story's subject photo when rights-cleared, else the course, else branded fallback art.
export async function pickHero(packet,ctx){
 const order={course_weather:['c1'],course_intelligence:['c1'],major_history:['c1','p1'],preview:['p1','c1']}[packet.type]||['p1','c1'];
 for(const k of order){const x=packet.entities.find(e=>e.key===k);if(!x)continue;
  const d=x.type==='player'?await ctx.pl(x.ref):x.type==='course'?await ctx.co(x.ref):null;const ph=d?.photo;
  if(ph?.derivatives&&ph.licence)return {kind:x.type,name:x.name,slug:x.ref,photo:{sha256:ph.sha256,width:ph.width,height:ph.height,author:ph.author||null,licence:ph.licence,licence_url:ph.licence_url||null,attribution:ph.attribution||null,source_url:ph.source_url||null}};}
 return {kind:'fallback',name:null,slug:null,photo:null};
}
export const summaryOf=a=>({slug:a.slug,type:a.type,category:a.category,headline:a.headline_text,dek:a.dek_text,published_at:a.published_at,updated_at:a.updated_at,hero:a.hero?.photo?{sha256:a.hero.photo.sha256,width:a.hero.photo.width,height:a.hero.photo.height,kind:a.hero.kind}:null,entities:a.entities.map(x=>x.key+':'+x.type+':'+x.href),edition:a.context.edition,is_major:a.context.is_major,division:a.context.division});

// Official video for an article: chosen by the application from the keyless video index (never by the model).
const PREF={final:['winner_highlights','tournament_highlights','round_highlights','full_round'],round_recap:['round_highlights','full_round','player_highlights'],notable_round:['player_highlights','round_highlights','shot_highlights'],preview:['course_preview','course_flyover','press_conference','interview'],player_form:['player_highlights','interview'],course_intelligence:['course_flyover','course_preview'],cut:['round_highlights'],course_weather:['course_preview','course_flyover']};
export function pickVideo(packet,videos){
 const ed=packet.context?.edition,p1=packet.entities.find(x=>x.key==='p1'&&x.type==='player')?.ref,round=packet.context?.round||null,pref=PREF[packet.type]||[];
 const ok=(videos||[]).filter(v=>v.link_status==='published'&&v.embeddable!==false&&['high','medium'].includes(v.resolver?.confidence)&&ed&&v.entities?.editions?.includes(ed));
 const score=v=>(p1&&v.entities.players.includes(p1)?4:0)+(round&&v.entities.round===round?3:0)+(pref.includes(v.video_type)?3-pref.indexOf(v.video_type)*0.5:0)+(v.embeddable===true?0.5:0);
 const best=ok.map(v=>({v,s:score(v)})).filter(x=>x.s>=3).sort((a,b)=>b.s-a.s||String(b.v.published_at).localeCompare(String(a.v.published_at)))[0]?.v;
 return best?{video_id:best.video_id,title:best.title,channel:best.channel,channel_id:best.channel_id,published_at:best.published_at,video_type:best.video_type,label:{round_highlights:'Watch the round',full_round:'Full round replay',winner_highlights:'Watch the highlights',tournament_highlights:'Watch the highlights'}[best.video_type]||'Watch'}:null;
}
