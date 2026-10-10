// OSM course-routing lane (ODbL). Owner-approved 2026-10-02 (docs/COURSE_MAPS.md).
//   node scripts/osm-routing.mjs collect   -> polite, resumable Overpass extracts into data/osm-cache/ (licensed archive)
//   node scripts/osm-routing.mjs prepare   -> identity match + hole proof + simplified web payloads + ODbL dataset
//                                             into data/osm-routing/v1/ (isolated store; mirrors R2 osm-routing/v1/)
//   node scripts/osm-routing.mjs upload    -> wrangler r2 put of data/osm-routing/v1/** to golf-public
// Etiquette: one query at a time, wait for a free slot per /api/status, honour 429 by waiting, a 504 is retried once
// after 90 s and then recorded as a barrier (never hammered). Every extract is cached; reruns resume deterministically.
import fs from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';
import {prepareCourseMap,ATTRIBUTION} from '../src/lib/course-map.js';
import {matchCourse,matchWithEvidence,autoIdentityOk,nameScore,subCourseTokens,norm,holdSharedTargets,outerRings,inside} from '../workers/shared/course-geo.js';
import {IDENTITY_EVIDENCE,DUPLICATE_COURSES,HUMAN_REVIEWED_LAYOUTS,ROUTING_REVOCATIONS} from '../workers/shared/course-identity.js';
import {publishRouting} from '../workers/shared/routing-parity.js';
import crypto from 'node:crypto';import os from 'node:os';
import {defaultEdition,setupOptions} from '../workers/shared/course-setup.js';

const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1')),'..');
const CACHE=path.join(ROOT,'data/osm-cache'),OUT=path.join(ROOT,'data/osm-routing/v1');
const UA='PropBetEdge-Golf-osm-routing/1.0 (golf.propbetedge.ai; course routing with ODbL attribution)';
const EP='https://overpass-api.de/api/interpreter',STATUS='https://overpass-api.de/api/status',RADIUS=2000;
const B=JSON.parse(fs.readFileSync(path.join(ROOT,'data/public/bundle.json'),'utf8'));
const courses=B.courses,edByCourse=new Map();
for(const e of B.index.editions){const k=e.course?.slug||e.course;if(!k)continue;edByCourse.set(k,[...(edByCourse.get(k)||[]),e]);}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

