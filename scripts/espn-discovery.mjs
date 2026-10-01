// ESPN Golf discovery audit (sports.core.api only; site.api returns 403 to our identified client).
// Bounded, spaced requests with an honest User-Agent; records what each resource exposes.
import fs from 'node:fs/promises';
const UA='PropBetEdgeGolfIngest/0.3 (+https://golf.propbetedge.ai; data@propbetedge.ai)',CORE='https://sports.core.api.espn.com/v2/sports/golf';
let n=0;const get=async u=>{await new Promise(r=>setTimeout(r,700));n++;const r=await fetch(u,{headers:{'user-agent':UA,accept:'application/json'},redirect:'manual',signal:AbortSignal.timeout(30000)});const t=await r.text();let j=null;try{j=JSON.parse(t);}catch{}return {status:r.status,json:j,bytes:t.length};};
const id=ref=>String(ref).split('?')[0].split('/').pop();
const leagues=['pga','lpga','eur','champions-tour','ntw','liv','mens-olympics-golf','womens-olympics-golf','tgl'];
const out={generated_at:new Date().toISOString(),base:CORE,site_api:'403 Access Denied (Akamai) for identified User-Agent; not used',leagues:{}};
for(const L of leagues){
 const rep={};out.leagues[L]=rep;
 const s=await get(`${CORE}/leagues/${L}/seasons?limit=200`);const seasons=(s.json?.items||[]).map(i=>Number(id(i.$ref))).filter(Boolean).sort();
 rep.seasons={status:s.status,count:seasons.length,earliest:seasons[0]||null,latest:seasons.at(-1)||null};
 // probe the latest season with completed events, then the earliest season
 const probe=async year=>{const types=await get(`${CORE}/leagues/${L}/seasons/${year}/types?limit=10`);const typeIds=(types.json?.items||[]).map(i=>id(i.$ref));
  const res={year,types:typeIds,events:0};
  for(const t of typeIds){const ev=await get(`${CORE}/leagues/${L}/seasons/${year}/types/${t}/events?limit=200`);res.events+=ev.json?.count||0;if(!res.sample_events)res.sample_events=(ev.json?.items||[]).map(i=>id(i.$ref));}
  return res;};
 const now=new Date().getUTCFullYear();
 const yrs=[...new Set([seasons.includes(now)?now:seasons.at(-1),seasons[0],seasons.includes(2010)?2010:null].filter(Boolean))];
 rep.probes=[];
 for(const y of yrs){const p=await probe(y);rep.probes.push(p);
  // find a completed event in this season and inspect its resources
  for(const ev of (p.sample_events||[]).slice(0,40)){
   const e=await get(`${CORE}/leagues/${L}/events/${ev}`);if(!e.json?.status?.type?.completed)continue;
   const comp=e.json.competitions?.[0]||{},course=e.json.courses?.[0]||{};
   const c=await get(`${CORE}/leagues/${L}/events/${ev}/competitions/${ev}/competitors?limit=300`);const first=c.json?.items?.[0];
   const info={event:ev,name:e.json.name,date:e.json.date,end:e.json.endDate,purse:e.json.displayPurse||null,course:course.name||null,course_holes:(course.holes||[]).length,course_address:course.address||null,venue:Boolean(e.json.venues?.length),competitors:c.json?.count??null,flags:Object.fromEntries(['playByPlayAvailable','shotChartAvailable','boxscoreAvailable'].map(k=>[k,comp[k]])),sources:{linescore:comp.linescoreSource?.state,holeByHole:comp.holeByHoleSource?.state,stats:comp.statsSource?.state,playByPlay:comp.playByPlaySource?.state}};
   if(first){const base=`${CORE}/leagues/${L}/events/${ev}/competitions/${ev}/competitors/${first.id}`;
    const ls=await get(base+'/linescores');const r1=ls.json?.items?.[0];info.linescores={status:ls.status,rounds:ls.json?.count??0,holes_in_round1:(r1?.linescores||[]).length,tee_time:Boolean(r1?.teeTime),start_tee:r1?.startTee??null,group:r1?.groupNumber??null};
    const st=await get(base+'/statistics');info.player_event_stats=(st.json?.splits?.categories||[]).flatMap(x=>x.stats.map(s=>s.name));
    const pl=await get(`${CORE}/leagues/${L}/events/${ev}/competitions/${ev}/plays?limit=5`);info.plays={status:pl.status,count:pl.json?.count??null};
    const a=await get(`${CORE}/leagues/${L}/athletes/${first.id}`);info.athlete_fields=a.json?Object.keys(a.json).filter(k=>a.json[k]!==null&&a.json[k]!==''):[];info.athlete_has={college:Boolean(a.json?.college),dob:Boolean(a.json?.dateOfBirth),birthPlace:Boolean(a.json?.birthPlace),turnedPro:Boolean(a.json?.turnedPro),hand:Boolean(a.json?.hand),headshot:Boolean(a.json?.headshot)};
    const ss=await get(`${CORE}/leagues/${L}/seasons/${y}/types/2/athletes/${first.id}/statistics`);info.season_stats=(ss.json?.splits?.categories||[]).flatMap(x=>x.stats.map(s=>s.name));
   }
   p.completed_event=info;break;
  }
 }
 console.log(L,JSON.stringify(rep.seasons),rep.probes.map(p=>p.year+':'+p.events+' ev'+(p.completed_event?` holes=${p.completed_event.linescores?.holes_in_round1} plays=${p.completed_event.plays?.count} stats=${p.completed_event.season_stats?.length}`:' none')).join(' | '));
}
out.requests=n;
await fs.writeFile('docs/evidence/espn-discovery.json',JSON.stringify(out,null,1));
