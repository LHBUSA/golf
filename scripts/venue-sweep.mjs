// Venue-resolution sweep over courses without coordinates. Dry run reports levels; --apply stores EXACT COURSE
// coordinates on golf_courses with a golf_source_changes audit row (complex/locality never become course coords).
import fs from 'node:fs/promises';
import {store} from '../workers/shared/store.js';import {sportsEnv} from './ops.mjs';import {wikipediaCandidates,classifyCandidate} from '../workers/golf-ingest/src/venues.js';
const APPLY=process.argv.includes('--apply'),db=store(await sportsEnv());
const b=JSON.parse(await fs.readFile('data/public/bundle.json','utf8'));
const country=new Map();for(const e of b.editions){const ec=e.espn?.course;if(e.course?.id&&ec?.country)country.set(e.course.id,ec.country);}
const courses=b.courses.filter(c=>c.latitude==null);
const fj=async u=>{await new Promise(r=>setTimeout(r,400));const r=await fetch(u,{headers:{'user-agent':'PropBetEdgeGolf/0.1 (+https://golf.propbetedge.ai)'}});return r.json();};
const out={generated_at:new Date().toISOString(),apply:APPLY,before:{courses:b.courses.length,with_coordinates:b.courses.length-courses.length},levels:{course:0,course_complex:0,none:0},results:[]};
for(const c of courses){const cty=country.get(c.id)||c.country||null;let cands=[];try{cands=await wikipediaCandidates(fj,c.name);}catch{}
 const hits=cands.map(x=>({x,cl:classifyCandidate(x,{course:c.name,country:cty})})).filter(h=>h.cl?.level);
 const exact=hits.filter(h=>h.cl.level==='course'),pick=exact.length===1?exact[0]:!exact.length&&hits.length===1?hits[0]:null;
 const level=pick?pick.cl.level:'none';out.levels[level]++;out.results.push({course:c.slug,name:c.name,country:cty,level,match:pick?.x.title||null,lat:pick?.x.lat??null,lon:pick?.x.lon??null,ambiguous:exact.length>1});
 if(APPLY&&level==='course'){const row=(await db('golf_courses','select=id,capture_id,latitude&id=eq.'+c.id))[0];if(row&&row.latitude==null){
  await db('golf_courses','id=eq.'+c.id,{method:'PATCH',headers:{prefer:'return=minimal'},body:JSON.stringify({latitude:pick.x.lat,longitude:pick.x.lon})});
  await db('golf_source_changes','',{method:'POST',headers:{prefer:'return=minimal'},body:JSON.stringify({capture_id:row.capture_id,entity_table:'golf_courses',entity_id:c.id,field_changes:{after:{latitude:pick.x.lat,longitude:pick.x.lon},basis:`Wikipedia article "${pick.x.title}" is the course (${country.get(c.id)||'country unchecked'})`},previous_capture_id:row.capture_id})});}}
}
await fs.writeFile('docs/evidence/venue-sweep.json',JSON.stringify(out,null,1));
console.log(JSON.stringify({before:out.before,checked:courses.length,levels:out.levels,sample:out.results.filter(r=>r.level!=='none').slice(0,10).map(r=>[r.name,r.level,r.match])}));
