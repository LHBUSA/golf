// Live tournament state contract. LIVE is earned by ESPN status + posted scores + a fresh snapshot.
// A date window alone never makes anything live. Missing values stay null (never zero).
export const LIVE_VERSION='golf-live/1.0.0';
// Every event in the window is refreshed every 10 minutes; while play is in progress the fast lane observes it
// about every minute (docs/LIVE_SCORING.md). An in-progress round is LIVE only while its last observation is at
// most LIVE_FRESH_SECONDS old; past that it is visibly stale. Other states keep the 10-minute contract.
export const FRESH_SECONDS=20*60,STALE_SECONDS=60*60,LIVE_FRESH_SECONDS=5*60;
const SUSPENDED=new Set(['STATUS_SUSPENDED','STATUS_PLAY_SUSPENDED','STATUS_DELAYED','STATUS_RAIN_DELAY','STATUS_POSTPONED']);
const FINAL=new Set(['STATUS_FINAL','STATUS_FINAL_PLAYOFF','STATUS_COMPLETED']);
// ESPN marks the end of every ROUND with completed:true/state 'post' (STATUS_PLAY_COMPLETE). Only an explicit final
// status (or completed with a non-round status) ends the event.
const ROUND_LEVEL=new Set(['STATUS_PLAY_COMPLETE','STATUS_END_PERIOD','STATUS_SUSPENDED','STATUS_PLAY_SUSPENDED','STATUS_DELAYED','STATUS_RAIN_DELAY','STATUS_POSTPONED','STATUS_IN_PROGRESS','STATUS_SCHEDULED']);
export const isEventFinal=type=>Boolean(type&&(FINAL.has(type.name)||(type.completed&&!ROUND_LEVEL.has(type.name))));
export const toParNum=v=>{if(v===null||v===undefined)return null;const s=String(v).replace('−','-').trim();if(s==='E')return 0;if(!/^[+-]?\d+$/.test(s))return null;return Number(s);};
export const toParText=v=>v===null||v===undefined?'—':v===0?'E':v>0?'+'+v:'−'+Math.abs(v);
export function freshness(snapshot,now=Date.now()){
 if(!snapshot?.fetched_at)return {age_seconds:null,freshness:'unavailable'};
 const age=Math.max(0,Math.round((now-Date.parse(snapshot.fetched_at))/1000));
 return {age_seconds:age,freshness:age<=FRESH_SECONDS?'fresh':age<=STALE_SECONDS?'stale':'unavailable'};
}
const scoring=s=>(s?.players||[]).some(p=>p.thru!==null&&p.thru!==undefined&&p.thru>0||(p.rounds||[]).some(r=>r.strokes!==null&&r.strokes!==undefined));
// state: pre | live | round_complete | suspended | stale | final | unavailable
export function liveState(snapshot,now=Date.now()){
 const f=freshness(snapshot,now);
 if(!snapshot)return {state:'unavailable',label:null,round:null,...f};
 const st=snapshot.event_status||{},name=st.name||'',round=st.period??null;
 if(isEventFinal({name,completed:st.completed}))return {state:'final',label:'FINAL',round,...f};
 if(f.freshness==='unavailable')return {state:'unavailable',label:null,round,...f};
 if(SUSPENDED.has(name))return {state:f.freshness==='fresh'?'suspended':'stale',label:f.freshness==='fresh'?'PLAY SUSPENDED':'SCORING UPDATE DELAYED',round,...f};
 if(st.state==='pre'||name==='STATUS_SCHEDULED')return {state:'pre',label:round&&round>1?`ROUND ${round} STARTS SOON`:'SCORING BEGINS WHEN PLAY STARTS',round,first_tee:firstTee(snapshot,round||1),...f};
 if(name==='STATUS_PLAY_COMPLETE'||name==='STATUS_END_PERIOD')return {state:f.freshness==='fresh'?'round_complete':'stale',label:f.freshness==='fresh'?`ROUND ${round} COMPLETE`:'SCORING UPDATE DELAYED',round,...f};
 if(st.state==='in'&&scoring(snapshot)){
  if(f.age_seconds<=LIVE_FRESH_SECONDS)return {state:'live',label:`LIVE SCORING · ROUND ${round}`,round,...f};
  return {state:'stale',label:'SCORING UPDATE DELAYED',round,...f,freshness:'stale'};
 }
 if(st.state==='in')return {state:'pre',label:'SCORING BEGINS WHEN PLAY STARTS',round,first_tee:firstTee(snapshot,round||1),...f};
 return {state:'unavailable',label:null,round,...f};
}
export function firstTee(snapshot,round){
 const ts=(snapshot?.players||[]).map(p=>(p.rounds||[]).find(r=>r.round===round)?.tee_time||p.tee_time).filter(Boolean).sort();return ts[0]||null;
}
// Ordered leaderboard of a snapshot (ESPN position first; cut/wd/dq last). Never invents a position.
export function leaderboard(snapshot){
 const rank=p=>p.position_num??9999,bucket=p=>({cut:1,withdrawn:2,disqualified:3,dns:4}[p.status]||0);
 return (snapshot?.players||[]).slice().sort((a,b)=>bucket(a)-bucket(b)||rank(a)-rank(b)||(a.total_to_par??999)-(b.total_to_par??999)||String(a.name).localeCompare(String(b.name)));
}
export function leaders(snapshot){const lb=leaderboard(snapshot).filter(p=>!p.status||p.status==='active');const top=lb[0]?.total_to_par;if(top===null||top===undefined)return {leaders:[],within2:0};return {leaders:lb.filter(p=>p.total_to_par===top),within2:lb.filter(p=>p.total_to_par!==null&&p.total_to_par<=top+2).length};}
// Public view for the API/UI: no internal ids beyond slugs, numbers as given.
export function publicEvent(snapshot,now=Date.now()){
 const s=liveState(snapshot,now),lb=leaderboard(snapshot),L=leaders(snapshot);
 return {edition:snapshot.edition,tour:snapshot.tour,league:snapshot.league,course:snapshot.course,state:s.state,label:s.label,round:s.round,first_tee:s.first_tee||null,freshness:s.freshness,age_seconds:s.age_seconds,fetched_at:snapshot.fetched_at,status_detail:snapshot.event_status?.detail||null,status_name:snapshot.event_status?.name||null,status_since:snapshot.status_since||null,status_notes:snapshot.status_notes||[],
  leaders:L.leaders.map(p=>({slug:p.slug,name:p.name,total_to_par:p.total_to_par,thru:p.thru})),within_two:L.within2,
  leaderboard:lb.map(p=>({slug:p.slug,name:p.name,position:p.position_display,tied:p.tied,status:p.status,total_to_par:p.total_to_par,today_to_par:p.today_to_par,today_strokes:p.today_strokes,thru:p.thru,start_hole:p.start_hole,tee_time:p.tee_time,rounds:(p.rounds||[]).map(r=>({round:r.round,strokes:r.strokes,to_par:r.to_par,complete:r.complete}))})),
  holes_available:Boolean(snapshot.holes_available),players:lb.length};
}
// Live events in a deterministic order: state (live first), then tour field size (larger first), then name.
// No division is preferred over another.
export function orderEvents(events){
 const w={live:0,suspended:1,round_complete:2,stale:3,pre:4,final:5,unavailable:6};
 return events.slice().sort((a,b)=>(w[a.state]??9)-(w[b.state]??9)||(b.players||0)-(a.players||0)||String(a.edition?.name).localeCompare(String(b.edition?.name)));
}
export function ago(seconds){if(seconds===null||seconds===undefined)return null;if(seconds<90)return 'just now';const m=Math.round(seconds/60);if(m<60)return `${m} min ago`;const h=Math.round(m/60);return `${h} hr ago`;}
