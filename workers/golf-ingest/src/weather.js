// Course weather lane: NOAA/NWS (US public domain) hourly forecasts for upcoming US tournament courses.
// Forecasts are snapshots with the issuer's update time; they are never relabelled as current later.
import {capture,sparql} from './capture.js';
import {venuesQuery,parseVenues} from './wdqs.js';
export const WX_PARSER='nws-hourly/1.0.0';
const num=v=>v===null||v===undefined?null:Number.isFinite(Number(v))?Number(v):null;
export const mph=s=>{const m=String(s||'').match(/(\d+)(?:\s*to\s*(\d+))?\s*mph/);return m?Number(m[2]||m[1]):null;};
const COMPASS=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
export const bearing=c=>{const i=COMPASS.indexOf(String(c||'').toUpperCase());return i<0?null:i*22.5;};
// Wind relative to a hole bearing (direction of play). Wind direction is where wind blows FROM.
// Positive headwind = into the player; positive cross = left-to-right for the player.
export function windComponents(windFromDeg,speed,holeDeg){
 if(windFromDeg===null||holeDeg===null||speed===null||speed===undefined)return null;
 const toRad=d=>d*Math.PI/180,rel=toRad(windFromDeg-holeDeg);
 const head=Math.round(speed*Math.cos(rel)*10)/10,cross=Math.round(-speed*Math.sin(rel)*10)/10;
 return {headwind:head,crosswind:cross,label:Math.abs(head)>=Math.abs(cross)?(head>0?'HEADWIND':'TAILWIND'):(cross>0?'CROSSWIND LEFT→RIGHT':'CROSSWIND RIGHT→LEFT')};
}
export function parseHourly(body,gusts=new Map()){
 const p=body?.properties;if(!p?.periods)return null;
 return {update_time:p.updateTime||null,generated_at:p.generatedAt||null,hours:p.periods.map(h=>({t:h.startTime,temp_f:num(h.temperature),wind_mph:mph(h.windSpeed),wind_dir:h.windDirection||null,wind_from_deg:bearing(h.windDirection),gust_mph:gusts.get(h.startTime.slice(0,13))??null,pop:num(h.probabilityOfPrecipitation?.value),dewpoint_c:h.dewpoint?.value===undefined?null:Math.round(h.dewpoint.value*10)/10,rh:num(h.relativeHumidity?.value),short:h.shortForecast||null}))};
}
// Gusts come from the gridpoint raw layer as ISO intervals in km/h.
export function parseGusts(raw){
 const out=new Map();for(const v of raw?.properties?.windGust?.values||[]){const [start,dur]=String(v.validTime).split('/');const hrs=Number((dur.match(/(\d+)H/)||[])[1]||0)+24*Number((dur.match(/(\d+)D/)||[])[1]||0)||1;const t0=Date.parse(start);for(let i=0;i<hrs;i++){const k=new Date(t0+i*3600000).toISOString().slice(0,13);if(v.value!==null)out.set(k,Math.round(v.value*0.621371));}}
 out.updated=out.forecasts; // marks the projection dirty so edition pages carry the new snapshot
 return out;
}
async function resolveCoords(env,db,course,espnCourse){
 const s=await capture(env,db,'wikidata','https://www.wikidata.org/w/api.php?'+new URLSearchParams({action:'wbsearchentities',search:course.name.replace(/\s*\(.*\)$/,''),language:'en',type:'item',limit:'7',format:'json'}),{parser:WX_PARSER});
 const hits=(JSON.parse(s.text).search||[]).map(x=>x.id);if(!hits.length)return null;
 const vs=parseVenues((await sparql(env,db,venuesQuery(hits),WX_PARSER)).rows);
 const place=[espnCourse?.city,espnCourse?.state].filter(Boolean).map(x=>x.toLowerCase());
 const ok=vs.filter(v=>v.golf_venue&&Number.isFinite(v.latitude)&&place.some(p=>(v.locality||'').toLowerCase().includes(p)||(v.description||'').toLowerCase().includes(p)));
 return ok.length===1?{...ok[0],capture_id:s.id}:null;
}
const PLACE=/(city|town|census-designated place|village|community|borough)/i;
const STATES={AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming'};
// Town-level fallback: a Wikidata place whose description names the US state. Labelled precision 'locality'.
async function resolveLocality(env,db,city,state){
 const st=STATES[state]||state;if(!city||!st)return null;
 const s=await capture(env,db,'wikidata','https://www.wikidata.org/w/api.php?'+new URLSearchParams({action:'wbsearchentities',search:city,language:'en',type:'item',limit:'10',format:'json'}),{parser:WX_PARSER});
 const hits=(JSON.parse(s.text).search||[]).filter(x=>x.label?.toLowerCase()===city.toLowerCase()&&PLACE.test(x.description||'')&&(x.description||'').includes(st));
 if(hits.length!==1)return null;
 const g=await capture(env,db,'wikidata','https://www.wikidata.org/w/api.php?'+new URLSearchParams({action:'wbgetentities',ids:hits[0].id,props:'claims',format:'json'}),{parser:WX_PARSER});
 const c=JSON.parse(g.text).entities?.[hits[0].id]?.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
 return c&&Number.isFinite(c.latitude)?{qid:hits[0].id,latitude:c.latitude,longitude:c.longitude,label:`${city}, ${state}`,capture_id:g.id}:null;
}
export async function runWeather(env,db,{now=new Date()}={}){
 const today=now.toISOString().slice(0,10),horizon=new Date(now.getTime()+8*86400000).toISOString().slice(0,10);
 const eds=await db('golf_tournament_editions',`select=id,ends_on,starts_on,status,rules&ends_on=gte.${today}&ends_on=lte.${horizon}&status=neq.cancelled`);
 const out={lane:'weather',editions:eds.length,forecasts:0,coords_resolved:0,skipped:[]};
 for(const e of eds){let stage='course';try{
  if(e.rules?.superseded_by)continue;
  const ec=(await db('golf_edition_courses',`select=golf_course_layouts(course_id)&edition_id=eq.${e.id}`))[0]?.golf_course_layouts?.course_id;
  const espnCourse=e.rules?.espn?.course;
  let c=ec?(await db('golf_courses',`select=id,name,latitude,longitude,country_code,capture_id&id=eq.${ec}`))[0]:null;
  if(!c&&!espnCourse){out.skipped.push({edition:e.id,reason:'no_course'});continue;}
  const us=c?.country_code==='US'||espnCourse?.country==='USA';
  if(!us){out.skipped.push({edition:e.id,reason:'outside_nws_coverage'});continue;}
  stage='coords';let precision='venue',locality=null;
  if(!c||c.latitude==null||c.longitude==null){
   const v=c?await resolveCoords(env,db,c,espnCourse):null;
   if(v){await db('golf_courses','id=eq.'+c.id,{method:'PATCH',headers:{prefer:'return=minimal'},body:JSON.stringify({latitude:v.latitude,longitude:v.longitude})});
    await db('golf_source_changes','',{method:'POST',headers:{prefer:'return=minimal'},body:JSON.stringify({capture_id:v.capture_id,entity_table:'golf_courses',entity_id:c.id,field_changes:{before:{latitude:c.latitude,longitude:c.longitude},after:{latitude:v.latitude,longitude:v.longitude},basis:'Wikidata '+v.qid+' golf venue matching ESPN city/state'},previous_capture_id:c.capture_id})});
    c={...c,latitude:v.latitude,longitude:v.longitude};out.coords_resolved++;}
   else{const l=await resolveLocality(env,db,espnCourse?.city,espnCourse?.state);if(!l){out.skipped.push({edition:e.id,reason:'coordinates_unverified'});continue;}
    precision='locality';locality={label:l.label,wikidata:l.qid};c={...(c||{}),latitude:l.latitude,longitude:l.longitude};}
  }
  const lat=Number(c.latitude).toFixed(4),lon=Number(c.longitude).toFixed(4);
  stage='nws_points';const pt=await capture(env,db,'nws',`https://api.weather.gov/points/${lat},${lon}`,{parser:WX_PARSER,accept:'application/geo+json'});const pp=JSON.parse(pt.text).properties;
  stage='nws_hourly';const hourly=await capture(env,db,'nws',pp.forecastHourly,{parser:WX_PARSER,accept:'application/geo+json',maxBytes:4000000});
  let gusts=new Map();try{const raw=await capture(env,db,'nws',pp.forecastGridData,{parser:WX_PARSER,accept:'application/geo+json',maxBytes:8000000});gusts=parseGusts(JSON.parse(raw.text));}catch{}
  const f=parseHourly(JSON.parse(hourly.text),gusts);if(!f){out.skipped.push({edition:e.id,reason:'forecast_unavailable'});continue;}
  const doc={edition_id:e.id,course_id:c.id||null,precision,locality,course_name:c.name||espnCourse?.name||null,lat:Number(lat),lon:Number(lon),timezone:pp.timeZone||null,source:'NOAA National Weather Service (public domain)',office:pp.gridId,grid:[pp.gridX,pp.gridY],forecast_update_time:f.update_time,generated_at:f.generated_at,fetched_at:hourly.captured_at,capture_id:hourly.id,hours:f.hours};
  await env.PUBLIC.put(`weather/v1/forecast/${e.id}.json`,JSON.stringify(doc),{httpMetadata:{contentType:'application/json'}});out.forecasts++;
 }catch(err){out.skipped.push({edition:e.id,reason:'error',stage,error:String(err.message).slice(0,160)});}}
 out.updated=out.forecasts; // marks the projection dirty so edition pages carry the new snapshot
 return out;
}
