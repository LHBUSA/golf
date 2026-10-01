// ESPN Golf adapter (owner approved 2026-10-01). sports.core.api.espn.com only: site.api returns 403
// to our identified client and is never used. Each event is fetched as one bundle, archived to R2 before
// parsing, then merged field-by-field: existing richer rows are never overwritten; disagreements are kept.
import {safeFetch,digest} from '../../shared/http.js';
import {stableId} from '../../shared/store.js';
import {Plan,slug} from './plan.js';
export const ESPN_PARSER='espn-golf/1.0.0';
export const CORE='https://sports.core.api.espn.com/v2/sports/golf';
const UA='PropBetEdgeGolfIngest/0.3 (+https://golf.propbetedge.ai; data@propbetedge.ai)';
// holes: whether hole-by-hole rows are written (bounded to protect the shared database).
export const LEAGUES={pga:{tour:'pga-tour',division:'men',label:'PGA TOUR'},lpga:{tour:'lpga',division:'women',label:'LPGA'},eur:{tour:null,division:'men',label:'DP World Tour'},'champions-tour':{tour:null,division:'men',label:'PGA TOUR Champions'},ntw:{tour:null,division:'men',label:'Korn Ferry Tour'},liv:{tour:null,division:'men',label:'LIV Golf'},'mens-olympics-golf':{tour:null,division:'men',label:'Olympic Games (men)'},'womens-olympics-golf':{tour:null,division:'women',label:'Olympic Games (women)'}};
export const idOf=ref=>String(ref||'').split('?')[0].split('/').filter(Boolean).pop()||null;
export const norm=s=>String(s||'').normalize('NFKD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z ]+/g,' ').replace(/\s+/g,' ').trim();
// Polite pacing: at least SPACING ms between request starts across the isolate; one bounded retry on 5xx.
export const SPACING=350;let nextSlot=0;
const pace=async()=>{const now=Date.now(),at=Math.max(now,nextSlot);nextSlot=at+SPACING;if(at>now)await new Promise(r=>setTimeout(r,at-now));};
export class UpstreamBusy extends Error{constructor(m){super(m);this.name='UpstreamBusy';}}
export async function getJSON(url,{fetcher}={}){
 const go=async()=>{await pace();return safeFetch(url.replace(/^http:/,'https:'),{allowedHosts:['sports.core.api.espn.com'],maxBytes:8000000,fetcher:fetcher||((u,o)=>fetch(u,{...o,headers:{...o.headers,'user-agent':UA,accept:'application/json'}}))});};
 let r;try{r=await go();}catch(e){if(!/source_http_5\d\d/.test(e.message))throw e;await new Promise(x=>setTimeout(x,2500));try{r=await go();}catch(e2){if(/source_http_5\d\d/.test(e2.message))throw new UpstreamBusy(e2.message);throw e2;}}
 return JSON.parse(r.text);
}
export async function pool(n,items,fn){const out=new Array(items.length);let i=0;await Promise.all(Array.from({length:Math.min(n,items.length)},async()=>{while(i<items.length){const k=i++;out[k]=await fn(items[k],k);}}));return out;}
// Archive an assembled bundle (all sub-request URLs listed inside) as one immutable capture.
export async function archive(env,db,url,obj){
 const bytes=new TextEncoder().encode(JSON.stringify(obj)),hash=await digest(bytes),key='golf/raw/espn/sha256/'+hash;
 await env.RAW.put(key,bytes,{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/json'}});
 const captured_at=new Date().toISOString(),id=await stableId('capture:espn:'+hash+':'+captured_at);
 await db('golf_source_captures','',{method:'POST',headers:{prefer:'return=minimal'},body:JSON.stringify({id,source_id:'espn',source_url:url.slice(0,2000),captured_at,http_status:200,sha256:hash,archive_key:key,parser_version:ESPN_PARSER,rights_version:'espn-owner-approved/golf-1'})});
 return {id,hash,key,captured_at};
}
export async function fetchEventBundle(league,eventId,opts={}){
 const base=`${CORE}/leagues/${league}/events/${eventId}`,urls=[base];
 const event=await getJSON(base,opts);
 const list=await getJSON(`${base}/competitions/${eventId}/competitors?limit=400`,opts);urls.push(`${base}/competitions/${eventId}/competitors?limit=400`);
 const items=list.items||[];
 const linescores=await pool(3,items,async c=>{const u=`${base}/competitions/${eventId}/competitors/${c.id}/linescores`;urls.push(u);try{return await getJSON(u,opts);}catch(e){if(e.name==='UpstreamBusy')throw e;return {error:String(e.message)};}});
 const maxRounds=Math.max(0,...linescores.map(l=>(l.items||[]).filter(r=>Number.isFinite(r.value)&&r.value>0).length));
 // Status (position, tie, cut/WD, playoff) only where it cannot be read from complete rounds.
 const statuses=await pool(3,items.map((c,i)=>({c,i})),async({c,i})=>{const rounds=(linescores[i].items||[]).filter(r=>Number.isFinite(r.value)&&r.value>0).length;if(rounds===maxRounds&&event.winner?.athlete&&String(idOf(event.winner.athlete.$ref)||event.winner.athlete.id)!==String(c.id))return null;const u=`${base}/competitions/${eventId}/competitors/${c.id}/status`;urls.push(u);try{return await getJSON(u,opts);}catch{return null;}});
 return {league,event_id:String(eventId),fetched_at:new Date().toISOString(),urls,event,competitors:items.map((c,i)=>({id:String(c.id),order:c.order??null,amateur:c.amateur??null,linescores:linescores[i],status:statuses[i]}))};
}
const toPar=v=>{const s=String(v??'').replace('−','-');if(s==='E')return 0;const n=Number(s);return Number.isFinite(n)?n:null;};
// Pure normalization of a bundle. Positions follow stroke-play rules from published totals; the playoff
// winner is ESPN's event winner. Missing values stay null.
export function parseEventBundle(b){
 const e=b.event,course=(e.courses||[]).find(c=>c.host)||e.courses?.[0]||null;
 const winnerId=e.winner?.athlete?String(e.winner.athlete.id||idOf(e.winner.athlete.$ref)):null;
 const rows=b.competitors.map(c=>{
  const rounds=(c.linescores?.items||[]).filter(r=>Number.isFinite(r.value)&&r.value>0).sort((x,y)=>x.period-y.period).map(r=>({round:Number(r.period),strokes:Math.round(r.value),to_par:toPar(r.displayValue),tee_time:r.teeTime||null,start_tee:Number(r.startTee)||null,group:Number(r.groupNumber)||null,position_after:Number(r.currentPosition)||null,course_id:r.courseId?String(r.courseId):null,holes:(r.linescores||[]).filter(h=>Number.isFinite(h.value)&&h.value>0&&h.period>=1&&h.period<=18).map(h=>({hole:Number(h.period),strokes:Math.round(h.value),par:Number(h.par)||null,type:h.scoreType?.name||null}))}));
  const st=c.status?.type?.name||null;
  return {espn_id:c.id,order:c.order,amateur:c.amateur,rounds,status_name:st,status_position:c.status?.position?{position:Number(c.status.position.id)||null,tied:Boolean(c.status.position.isTie)}:null,playoff:c.status?.playoff??null};
 });
 const maxRounds=Math.max(0,...rows.map(r=>r.rounds.length));
 for(const r of rows){
  r.total=r.rounds.length?r.rounds.reduce((s,x)=>s+x.strokes,0):null;
  const st=r.status_name;
  r.finish_status=st==='STATUS_CUT'?'cut':st==='STATUS_WITHDRAWN'||st==='STATUS_WD'?'withdrawn':st==='STATUS_DISQUALIFIED'||st==='STATUS_DQ'?'disqualified':r.rounds.length===maxRounds&&maxRounds>0?'finished':st?'unknown':(r.rounds.length&&r.rounds.length<maxRounds?'unknown':'unknown');
 }
 const fin=rows.filter(r=>r.finish_status==='finished'&&Number.isInteger(r.total));
 for(const r of fin){const better=fin.filter(x=>x.total<r.total).length,same=fin.filter(x=>x.total===r.total).length;r.position=better+1;r.tied=same>1;}
 if(winnerId){const w=fin.find(r=>r.espn_id===winnerId);if(w&&w.tied){const others=fin.filter(x=>x!==w&&x.total===w.total);w.tied=false;w.playoff_won=true;for(const o of others){o.position=2;o.tied=others.length>1;}}}
 for(const r of rows)r.winner=r.espn_id===winnerId&&r.finish_status==='finished';
 const holes=(course?.holes||[]).map(h=>({hole:Number(h.number),par:Number(h.shotsToPar)||null,yards:Number(h.totalYards)||null})).filter(h=>h.hole>=1&&h.hole<=18).sort((a,b)=>a.hole-b.hole);
 return {event:{espn_id:b.event_id,league:b.league,name:e.name,starts_on:e.date?.slice(0,10)||null,ends_on:e.endDate?.slice(0,10)||null,completed:Boolean(e.status?.type?.completed),status_name:e.status?.type?.name||null,purse:Number(e.purse)||null,purse_text:e.displayPurse||null,tournament_id:(String(e.tournament?.$ref||'').match(/tournaments\/(\d+)/)||[])[1]||null,defending_champion_espn:e.defendingChampion?.athlete?String(e.defendingChampion.athlete.id||idOf(e.defendingChampion.athlete.$ref)):null,winner_espn:winnerId,rounds_played:maxRounds,playoff_type:e.playoffType?.description||null},
  course:course?{espn_id:String(course.id),name:course.name,city:course.address?.city||null,state:course.address?.state?.trim()||null,country:course.address?.country||null,par:Number(course.shotsToPar)||null,yards:Number(course.totalYards)||null,holes:holes.length===18?holes:[]}:null,rows};
}
// Identity: an ESPN athlete joins a canonical player only on exact normalized name AND corroboration
// (same birth date, or the candidate already appears in this same edition). Otherwise: new ESPN-keyed
// player when no namesake exists, or HOLD when an uncorroborated namesake exists.
export function resolveAthlete(a,{crosswalk,byName,editionPlayers}){
 if(crosswalk.has(a.espn_id))return {status:'resolved',player_id:crosswalk.get(a.espn_id),basis:'espn_crosswalk'};
 const cands=byName.get(norm(a.name))||[];
 if(!cands.length)return {status:'new',basis:'no canonical namesake; ESPN athlete id is the identity'};
 const dob=a.birth_date;
 const byDob=dob?cands.filter(c=>c.birth_date===dob):[];
 if(byDob.length===1)return {status:'resolved',player_id:byDob[0].id,basis:'exact name + exact birth date'};
 // Candidate with only a birth year on record: exact name + same birth year (and no conflicting full date).
 const byYear=dob?cands.filter(c=>!c.birth_date&&c.birth_year&&String(c.birth_year)===dob.slice(0,4)):[];
 if(byDob.length===0&&byYear.length===1)return {status:'resolved',player_id:byYear[0].id,basis:'exact name + birth year (candidate has year precision only)'};
 const inEdition=cands.filter(c=>editionPlayers?.has(c.id)&&(!dob||!c.birth_date||c.birth_date===dob));
 if(inEdition.length===1)return {status:'resolved',player_id:inEdition[0].id,basis:'exact name + same edition in another source'+(dob&&inEdition[0].birth_date?' + birth date':'')};
 return {status:'hold',reason:cands.length>1?'multiple_namesakes':'namesake_without_corroboration',candidates:cands.map(c=>c.id)};
}
export function athleteFacts(a,college){
 return {espn_id:String(a.id),uid:a.uid||null,name:a.fullName||a.displayName||null,first:a.firstName||null,last:a.lastName||null,gender:a.gender||null,birth_date:a.dateOfBirth?a.dateOfBirth.slice(0,10):null,birth_place:a.birthPlace?{city:a.birthPlace.city?.trim()||null,state:a.birthPlace.state?.trim()||null,country:a.birthPlace.country||null}:null,citizenship:a.citizenship||null,college:college?{espn_id:college.id,name:college.name||college.shortName||null}:null,turned_pro:Number(a.turnedPro)||null,debut_year:Number(a.debutYear)||null,hand:a.hand?.displayValue||null,height_in:Number(a.height)||null,weight_lb:Number(a.weight)||null,headshot:a.headshot?.href||null,amateur:a.amateur??null,status:a.status?.type||null};
}
