// Now / Next schedule logic. Pure and date-only (UTC calendar days). Never produces a "live" state:
// no approved real-time scoring exists, so an event inside its dates is a tournament window, not live.
export const TOURS=[{key:'pga-tour',label:'PGA TOUR',name:'PGA Tour',division:'men'},{key:'lpga',label:'LPGA',name:'LPGA Tour',division:'women'}];
const day=s=>Date.parse(s+'T00:00:00Z');
const iso=t=>new Date(t).toISOString().slice(0,10);
// Monday-start week containing `today`.
export function weekBounds(today){const t=day(today),dow=(new Date(t).getUTCDay()+6)%7;return {start:iso(t-dow*86400000),end:iso(t+(6-dow)*86400000)};}
export function daysBetween(a,b){return Math.round((day(b)-day(a))/86400000);}
// state: completed | this_week | upcoming | cancelled ; window: tournament_window | final_round_this_week | starts_this_week | null
export function eventState(e,today){
 if(e.status==='cancelled')return {state:'cancelled',window:null};
 const end=e.ends_on,start=e.starts_on,wk=weekBounds(today);
 if(e.winner||e.status==='completed'||(end&&end<today))return {state:'completed',window:null};
 if(start&&end&&start<=today&&today<=end)return {state:'this_week',window:'tournament_window'};
 if(!start&&end&&end>=today&&end<=wk.end)return {state:'this_week',window:'final_round_this_week'};
 if(start&&start>today&&start<=wk.end)return {state:'this_week',window:'starts_this_week'};
 if(end&&end>wk.end)return {state:'upcoming',window:null};
 return {state:'unknown',window:null};
}
export function stateLabel(s){return {tournament_window:'THIS WEEK · TOURNAMENT WINDOW',final_round_this_week:'THIS WEEK',starts_this_week:'THIS WEEK · STARTS SOON'}[s.window]||{completed:'COMPLETED',upcoming:'UP NEXT',cancelled:'CANCELLED',unknown:'DATE UNCONFIRMED'}[s.state];}
// Per tour: events this week, the next event after this week, and the latest completed event.
export function nowNext(events,today){
 return TOURS.map(t=>{
  const mine=events.filter(e=>(e.tours||[]).includes(t.name)).map(e=>({...e,...eventState(e,today)}));
  const byEnd=(a,b)=>String(a.ends_on||'').localeCompare(String(b.ends_on||''));
  const thisWeek=mine.filter(e=>e.state==='this_week').sort(byEnd);
  const upcoming=mine.filter(e=>e.state==='upcoming').sort(byEnd);
  const completed=mine.filter(e=>e.state==='completed'&&e.ends_on&&e.ends_on<=today).sort(byEnd).reverse();
  return {tour:t,this_week:thisWeek,up_next:upcoming[0]||null,later:upcoming.slice(1,4),last_completed:completed[0]||null};
 });
}
// The next event across tours, for the compact navigation cue.
export function nextCue(events,today){
 const all=nowNext(events,today);const cands=all.flatMap(t=>[...t.this_week,t.up_next].filter(Boolean).map(e=>({...e,tour:t.tour})));
 return cands.sort((a,b)=>String(a.ends_on).localeCompare(String(b.ends_on)))[0]||null;
}
