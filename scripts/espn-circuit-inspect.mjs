// Paced inspection of ESPN core coverage per circuit (approved API only, ~6 requests per circuit).
// Writes docs/evidence/espn-circuits.json; merged into docs/ESPN_COVERAGE.md by scripts/espn-coverage.mjs.
import fs from 'node:fs/promises';
const CORE='https://sports.core.api.espn.com/v2/sports/golf',UA='PropBetEdgeGolfIngest/0.3 (+https://golf.propbetedge.ai; data@propbetedge.ai)';
const disc=JSON.parse(await fs.readFile('docs/evidence/espn-discovery.json','utf8'));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const get=async u=>{await sleep(600);const r=await fetch(u.replace(/^http:/,'https:'),{headers:{'user-agent':UA,accept:'application/json'}});return r.ok?r.json():{__status:r.status};};
const out={generated_at:new Date().toISOString(),circuits:{}};
for(const [lg,v] of Object.entries(disc.leagues)){
 const ce=(v.probes||[]).find(p=>p.completed_event)?.completed_event;const res={event:ce?.event||null};
 if(ce?.event){
  const base=`${CORE}/leagues/${lg}/events/${ce.event}/competitions/${ce.event}`;
  const list=await get(`${base}/competitors?limit=5`);const cid=String(list.items?.[0]?.$ref||'').split('competitors/')[1]?.split('?')[0];
  res.competitors=list.count??null;
  if(cid){const a=await get(`${CORE}/leagues/${lg}/athletes/${cid}`);
   res.bio={status:a.__status||200,dob:Boolean(a.dateOfBirth),birthplace:Boolean(a.birthPlace?.city||a.birthPlace?.country),college:Boolean(a.college?.$ref||a.college?.name),turned_pro:Boolean(a.turnedPro||a.debutYear),hand:Boolean(a.hand?.displayValue),headshot:Boolean(a.headshot?.href)};
   const st=await get(`${CORE}/leagues/${lg}/seasons/${ce.date?.slice(0,4)||v.seasons?.latest}/types/2/athletes/${cid}/statistics`);
   res.season_stats={status:st.__status||200,categories:(st.splits?.categories||[]).length,stats:(st.splits?.categories||[]).reduce((s,c)=>s+(c.stats||[]).length,0)};
   const ev=await get(`${CORE}/leagues/${lg}/events/${ce.event}`);const course=(ev.courses||[])[0];
   res.venue={course:Boolean(course?.name),address:Boolean(course?.address?.city||course?.address?.country),holes:(course?.holes||[]).length,coordinates:Boolean(course?.address?.latitude||course?.latitude)};
  }
 }
 out.circuits[lg]=res;console.log(lg,JSON.stringify(res));
}
await fs.writeFile('docs/evidence/espn-circuits.json',JSON.stringify(out,null,1));
