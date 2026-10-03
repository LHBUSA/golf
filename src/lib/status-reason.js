// Tournament status reasoning (suspended / delayed / round complete). Pure; used by the browser (report + render).
// Sources: the approved ESPN core-API status text (and any future approved status notes passed in as status_notes). A reason or restart time is shown ONLY when a source text states it, quoted with
// its source and time. Counts of affected players are PBE-derived from the observed board and labelled so.
export const STATUS_REASON_VERSION='status-reason/1.0.0';
const SUSP=new Set(['STATUS_SUSPENDED','STATUS_PLAY_SUSPENDED']),DELAY=new Set(['STATUS_DELAYED','STATUS_RAIN_DELAY']),POSTPONED=new Set(['STATUS_POSTPONED']);
// Reason vocabulary: matched only as words present in a source text (never inferred from weather data).
const REASONS=[[/\bdarkness\b/i,'darkness'],[/\blightning\b/i,'lightning'],[/dangerous (?:weather|conditions)/i,'dangerous weather'],[/\b(?:thunder)?storms?\b/i,'storms'],[/\bheavy rain|\brain\b/i,'rain'],[/\bhigh winds?|\bwinds?\b/i,'wind'],[/\bfog\b/i,'fog'],[/\bfrost\b/i,'frost'],[/course conditions|unplayable|waterlogged|flooding|standing water/i,'course conditions'],[/\bweather\b/i,'weather']];
export function reasonIn(text){const t=String(text||'');for(const [re,label] of REASONS){const m=t.match(re);if(m)return {label,phrase:m[0]};}return null;}
// A restart phrase quoted verbatim from a source text, e.g. "resume at 8:10 a.m.", "will resume Saturday morning".
export function restartIn(text){const m=String(text||'').match(/\b(?:will\s+)?resum\w*\b[^.;]{0,70}/i);return m?m[0].trim():null;}
const plural=(n,w)=>`${n} ${w}${n===1?'':'s'}`;
/** Report for a public live event (shared/live.js publicEvent shape). Returns null for normal play. */
export function statusReport(ev,{now=Date.now()}={}){
 if(!ev)return null;const name=ev.status_name||'',detail=ev.status_detail||'',st=ev.state;
 const kind=SUSP.has(name)||(st==='suspended'&&!DELAY.has(name)&&!POSTPONED.has(name))?'suspended':DELAY.has(name)?'delayed':POSTPONED.has(name)?'postponed':st==='round_complete'?'round_complete':null;
 if(!kind)return null;
 const rows=(ev.leaderboard||[]).filter(r=>r.status==='active');
 const unfinished=rows.filter(r=>r.thru>0&&r.thru<18).length,notStarted=rows.filter(r=>!(r.thru>0)).length,finished=rows.filter(r=>r.thru===18).length;
 // Reason / restart: the observed event status text first, then matched publisher news; never inferred.
 const sources=[{source:'PropSports event status',text:detail,url:null,published:ev.fetched_at||null},...(ev.status_notes||[]).map(n=>({source:n.source||'ESPN',text:`${n.headline||''}. ${n.description||''}`,url:n.url,published:n.published,headline:n.headline}))]; // source-brand:allow (named publisher: matched news headlines keep their publisher)
 let reason=null,restart=null;for(const s of sources){if(!reason){const r=reasonIn(s.text);if(r)reason={...r,source:s.source,url:s.url,published:s.published,headline:s.headline||null};}if(!restart){const x=restartIn(s.text);if(x)restart={phrase:x,source:s.source,url:s.url,published:s.published};}}
 const round=ev.round,what=kind==='round_complete'?`Round ${round} complete`:kind==='delayed'?`Round ${round} delayed`:kind==='postponed'?`Round ${round} postponed`:`Round ${round} suspended`;
 let sentence;
 if(kind==='round_complete')sentence=`Round ${round} is complete${unfinished?`; ${plural(unfinished,'player')} still show an unfinished card on the board`:''}.`;
 else{sentence=`${kind==='suspended'?'Play is suspended':kind==='delayed'?'Play is delayed':'Play is postponed'}${reason?` (${reason.label}, per ${reason.source})`:''}.`;
  if(unfinished)sentence+=` ${plural(unfinished,'player')} ${unfinished===1?'has':'have'} not finished round ${round}${notStarted?` and ${notStarted} ${notStarted===1?'has':'have'} not started it`:''}.`;
  sentence+=restart?` ${restart.source}: “${restart.phrase}”.`:' No restart time has been published in the observed feed.';
  if(!reason)sentence+=' No official reason has been published in the observed feed yet.';}
 return {version:STATUS_REASON_VERSION,kind,title:what.toUpperCase(),sentence,reason,restart,
  affected:{round,unfinished,not_started:notStarted,finished,basis:'PBE-derived from the observed scoring board (thru counts)'},
  status:{text:detail||null,name:name||null,source:'PropSports event status',since:ev.status_since||null,updated:ev.fetched_at||null}};
}
