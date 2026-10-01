// Course weather lane: NOAA/NWS (US, public domain) and MET Norway (global, CC BY 4.0) hourly forecasts.
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
const PLACE=/(city|town|census-designated place|village|community|borough|municipality|ward|suburb|human settlement|capital)/i;
const STATES={AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming'};
// Town-level fallback: a Wikidata place whose description names the region (US state or country). Precision 'locality'.
async function resolveLocality(env,db,city,region){
 const st=STATES[region]||region;if(!city||!st)return null;
 const s=await capture(env,db,'wikidata','https://www.wikidata.org/w/api.php?'+new URLSearchParams({action:'wbsearchentities',search:city,language:'en',type:'item',limit:'10',format:'json'}),{parser:WX_PARSER});
 const hits=(JSON.parse(s.text).search||[]).filter(x=>x.label?.toLowerCase()===city.toLowerCase()&&PLACE.test(x.description||'')&&(x.description||'').toLowerCase().includes(st.toLowerCase()));
 if(hits.length!==1)return null;
 const g=await capture(env,db,'wikidata','https://www.wikidata.org/w/api.php?'+new URLSearchParams({action:'wbgetentities',ids:hits[0].id,props:'claims',format:'json'}),{parser:WX_PARSER});
 const c=JSON.parse(g.text).entities?.[hits[0].id]?.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
 return c&&Number.isFinite(c.latitude)?{qid:hits[0].id,latitude:c.latitude,longitude:c.longitude,label:`${city}, ${region}`,capture_id:g.id}:null;
}
// ---------------- venue-coordinate registry (KV): resolved and unresolved venues are remembered.
// status: course (Wikidata golf venue) | locality (town estimate) | unknown (retried after 7 days)
const GEO_KEY='geo:venues:v1',RETRY_MS=7*86400000;
async function geoRegistry(env){try{return JSON.parse(await env.STATE.get(GEO_KEY)||'{}');}catch{return {};}}
export function geoKey(courseId,espnCourse){return courseId?'course:'+courseId:'loc:'+[espnCourse?.city,espnCourse?.state,espnCourse?.country].filter(Boolean).join('|').toLowerCase();}
async function resolveGeo(env,db,reg,{c,espnCourse,now}){
 const key=geoKey(c?.id,espnCourse),hit=reg[key];
 if(c?.latitude!=null&&c?.longitude!=null)return reg[key]={status:'course',lat:Number(c.latitude),lon:Number(c.longitude),label:c.name,basis:'course record coordinates (Wikidata golf venue)',checked_at:now.toISOString()};
 if(hit&&(hit.status!=='unknown'||Date.parse(hit.retry_after)>now.getTime()))return hit;
 const v=c?await resolveCoords(env,db,c,espnCourse):null;
 if(v){await db('golf_courses','id=eq.'+c.id,{method:'PATCH',headers:{prefer:'return=minimal'},body:JSON.stringify({latitude:v.latitude,longitude:v.longitude})});
  await db('golf_source_changes','',{method:'POST',headers:{prefer:'return=minimal'},body:JSON.stringify({capture_id:v.capture_id,entity_table:'golf_courses',entity_id:c.id,field_changes:{before:{latitude:c.latitude,longitude:c.longitude},after:{latitude:v.latitude,longitude:v.longitude},basis:'Wikidata '+v.qid+' golf venue matching ESPN city/region'},previous_capture_id:c.capture_id})});
  return reg[key]={status:'course',lat:v.latitude,lon:v.longitude,label:c.name,qid:v.qid,basis:'Wikidata golf venue '+v.qid,checked_at:now.toISOString()};}
 const l=await resolveLocality(env,db,espnCourse?.city,espnCourse?.state||espnCourse?.country);
 if(l)return reg[key]={status:'locality',lat:l.latitude,lon:l.longitude,label:l.label,qid:l.qid,basis:'Wikidata place '+l.qid+' (town-level estimate)',checked_at:now.toISOString()};
 return reg[key]={status:'unknown',lat:null,lon:null,label:[espnCourse?.city,espnCourse?.state||espnCourse?.country].filter(Boolean).join(', ')||null,basis:'no verified venue or unique town match',checked_at:now.toISOString(),retry_after:new Date(now.getTime()+RETRY_MS).toISOString()};
}
// ---------------- MET Norway (global; CC BY 4.0). Times are converted to the venue's local zone.
const TZ={US:null,GB:'Europe/London',IE:'Europe/Dublin',JP:'Asia/Tokyo',KR:'Asia/Seoul',CN:'Asia/Shanghai',TW:'Asia/Taipei',TH:'Asia/Bangkok',SG:'Asia/Singapore',MY:'Asia/Kuala_Lumpur',IN:'Asia/Kolkata',AE:'Asia/Dubai',SA:'Asia/Riyadh',QA:'Asia/Qatar',BH:'Asia/Bahrain',ZA:'Africa/Johannesburg',KE:'Africa/Nairobi',MU:'Indian/Mauritius',MA:'Africa/Casablanca',ES:'Europe/Madrid',PT:'Europe/Lisbon',FR:'Europe/Paris',DE:'Europe/Berlin',IT:'Europe/Rome',NL:'Europe/Amsterdam',BE:'Europe/Brussels',CH:'Europe/Zurich',AT:'Europe/Vienna',CZ:'Europe/Prague',DK:'Europe/Copenhagen',SE:'Europe/Stockholm',NO:'Europe/Oslo',FI:'Europe/Helsinki',PL:'Europe/Warsaw',NZ:'Pacific/Auckland',DO:'America/Santo_Domingo',PR:'America/Puerto_Rico',BM:'Atlantic/Bermuda',BS:'America/Nassau',CO:'America/Bogota',PA:'America/Panama',CL:'America/Santiago',CR:'America/Costa_Rica'};
const COUNTRY_ISO={'Japan':'JP','Scotland':'GB','England':'GB','Wales':'GB','Northern Ireland':'GB','United Kingdom':'GB','Ireland':'IE','South Korea':'KR','Korea':'KR','China':'CN','Taiwan':'TW','Thailand':'TH','Singapore':'SG','Malaysia':'MY','India':'IN','United Arab Emirates':'AE','UAE':'AE','Saudi Arabia':'SA','Qatar':'QA','Bahrain':'BH','South Africa':'ZA','Kenya':'KE','Mauritius':'MU','Morocco':'MA','Spain':'ES','Portugal':'PT','France':'FR','Germany':'DE','Italy':'IT','Netherlands':'NL','Belgium':'BE','Switzerland':'CH','Austria':'AT','Czech Republic':'CZ','Denmark':'DK','Sweden':'SE','Norway':'NO','Finland':'FI','Poland':'PL','New Zealand':'NZ','Dominican Republic':'DO','Puerto Rico':'PR','Bermuda':'BM','Bahamas':'BS','Colombia':'CO','Panama':'PA','Chile':'CL','Costa Rica':'CR'};
export function zoneFor(countryCode,countryName,lon){const iso=countryCode||COUNTRY_ISO[countryName];const tz=iso?TZ[iso]:null;return tz?{tz,basis:'country time zone'}:{tz:null,basis:'approximate solar time (UTC'+(Math.round(lon/15)>=0?'+':'')+Math.round(lon/15)+')',offset_hours:Math.round(lon/15)};}
export function localIso(ms,zone){
 if(zone.tz){const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone.tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(ms)).map(x=>[x.type,x.value]));
  const local=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute),off=Math.round((local-ms)/60000),sg=off>=0?'+':'-',a=Math.abs(off);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00${sg}${String(Math.floor(a/60)).padStart(2,'0')}:${String(a%60).padStart(2,'0')}`;}
 const off=zone.offset_hours,d=new Date(ms+off*3600000).toISOString().slice(0,16),sg=off>=0?'+':'-';return `${d}:00${sg}${String(Math.abs(off)).padStart(2,'0')}:00`;
}
const COMPASS16=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
export const compass=deg=>deg===null||deg===undefined?null:COMPASS16[Math.round(((deg%360)+360)%360/22.5)%16];
export function parseMet(body,zone){
 const ts=body?.properties?.timeseries;if(!ts?.length)return null;
 const num=v=>Number.isFinite(v)?v:null,r=(v,f=1)=>v===null?null:Math.round(v*f);
 return {update_time:body.properties.meta?.updated_at||null,hours:ts.filter(t=>t.data?.next_1_hours).map(t=>{const d=t.data.instant.details||{},n1=t.data.next_1_hours?.details||{};const c=num(d.air_temperature),w=num(d.wind_speed),g=num(d.wind_speed_of_gust),dir=num(d.wind_from_direction);
  return {t:localIso(Date.parse(t.time),zone),utc:t.time,temp_f:c===null?null:Math.round(c*9/5+32),wind_mph:r(w,2.23694),wind_from_deg:dir===null?null:Math.round(dir),wind_dir:compass(dir),gust_mph:r(g,2.23694),pop:num(n1.probability_of_precipitation),precip_mm:num(n1.precipitation_amount),rh:num(d.relative_humidity),pressure_hpa:num(d.air_pressure_at_sea_level),short:t.data.next_1_hours?.summary?.symbol_code||null};})};
}
async function nwsForecast(env,db,lat,lon){
 const pt=await capture(env,db,'nws',`https://api.weather.gov/points/${lat},${lon}`,{parser:WX_PARSER,accept:'application/geo+json'});const pp=JSON.parse(pt.text).properties;
 const hourly=await capture(env,db,'nws',pp.forecastHourly,{parser:WX_PARSER,accept:'application/geo+json',maxBytes:4000000});
 let gusts=new Map();try{const raw=await capture(env,db,'nws',pp.forecastGridData,{parser:WX_PARSER,accept:'application/geo+json',maxBytes:8000000});gusts=parseGusts(JSON.parse(raw.text));}catch{}
 const f=parseHourly(JSON.parse(hourly.text),gusts);if(!f)return null;
 return {provider:'NOAA NWS',source:'NOAA National Weather Service (public domain)',licence:'U.S. government work',timezone:pp.timeZone||null,tz_basis:'NWS forecast office',office:pp.gridId,grid:[pp.gridX,pp.gridY],forecast_update_time:f.update_time,generated_at:f.generated_at,fetched_at:hourly.captured_at,capture_id:hourly.id,hours:f.hours};
}
async function metForecast(env,db,lat,lon,zone,now){
 // Respect the provider's Expires header: reuse the stored forecast until it expires.
 const k='wx:metno:'+lat+','+lon,meta=JSON.parse(await env.STATE.get(k)||'null');
 if(meta?.expires&&Date.parse(meta.expires)>now.getTime()&&meta.doc)return {...meta.doc,reused:true};
 const cap=await capture(env,db,'metno',`https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=${lat}&lon=${lon}`,{parser:WX_PARSER,maxBytes:4000000});
 const f=parseMet(JSON.parse(cap.text),zone);if(!f)return null;
 const doc={provider:'MET Norway',source:'MET Norway Locationforecast (CC BY 4.0)',licence:'CC BY 4.0',licence_url:'https://api.met.no/doc/License',timezone:zone.tz,tz_basis:zone.basis,forecast_update_time:f.update_time,fetched_at:cap.captured_at,capture_id:cap.id,hours:f.hours};
 await env.STATE.put(k,JSON.stringify({expires:new Date(now.getTime()+30*60000).toISOString(),doc}),{expirationTtl:3600});
 return doc;
}
export async function runWeather(env,db,{now=new Date()}={}){
 const today=now.toISOString().slice(0,10),horizon=new Date(now.getTime()+8*86400000).toISOString().slice(0,10);
 const eds=await db('golf_tournament_editions',`select=id,ends_on,starts_on,status,rules&ends_on=gte.${today}&starts_on=lte.${horizon}&status=neq.cancelled`);
 const reg=await geoRegistry(env);
 const out={lane:'weather',editions:eds.length,forecasts:0,nws:0,metno:0,precision:{course:0,locality:0,unknown:0},skipped:[]};
 for(const e of eds){let stage='course';try{
  if(e.rules?.superseded_by)continue;
  const ec=(await db('golf_edition_courses',`select=golf_course_layouts(course_id)&edition_id=eq.${e.id}`))[0]?.golf_course_layouts?.course_id;
  const espnCourse=e.rules?.espn?.course;
  const c=ec?(await db('golf_courses',`select=id,name,latitude,longitude,country_code,capture_id&id=eq.${ec}`))[0]:null;
  if(!c&&!espnCourse){out.skipped.push({edition:e.id,reason:'no_course'});continue;}
  stage='coords';const g=await resolveGeo(env,db,reg,{c,espnCourse,now});out.precision[g.status]++;
  if(g.status==='unknown'){out.skipped.push({edition:e.id,reason:'coordinates_unverified',retry_after:g.retry_after});continue;}
  const lat=Number(g.lat).toFixed(4),lon=Number(g.lon).toFixed(4);
  const us=c?.country_code==='US'||espnCourse?.country==='USA';
  stage=us?'nws':'metno';
  const f=us?await nwsForecast(env,db,lat,lon):await metForecast(env,db,lat,lon,zoneFor(c?.country_code,espnCourse?.country,Number(lon)),now);
  if(!f){out.skipped.push({edition:e.id,reason:'forecast_unavailable'});continue;}
  const doc={edition_id:e.id,course_id:c?.id||null,precision:g.status==='course'?'venue':'locality',locality:g.status==='locality'?{label:g.label,wikidata:g.qid||null}:null,coordinate_basis:g.basis,course_name:c?.name||espnCourse?.name||null,lat:Number(lat),lon:Number(lon),...f};
  await env.PUBLIC.put(`weather/v1/forecast/${e.id}.json`,JSON.stringify(doc),{httpMetadata:{contentType:'application/json'}});out.forecasts++;out[us?'nws':'metno']++;
 }catch(err){out.skipped.push({edition:e.id,reason:'error',stage,error:String(err.message).slice(0,160)});}}
 await env.STATE.put(GEO_KEY,JSON.stringify(reg));
 out.updated=out.forecasts; // marks the projection dirty so edition pages carry the new snapshot
 return out;
}