// Priority: current week, majors, most editions, PGA, LPGA, remainder (owner order). Deterministic tie-break by slug.
export function priority(c,now=new Date()){
 const eds=edByCourse.get(c.slug)||[],today=now.toISOString().slice(0,10);
 const current=eds.some(e=>e.starts_on&&e.ends_on&&e.starts_on<=today&&today<=e.ends_on);
 const major=eds.some(e=>e.is_major),tours=new Set(eds.flatMap(e=>e.tours||[e.tour]).filter(Boolean).map(String));
 return [current?0:1,major?0:1,-eds.length,[...tours].some(t=>/PGA TOUR/i.test(t))?0:[...tours].some(t=>/LPGA/i.test(t))?1:2,c.slug];
}
const cmp=(a,b)=>{for(let i=0;i<a.length;i++){if(a[i]<b[i])return -1;if(a[i]>b[i])return 1;}return 0;};
const QL=(lat,lon)=>`[out:json][timeout:180];(nwr[leisure=golf_course](around:${RADIUS},${lat},${lon});way[golf](around:${RADIUS},${lat},${lon});way[natural=water](around:${RADIUS},${lat},${lon}););out geom;`;
const QN=(re,lat,lon)=>`[out:json][timeout:180];nwr[leisure=golf_course][name~"${re}",i](around:25000,${lat},${lon});out center tags;`;
async function slot(){for(let k=0;k<40;k++){const t=await (await fetch(STATUS,{headers:{'user-agent':UA}})).text();if(/slots? available now/.test(t))return;const m=[...t.matchAll(/in (\d+) seconds/g)].map(x=>+x[1]);await sleep(((m.length?Math.min(...m):20)+2)*1000);}throw new Error('BARRIER: no Overpass slot');}
async function overpass(ql){for(let attempt=0;attempt<2;attempt++){await slot();
 const r=await fetch(EP,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','user-agent':UA},body:'data='+encodeURIComponent(ql),signal:AbortSignal.timeout(200000)}).catch(e=>({ok:false,status:'net:'+e.name}));
 if(r.ok)return await r.json();
 if(r.status===429){await slot();continue;}
 if(r.status===403)throw new Error('BARRIER 403');
 if(attempt===0){await sleep(90000);continue;}
 return {barrier:String(r.status)};}
 return {barrier:'retry_exhausted'};}

async function collect(){
 fs.mkdirSync(CACHE,{recursive:true});
 const list=courses.filter(c=>c.latitude!=null&&c.longitude!=null).sort((a,b)=>cmp(priority(a),priority(b)));
 const cand=fs.existsSync(path.join(CACHE,'_candidates.json'))?JSON.parse(fs.readFileSync(path.join(CACHE,'_candidates.json'),'utf8')):{};
 const named=[...IDENTITY_EVIDENCE.filter(x=>x.locate),...Object.entries(cand).filter(([,v])=>v.status==='candidate').map(([slug,v])=>({slug,locate:{lat:v.candidate.lat,lon:v.candidate.lon}}))];
 const log=[];
 const CHUNK=+process.env.CHUNK||Infinity;let done=0;
 for(const x of named){const f=path.join(CACHE,x.slug+'.json');if(fs.existsSync(f))continue;if(x.locate.lat==null)continue;if(done++>=CHUNK){console.log('chunk limit reached');break;}
  const j=await overpass(QL(x.locate.lat,x.locate.lon));if(j.barrier){log.push({slug:x.slug,barrier:j.barrier});continue;}
  fs.writeFileSync(f,JSON.stringify({retrieved_at:new Date().toISOString(),query:QL(x.locate.lat,x.locate.lon),osm3s:j.osm3s,elements:j.elements}));console.log('named',x.slug,j.elements.length);await sleep(3000);}
 let n=0;for(const c of list){const f=path.join(CACHE,c.slug+'.json');if(fs.existsSync(f))continue;
  const j=await overpass(QL(c.latitude,c.longitude));n++;
  if(j.barrier){log.push({slug:c.slug,barrier:j.barrier});console.log('barrier',c.slug,j.barrier);continue;}
  fs.writeFileSync(f,JSON.stringify({retrieved_at:new Date().toISOString(),query:QL(c.latitude,c.longitude),osm3s:j.osm3s,elements:j.elements}));
  console.log(n,c.slug,j.elements.length);await sleep(3000);}
 fs.writeFileSync(path.join(CACHE,'_barriers.json'),JSON.stringify(log,null,1));console.log('done; barriers',log.length);
}

// Championship setup for matching evidence only: the default (latest started) setup at this course.
// Accounting only: does the course page show a full scorecard? Mirrors golf-api (latest started edition with a published
// hole table, up to 3 recent editions). Matching evidence still uses setupFor (the default edition) unchanged.
function shownScorecard(slug){for(const o of setupOptions(edByCourse.get(slug)||[]).slice(0,3)){const hs=B.editions.find(x=>x.slug===o.edition)?.layout?.holes||[];if(hs.length)return hs.length===18&&hs.every(h=>Number.isInteger(h.par)&&Number.isInteger(h.yards));}return false;}
function setupFor(slug){const e=defaultEdition(edByCourse.get(slug));const d=e&&B.editions.find(x=>x.slug===e.slug);const hs=d?.layout?.holes||[];return new Map(hs.filter(h=>Number.isInteger(h.hole)).map(h=>[h.hole,{par:h.par??null,yards:h.yards??null}]));}
// Only what belongs to the matched course: holes the matcher proved inside its boundary, and features whose
// centre lies inside it. Neighbouring courses inside the extract radius are never drawn or attached.
const centre=g=>{const xs=g.map(p=>p.lon),ys=g.map(p=>p.lat);return [(Math.min(...xs)+Math.max(...xs))/2,(Math.min(...ys)+Math.max(...ys))/2];};
const toOsm=(els,target,accepted)=>({course:{id:target.type+'/'+target.id,outer:outerRings(target).sort((a,b)=>b.length-a.length)[0]||[]},
 holes:(accepted||[]).map(h=>({id:h.id,ref:String(h.hole),osm_ref:h.osm_ref??null,proof:h.proof,par:h.par,coords:h.coords})),
 features:els.filter(e=>e.type==='way'&&e.geometry&&(e.tags?.golf&&e.tags.golf!=='hole'||e.tags?.natural==='water')&&inside(centre(e.geometry),target)).map(f=>({id:'way/'+f.id,golf:f.tags.golf||null,natural:f.tags.natural||null,coords:f.geometry.map(p=>[p.lon,p.lat]),closed:f.geometry.length>3&&f.geometry[0].lat===f.geometry.at(-1).lat&&f.geometry[0].lon===f.geometry.at(-1).lon}))});

const CANDIDATES=fs.existsSync(path.join(CACHE,'_candidates.json'))?JSON.parse(fs.readFileSync(path.join(CACHE,'_candidates.json'),'utf8')):{};
function prepare(){
 // Start clean so files from an earlier prepare are never re-uploaded (golf#14 review).
 for(const d of ['courses','dataset'])fs.rmSync(path.join(OUT,d),{recursive:true,force:true});
 fs.mkdirSync(path.join(OUT,'courses'),{recursive:true});fs.mkdirSync(path.join(OUT,'dataset'),{recursive:true});
 const ev=new Map(IDENTITY_EVIDENCE.map(x=>[x.slug,x]));const rows=[];
 const barriers=new Set((fs.existsSync(path.join(CACHE,'_barriers.json'))?JSON.parse(fs.readFileSync(path.join(CACHE,'_barriers.json'),'utf8')):[]).map(x=>x.slug));
 for(const c of [...courses].sort((a,b)=>cmp(priority(a),priority(b)))){
  const eds=edByCourse.get(c.slug)||[],tours=[...new Set(eds.flatMap(e=>e.tours||[e.tour]).filter(Boolean).map(String))];
  const base={slug:c.slug,name:c.name,editions:eds.length,major:eds.some(e=>e.is_major),tours,coords:c.latitude!=null};
  const dup=DUPLICATE_COURSES.find(x=>x.slug===c.slug);if(dup){rows.push({...base,status:'held',decision:'duplicate_canonical_merge_prepared',duplicate_of:dup.duplicate_of});continue;}
  const f=path.join(CACHE,c.slug+'.json');
  if(!fs.existsSync(f)){rows.push({...base,status:c.latitude==null&&!ev.get(c.slug)?.locate?'held':'unaudited',decision:c.latitude==null?'no_canonical_coords':barriers.has(c.slug)?'barrier':'not_collected'});continue;}
  const raw=JSON.parse(fs.readFileSync(f,'utf8')),els=raw.elements||[],setup=setupFor(c.slug),x=ev.get(c.slug);
  const canon={slug:c.slug,name:c.name,locality:c.locality,country_code:c.country_code,latitude:c.latitude??x?.locate?.lat,longitude:c.longitude??x?.locate?.lon};
  let m=matchWithEvidence({...canon,latitude:c.latitude,longitude:c.longitude},els,setup,x||null);
  // Automatic identity (no reviewed record): only the single best-named candidate in the ESPN locality, and only with
  // geometry proof against the championship setup. Otherwise it stays held for manual review with the candidate.
  const cd=!x&&c.latitude==null?CANDIDATES[c.slug]:null;
  if(cd?.status==='candidate'){const t=matchWithEvidence({...canon,latitude:null,longitude:null},els,setup,{osm_course:cd.candidate.osm_course,evidence_id:'auto-identity-v1',clears:['review_no_canonical_coords']});
   const ok=autoIdentityOk(t,setup,c.name);m=ok.pass?{...t,auto:ok}:{...m,decision:'review_auto_identity_insufficient',auto:ok,target:t.target};}
  // Human-reviewed lane: only the reviewed OSM element, only with exactly 18 proven holes; never clears anything else.
  const hr=HUMAN_REVIEWED_LAYOUTS.find(y=>y.slug===c.slug);
  if(hr&&m.decision!=='exact'){const t=matchWithEvidence({...canon,latitude:null,longitude:null},els,setup,{osm_course:hr.osm_course,evidence_id:hr.evidence_id,clears:['review_no_canonical_coords']});
   m=t.decision==='exact'&&t.evidence.proven===18?{...t,human:hr,cleared_by:hr.evidence_id}:{...m,decision:'review_human_record_mismatch',human:null};}
  const r={...base,auto:m.auto||null,human:m.human?{evidence_id:m.human.evidence_id,reviewer:m.human.reviewer,decided:m.human.decided}:null,setup_table:shownScorecard(c.slug),decision:m.decision,osm_course:m.target?{id:m.target.type+'/'+m.target.id,name:m.target.tags?.name||null}:null,proven:m.evidence.proven,par_conflicts:m.evidence.par.disagree,retrieved_at:raw.retrieved_at,cleared_by:m.cleared_by||null};
  r._m=m;r._els=els;r._raw=raw;rows.push(r);
 }
 // Projection aliases are no longer public courses, but their held duplicate rows stay in the index (golf#14).
 for(const d of DUPLICATE_COURSES)if(!rows.some(r=>r.slug===d.slug)){const pe=edByCourse.get(d.duplicate_of)||[];rows.push({slug:d.slug,name:d.name||null,editions:0,major:pe.some(e=>e.is_major),tours:[...new Set(pe.flatMap(e=>e.tours||[e.tour]).filter(Boolean).map(String))],coords:false,status:'held',decision:'duplicate_canonical_merge_prepared',duplicate_of:d.duplicate_of});}
 holdSharedTargets(rows.filter(r=>r._m));
 for(const r of rows.filter(r=>r._m)){
  if(r.decision!=='exact'){r.status=/^no_/.test(r.decision)?'no-routing':'held';continue;}
  const osm={...toOsm(r._els,r._m.target,r._m.evidence.accepted),as_of:r.retrieved_at};
  // Web payload budget (~60 KB): raise the simplification tolerance, then drop the smallest bunkers. Recorded in
  // the payload; the ODbL dataset download keeps every feature at full resolution.
  const area=r=>{let a=0;for(let i=1;i<r.length;i++)a+=r[i-1][0]*r[i][1]-r[i][0]*r[i-1][1];return Math.abs(a/2);};
  let prep,web_simplification={tolerance_m:2,min_bunker_m2:0};
  for(const tol of [2,4,8]){prep=prepareCourseMap(osm,{slug:r.slug,name:r.name},{parConflicts:r.par_conflicts,tol});web_simplification={tolerance_m:tol,min_bunker_m2:0};if(JSON.stringify(prep).length<=60000)break;}
  for(const minA of [25,60,120,250]){if(JSON.stringify(prep).length<=60000||!prep.geometry)break;prep.geometry.features.bunker=prep.geometry.features.bunker.filter(b=>area(b)>=minA);web_simplification.min_bunker_m2=minA;}
  const mapped=prep.coverage?.holes_mapped||0;r.status=r.human?(mapped===18?'reviewed':'held'):mapped===18?'full':mapped>0?'partial':'no-routing';r.holes_mapped=mapped;if(r.status==='held'){r.decision='review_human_record_mismatch';continue;}
  const feats=prep.geometry?.features||{};r.features=Object.fromEntries(Object.entries(feats).map(([k,v])=>[k,v.length]));
  if(mapped){const web={version:'osm-routing/v1',course:{slug:r.slug,name:r.name},source:{name:'OpenStreetMap',course_element:r.osm_course.id,retrieved_at:r.retrieved_at,osm_base:r._raw.osm3s?.timestamp_osm_base||null,identity:{decision:'exact',cleared_by:r.cleared_by,...(r.human?{tier:'human_reviewed',layout_identity:'reviewed',hole_count:mapped,yardage_validation:'unavailable',reviewer:r.human.reviewer,decided:r.human.decided}:{})}},
    attribution:ATTRIBUTION,geometry_status:r.human?'REVIEWED ROUTING':mapped===18?'VERIFIED ROUTING':'PARTIAL ROUTING',geometry:{...prep.geometry,web_simplification},
    holes:prep.holes.map(h=>({hole:h.hole,route:h.route,bearing_deg:h.bearing_deg,routing_observed:h.routing_observed,source_feature_id:h.source_feature_id,proof:h.proof,osm_par:h.routing_observed?(osm.holes.find(o=>o.id===h.source_feature_id)?.par??null):null})),
    coverage:{holes_mapped:mapped,holes_total:18,withheld:[...new Map([...r._m.evidence.rejected,...prep.coverage.rejected].filter(x=>Number.isInteger(Number(x.ref))&&Number(x.ref)>=1&&Number(x.ref)<=18&&!prep.holes.find(h=>h.hole===Number(x.ref))?.route).map(x=>[Number(x.ref),{hole:Number(x.ref),reason:x.reason}])).values()].sort((a,b)=>a.hole-b.hole)},
    geometry_metadata_conflicts:[...r.par_conflicts.map(h=>({hole:h,field:'par',note:'OSM tag differs from the championship setup; setup facts come from tournament sources'})),...(r._m.evidence.length_conflicts||[]).map(c=>({hole:c.hole,field:'length',mapped_yards:c.mapped_yards,setup_yards:c.setup_yards,note:'Mapped route length differs from the setup yardage (route may be drawn from another tee)'}))].sort((a,b)=>a.hole-b.hole)};
   fs.writeFileSync(path.join(OUT,'courses',r.slug+'.json'),JSON.stringify(web));r.web_bytes=Buffer.byteLength(JSON.stringify(web));
   // ODbL derivative dataset (machine-readable, lon/lat, OSM ids): the routes we attached and the features we draw.
   const accepted=new Set(web.holes.filter(h=>h.source_feature_id).map(h=>h.source_feature_id));
   const gj={type:'FeatureCollection',license:'ODbL-1.0',license_url:ATTRIBUTION.licence_url,attribution:'© OpenStreetMap contributors',source:'https://www.openstreetmap.org/copyright',retrieved_at:r.retrieved_at,course:{slug:r.slug,name:r.name,osm_element:r.osm_course.id},
    features:[...osm.holes.filter(h=>accepted.has(h.id)).map(h=>({type:'Feature',id:h.id,properties:{kind:'hole_route',hole:web.holes.find(x=>x.source_feature_id===h.id).hole,osm_ref:h.osm_ref??h.ref??null,osm_par:h.par??null},geometry:{type:'LineString',coordinates:h.coords}})),
     ...osm.features.filter(f=>f.closed).map(f=>({type:'Feature',id:f.id,properties:{kind:f.golf||f.natural},geometry:{type:'Polygon',coordinates:[f.coords]}}))]};
   fs.writeFileSync(path.join(OUT,'dataset',r.slug+'.geojson'),JSON.stringify(gj));r.dataset_bytes=Buffer.byteLength(JSON.stringify(gj));}
 }
 const pub=rows.map(({_m,_els,_raw,...r})=>r);
 const count=(f)=>({total:pub.filter(f).length,audited:pub.filter(r=>f(r)&&!['unaudited'].includes(r.status)).length,full:pub.filter(r=>f(r)&&r.status==='full').length,partial:pub.filter(r=>f(r)&&r.status==='partial').length,held:pub.filter(r=>f(r)&&r.status==='held').length,no_routing:pub.filter(r=>f(r)&&r.status==='no-routing').length,reviewed:pub.filter(r=>f(r)&&r.status==='reviewed').length,scorecard_only:pub.filter(r=>f(r)&&r.status==='no-routing'&&r.setup_table).length,no_layout:pub.filter(r=>f(r)&&r.status==='no-routing'&&!r.setup_table).length,unaudited:pub.filter(r=>f(r)&&r.status==='unaudited').length,exact:pub.filter(r=>f(r)&&r.decision==='exact').length});
 const index={version:'osm-routing/v1',generated_at:new Date().toISOString(),licence:'ODbL-1.0',attribution:ATTRIBUTION,method:'/v1/open-data/course-routing/method',
  counts:{all:count(()=>true),pga:count(r=>r.tours.some(t=>/PGA TOUR/i.test(t))),lpga:count(r=>r.tours.some(t=>/LPGA/i.test(t))),majors:count(r=>r.major)},
  courses:pub.map(r=>({slug:r.slug,name:r.name,coords:Boolean(r.coords),status:r.status,decision:r.decision,duplicate_of:r.duplicate_of||null,auto_identity:r.auto||null,human_review:r.human||null,setup_table:Boolean(r.setup_table),candidate:CANDIDATES[r.slug]?.candidate?.osm_course||null,holes_mapped:r.holes_mapped??0,osm_course:r.osm_course?.id||null,retrieved_at:r.retrieved_at||null,cleared_by:r.cleared_by||null,par_conflicts:r.par_conflicts||[],features:r.features||null,web_bytes:r.web_bytes||null,dataset_bytes:r.dataset_bytes||null}))};
 fs.writeFileSync(path.join(OUT,'index.json'),JSON.stringify(index,null,1));
 fs.writeFileSync(path.join(ROOT,'docs/evidence/course-geo-coverage.json'),JSON.stringify({generated_at:index.generated_at,counts:index.counts,courses:index.courses.map(({web_bytes,dataset_bytes,...x})=>x)},null,1));
 console.log(JSON.stringify(index.counts,null,1));
}
// Guarded publish (golf#14): parity vs the LIVE index (fail closed), backups of the index and of every object that
// changes or is removed, unchanged objects skipped, objects first, index last, refused if the live index changed
// meanwhile, everything restored if the switch fails. `diff` = the same check and staging, no writes.
// One operator at a time: there is no cross-process lock beyond the live-index sha check.
const R2=args=>execFileSync(process.execPath,[path.join(ROOT,'node_modules/wrangler/bin/wrangler.js'),'r2','object',...args,'--remote'],{cwd:path.join(ROOT,'workers/golf-api'),stdio:['ignore','pipe','pipe']});
const RELEASES=process.env.OSM_RELEASES_DIR||'D:/Workers/releases/osm-routing',sha=t=>crypto.createHash('sha256').update(t).digest('hex');
async function upload({dryRun=false}={}){
 const stamp=new Date().toISOString().replace(/[:.]/g,'-'),dir=dryRun?fs.mkdtempSync(path.join(os.tmpdir(),'osm-diff-')):path.join(RELEASES,stamp);fs.mkdirSync(dir,{recursive:true});
 const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(x=>x.isDirectory()?walk(path.join(d,x.name)):[path.join(d,x.name)]);
 const objects=walk(OUT).filter(f=>path.basename(f)!=='index.json').map(f=>({key:'osm-routing/v1/'+path.relative(OUT,f).split(path.sep).join('/'),file:f,contentType:f.endsWith('.geojson')?'application/geo+json':'application/json'}));
 const tmp=path.join(dir,'_get.tmp'),missing=e=>/not found|does not exist|NoSuchKey|404/i.test(String(e?.stderr||'')+String(e?.stdout||'')+String(e?.message||''));
 // A missing object is null; any other wrangler failure (auth, network) throws with its stderr so it is never mistaken for "missing".
 const get=key=>{fs.rmSync(tmp,{force:true});try{R2(['get','golf-public/'+key,'--file',tmp]);}catch(e){if(missing(e))return null;throw Error('wrangler get '+key+': '+String(e.stderr||e.message).slice(0,400));}return fs.existsSync(tmp)?{text:fs.readFileSync(tmp,'utf8')}:null;};
 const put=(key,body,ct)=>{const f=path.join(dir,'_put.tmp');fs.writeFileSync(f,body.text);R2(['put','golf-public/'+key,'--file',f,'--content-type',ct]);console.log('put',key);};
 const io={getLiveIndex:async()=>get('osm-routing/v1/index.json'),getObject:async k=>get(k),readFile:f=>fs.readFileSync(f,'utf8'),
  backup:async(name,t)=>{const p=path.join(dir,name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,t);return p;},
  putObject:async(k,body,ct)=>put(k,body,ct),deleteObject:async k=>{R2(['delete','golf-public/'+k]);console.log('delete',k);},
  putIndexText:async t=>put('osm-routing/v1/index.json',{text:t},'application/json'),sha};
 const res=await publishRouting({io,localIndexText:fs.readFileSync(path.join(OUT,'index.json'),'utf8'),objects,revocations:ROUTING_REVOCATIONS,dryRun});
 fs.writeFileSync(path.join(dir,'release.json'),JSON.stringify({...res,objects:objects.length,at:new Date().toISOString()},null,1));
 const p=res.parity;console.log(JSON.stringify({published:res.published,reason:res.reason||null,error:res.error||null,restore:res.restore||null,regressions:p.regressions,explained:p.explained,improvements:p.improvements.length,added:p.added,changed:res.changed||[],removed:res.removed||[],record:dir},null,1));
 if(!res.published&&res.reason!=='dry_run')process.exitCode=1;
}
// Extracts collected with `out geom tags` carry relations without members (bounds only). Re-fetch only those relations
// with full geometry, one query per file, and merge them in place (recorded as relations_refetched_at).
async function relations(){
 for(const f of fs.readdirSync(CACHE).filter(f=>f.endsWith('.json')&&!f.startsWith('_'))){const p=path.join(CACHE,f),raw=JSON.parse(fs.readFileSync(p,'utf8'));
  const ids=(raw.elements||[]).filter(e=>e.type==='relation'&&e.tags?.leisure==='golf_course'&&!e.members?.length).map(e=>e.id);if(!ids.length||raw.relations_refetched_at)continue;
  const j=await overpass(`[out:json][timeout:180];relation(id:${ids.join(',')});out geom;`);if(j.barrier){console.log('barrier',f,j.barrier);continue;}
  const by=new Map(j.elements.map(e=>[e.id,e]));raw.elements=raw.elements.map(e=>e.type==='relation'&&by.has(e.id)?by.get(e.id):e);raw.relations_refetched_at=new Date().toISOString();
  fs.writeFileSync(p,JSON.stringify(raw));console.log('relations',f,ids.length);await sleep(3000);}
}
// Candidate finder for courses without canonical coordinates (automatic, rule-based, never by name alone):
// 1) geocode the ESPN-published city (OSM Nominatim, <=1 req/s, identified UA) to a bounding box;
// 2) list every leisure=golf_course in that box (Overpass);
// 3) keep the single best name match across name / name:en / int_name / official_name / alt_name / operator.
// The candidate only positions an extract; prepare() then requires geometry proof (autoIdentityOk) before attaching.
const CANDS=path.join(CACHE,'_candidates.json');
function espnLocality(slug){for(const e of (edByCourse.get(slug)||[])){const d=B.editions.find(x=>x.slug===e.slug);const c=d?.espn?.course;if(c?.city)return {city:c.city,state:c.state||null,country:c.country||null};}return null;}
async function nominatim(q){await sleep(1100);const r=await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q='+encodeURIComponent(q),{headers:{'user-agent':UA,'accept-language':'en'},signal:AbortSignal.timeout(20000)}).catch(()=>null);
 if(!r||r.status===403||r.status===429)return {barrier:r?String(r.status):'net'};if(!r.ok)return {barrier:String(r.status)};return {rows:await r.json()};}
async function nominatimMany(q){await sleep(1100);const r=await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q='+encodeURIComponent(q),{headers:{'user-agent':UA,'accept-language':'en'},signal:AbortSignal.timeout(20000)}).catch(()=>null);
 if(!r||r.status===403||r.status===429)return {barrier:r?String(r.status):'net'};if(!r.ok)return {barrier:String(r.status)};return {rows:await r.json()};}
const NAME_TAGS=['name','name:en','int_name','official_name','alt_name','operator','short_name'];
async function candidates(){
 fs.mkdirSync(CACHE,{recursive:true});const out=fs.existsSync(CANDS)?JSON.parse(fs.readFileSync(CANDS,'utf8')):{};
 const reviewed=new Set([...IDENTITY_EVIDENCE.map(x=>x.slug),...DUPLICATE_COURSES.map(x=>x.slug)]);
 // ONLY=slug,slug limits a run; FINAL_RETRY=1 marks it as the single permitted retry: a second timeout is recorded as
 // held_source_timeout and never retried again (no guessed match from a network failure).
 const ONLY=process.env.ONLY?new Set(process.env.ONLY.split(',')):null,FINAL=process.env.FINAL_RETRY==='1';
 const list=courses.filter(c=>c.latitude==null&&!reviewed.has(c.slug)&&(!ONLY||ONLY.has(c.slug))).sort((a,b)=>cmp(priority(a),priority(b)));
 for(const c of list){if(out[c.slug]&&out[c.slug].status!=='barrier')continue;const prior=out[c.slug]||null;
  const loc=espnLocality(c.slug)||(c.locality?{city:c.locality,state:null,country:c.country||null}:null);
  if(!loc){out[c.slug]={status:'no_locality'};continue;}
  const q=[loc.city,loc.state,loc.country].filter(Boolean).join(', ');
  // Fast path: the course itself in the geocoder (golf_course results only, single best name match).
  const direct=await nominatimMany(`${c.name}, ${q}`);
  if(!direct.barrier){const gc=(direct.rows||[]).filter(r=>r.category==='leisure'&&r.type==='golf_course').map(r=>({id:(r.osm_type==='relation'?'relation':r.osm_type==='way'?'way':'node')+'/'+r.osm_id,center:{lat:+r.lat,lon:+r.lon},names:[r.name].filter(Boolean),score:nameScore(c.name,r.name)})).filter(x=>x.score>=0.5).sort((a,b)=>b.score-a.score);
   const top=gc.filter(x=>x.score===gc[0]?.score);
   if(top.length===1){out[c.slug]={query:`${c.name}, ${q}`,via:'nominatim-direct',status:'candidate',candidate:{osm_course:top[0].id,lat:top[0].center.lat,lon:top[0].center.lon,names:top[0].names,score:top[0].score},others:gc.slice(0,5).map(x=>({id:x.id,names:x.names,score:+x.score.toFixed(2)}))};console.log(c.slug,'candidate(direct)',top[0].names[0]);fs.writeFileSync(CANDS,JSON.stringify(out,null,1));continue;}}
  const g=await nominatim(q);
  if(g.barrier){out[c.slug]={status:FINAL?'held_source_timeout':'barrier',barrier:g.barrier,query:q,first_failure:prior?.barrier||null};console.log('barrier',c.slug,g.barrier);if(g.barrier==='403')break;continue;}
  const bb=g.rows?.[0]?.boundingbox?.map(Number);if(!bb){out[c.slug]={status:'locality_not_found',query:q};continue;}
  let [s0,n0,w0,e0]=bb;const cy=(s0+n0)/2,cx=(w0+e0)/2;s0=Math.max(s0,cy-0.35);n0=Math.min(n0,cy+0.35);w0=Math.max(w0,cx-0.35);e0=Math.min(e0,cx+0.35);
  const j=await overpass(`[out:json][timeout:120];nwr[leisure=golf_course](${s0},${w0},${n0},${e0});out tags center;`);
  if(j.barrier){out[c.slug]={status:FINAL?'held_source_timeout':'barrier',barrier:j.barrier,query:q,first_failure:prior?.barrier||null,retried_at:FINAL?new Date().toISOString():null};console.log(c.slug,out[c.slug].status,j.barrier);fs.writeFileSync(CANDS,JSON.stringify(out,null,1));continue;}
  const scored=(j.elements||[]).map(e=>({id:e.type+'/'+e.id,center:e.center||(e.lat?{lat:e.lat,lon:e.lon}:null),names:NAME_TAGS.map(t=>e.tags?.[t]).filter(Boolean),score:Math.max(0,...NAME_TAGS.map(t=>e.tags?.[t]).filter(Boolean).map(n=>nameScore(c.name,n)))})).filter(x=>x.score>=0.5&&x.center).sort((a,b)=>b.score-a.score);
  const top=scored.filter(x=>x.score===scored[0]?.score);
  out[c.slug]={query:q,box:[s0,w0,n0,e0],courses_in_box:(j.elements||[]).length,status:!scored.length?'no_name_match':top.length>1?'ambiguous':'candidate',
   candidate:top.length===1?{osm_course:top[0].id,lat:top[0].center.lat,lon:top[0].center.lon,names:top[0].names,score:top[0].score}:null,others:scored.slice(0,5).map(x=>({id:x.id,names:x.names,score:+x.score.toFixed(2)}))};
  console.log(c.slug,out[c.slug].status,out[c.slug].candidate?.names?.[0]||'');fs.writeFileSync(CANDS,JSON.stringify(out,null,1));await sleep(2000);}
 fs.writeFileSync(CANDS,JSON.stringify(out,null,1));
}
// Offline: an ambiguous locality search is resolved only when the canonical name carries a sub-course in parentheses
// and exactly one tied candidate contains every distinctive token of it. Geometry proof is still required afterwards.
function resolve(){const out=JSON.parse(fs.readFileSync(CANDS,'utf8'));let n=0;
 for(const c of courses){const v=out[c.slug];if(v?.status!=='ambiguous')continue;const sub=subCourseTokens(c.name);if(!sub.length)continue;
  const hit=(v.others||[]).filter(o=>o.names.some(nm=>{const t=new Set(norm(nm));return sub.every(x=>t.has(x));}));
  if(hit.length===1){const full=hit[0];v.status='candidate';v.resolved_by='sub-course:'+sub.join(' ');v.candidate={osm_course:full.id,names:full.names,score:full.score,lat:null,lon:null,needs_centre:true};n++;console.log('resolved',c.slug,'->',full.names[0]);}
  else v.unresolved=hit.length?`${hit.length} candidates contain the sub-course name`:'no candidate contains the sub-course name';}
 fs.writeFileSync(CANDS,JSON.stringify(out,null,1));console.log('resolved',n);}
// Centres for resolved candidates (one small Overpass call each).
async function centres(){const out=JSON.parse(fs.readFileSync(CANDS,'utf8'));
 for(const [slug,v] of Object.entries(out)){if(!v.candidate?.needs_centre)continue;const [t,id]=v.candidate.osm_course.split('/');
  const j=await overpass(`[out:json][timeout:60];${t}(${id});out center;`);if(j.barrier){console.log('barrier',slug,j.barrier);continue;}
  const e=j.elements?.[0];const ce=e?.center||(e?.lat?{lat:e.lat,lon:e.lon}:null);if(!ce)continue;v.candidate.lat=ce.lat;v.candidate.lon=ce.lon;delete v.candidate.needs_centre;console.log('centre',slug);await sleep(3000);}
 fs.writeFileSync(CANDS,JSON.stringify(out,null,1));}
const cmd=process.argv[2];
if(cmd==='collect')await collect();else if(cmd==='candidates')await candidates();else if(cmd==='resolve')resolve();else if(cmd==='centres')await centres();else if(cmd==='relations')await relations();else if(cmd==='prepare')prepare();else if(cmd==='upload')await upload();else if(cmd==='diff')await upload({dryRun:true});else if(cmd)console.error('usage: collect|prepare|diff|upload');
