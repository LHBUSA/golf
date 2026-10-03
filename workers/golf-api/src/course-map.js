// GET /v1/courses/:slug/map[?edition=]   — prepared web geometry (ODbL, OSM-derived) + one championship setup + that
//                                          same edition's scoring. Geometry never moves with the setup.
// GET /v1/open-data/course-routing[/:slug.geojson|/method] — the ODbL derivative database and its extraction method.
import {defaultEdition,setupOptions,buildSetup} from '../../shared/course-setup.js';
import {HOLE_INTEL_VERSION,holeShape,associateGreens,hazardsFor,targetFor,routeMarkers,polyLength} from '../../../src/lib/hole-intel.js';

const ATTR={text:'© OpenStreetMap contributors',url:'https://www.openstreetmap.org/copyright',licence:'ODbL 1.0',licence_url:'https://opendatacommons.org/licenses/odbl/1-0/'};
const MAP_CACHE='public, max-age=300, s-maxage=1800';
const OPEN_CACHE='public, max-age=3600, s-maxage=86400';
const get=async(env,k)=>{const o=await env.PUBLIC?.get(k);return o?JSON.parse(await o.text()):null;};
// Why a course has no (or partial) map, from the coverage index (plain language; the raw decision stays alongside).
let IDX={at:0,v:null};
async function routingIndex(env){if(IDX.v&&Date.now()-IDX.at<600000)return IDX.v;const v=await get(env,'osm-routing/v1/index.json');IDX={at:Date.now(),v};return v;}
export function routingReason(row){
 if(!row)return {code:'not_audited',text:'Not yet audited for mapped routing'};
 const d=row.decision||'';
 if(row.status==='full')return {code:'verified',text:'Verified routing for all 18 holes'};
 if(row.status==='reviewed')return {code:'human_reviewed',text:'Routing for all 18 holes, identity human-reviewed; yardage not validated (no published hole table)'};
 if(row.status==='partial')return {code:'partial',text:`Verified routing for ${row.holes_mapped} of 18 holes; the rest await verification`};
 if(d==='no_canonical_coords')return {code:'awaiting_location',text:'Awaiting course location verification before routing can be attached'};
 // Automatic identity attempts (auto-identity-v1) that did not pass: say what is actually missing.
 if(d==='review_auto_identity_insufficient'){const k=row.auto_identity?.checks||{};
  if(!k.proven)return {code:'no_source_routing',text:'No mapped hole routing in open map data yet'};
  if(!k.setup_table)return {code:'awaiting_setup',text:'Mapped routing found; awaiting a published hole-by-hole setup to verify it against'};
  return {code:'awaiting_routing_verification',text:'Mapped routing found but awaiting identity verification'};}
 if(d==='review_auto_target_owned')return {code:'identity_review',text:'Course record under identity review'};
 if(/^duplicate|review_duplicate/.test(d))return {code:'identity_review',text:'Course record under identity review'};
 if(/^review_/.test(d))return {code:'awaiting_routing_verification',text:'Mapped routing found but awaiting identity verification'};
 if(d==='barrier'||d==='not_collected')return {code:'not_audited',text:'Not yet audited for mapped routing'};
 if(row.osm_course&&!row.holes_mapped)return {code:'holes_unmapped',text:'Course outline is mapped in open data, but its holes are not yet'};
 return {code:'no_source_routing',text:'No mapped routing in open map data yet'};
}

import {DUPLICATE_COURSES} from '../../shared/course-identity.js';
export async function courseMap(env,ix,slug,editionParam,now=new Date()){
 // Reviewed alias (merged duplicate course): serve the primary course's map.
 {const d=DUPLICATE_COURSES.find(x=>x.alias&&x.slug===slug);if(d)slug=d.duplicate_of;}
 const course=(ix.courses||[]).find(c=>c.slug===slug);if(!course)return {status:404,body:{error:'not_found'}};
 const eds=(ix.editions||[]).filter(e=>(e.course?.slug||e.course)===slug);
 const options=setupOptions(eds,now);
 const chosen=editionParam?eds.find(e=>e.slug===editionParam&&options.some(o=>o.edition===e.slug)):defaultEdition(eds,now);
 if(editionParam&&!chosen)return {status:404,body:{error:'edition_not_selectable'}};
 // Default setup = latest STARTED edition that has a published hole table (checks up to 3 recent editions); an
 // explicit ?edition= is honoured as asked. Future stubs are never candidates (setupOptions excludes them).
 let ed=null;const geoP=get(env,'osm-routing/v1/courses/'+slug+'.json');
 if(editionParam)ed=await get(env,'projection/v2/editions/'+chosen.slug+'.json');
 else{for(const o of options.slice(0,3)){const d=await get(env,'projection/v2/editions/'+o.edition+'.json');if(!ed)ed=d;if(d?.layout?.holes?.length){ed=d;break;}}}
 const geo=await geoP;const ri=await routingIndex(env).catch(()=>null);const row=(ri?.courses||[]).find(c=>c.slug===slug)||null;
 const {setup,scoring}=buildSetup(ed);
 const sh=new Map((setup?.holes||[]).map(h=>[h.hole,h])),sc=new Map((scoring?.holes||[]).map(h=>[h.hole,h]));
 const gh=new Map((geo?.holes||[]).map(h=>[h.hole,h]));const withheld=new Map((geo?.coverage?.withheld||[]).map(w=>[w.hole,w.reason]));
 // Hole intelligence from verified routing + mapped features only (no positions). Greens/hazards need an observed route.
 const routed=(geo?.holes||[]).filter(h=>h.route);const greens=geo?associateGreens(routed,geo.geometry.features.green):new Map();
 const hz=geo?hazardsFor(routed,geo.geometry.features,greens):new Map();
 const holes=Array.from({length:18},(_,i)=>{const n=i+1,g=gh.get(n),s=sh.get(n),c=sc.get(n);
  return {hole:n,geometry_status:g?.route?'verified':withheld.has(n)?'withheld':geo?'unmapped':'none',withheld_reason:withheld.get(n)||null,route:g?.route||null,bearing_deg:g?.route?g.bearing_deg:null,source_feature_id:g?.source_feature_id||null,
   setup:setup?{edition:setup.edition,par:s?.par??null,yards:s?.yards??null}:null,
   scoring:scoring&&c?{edition:scoring.edition,avg_to_par:c.avg_to_par,sample:c.sample,cohort:scoring.cohort,scoring_average:c.scoring_average,difficulty_rank:c.difficulty_rank,difficulty_tied:c.difficulty_tied,difficulty_of:c.difficulty_of,distribution:c.distribution}:null,
   geometry_intelligence:g?.route?(()=>{const {algorithm,...sh}=holeShape(g.route,s?.par??null)||{shape:null};return {mapped_route_yards:Math.round(polyLength(g.route)/0.9144),...sh};})():null,
   hazards:g?.route?(()=>{const x=hz.get(n);if(!x)return null;const {method,...rest}=x;return rest;})():null,
   distance_reference:g?.route?(()=>{const t=targetFor(g,greens);return {target_type:t.type,target:t.point,route_markers:routeMarkers(g.route)};})():null};});
 const {holes:_h,...setupPublic}=setup||{};
 return {status:200,body:{
  course:{slug:course.slug,name:course.name},
  geometry_status:geo?geo.geometry_status:'NO MAPPED ROUTING',
  layout_evidence:geo?.source?.identity?{tier:geo.source.identity.tier||null,layout_identity:geo.source.identity.layout_identity||'verified',hole_count:geo.source.identity.hole_count??null,yardage_validation:geo.source.identity.yardage_validation||null}:null,
  geometry_basis:geo?'Current mapped routing (OpenStreetMap). Not a historical setup.':null,
  geometry_as_of:geo?.source?.retrieved_at||null,source_version:geo?.version||null,source:geo?.source||null,
  bounds:geo?.geometry?.bounds||null,geometry:geo?{units:geo.geometry.units,outline:geo.geometry.outline,features:geo.geometry.features}:null,
  coverage:geo?geo.coverage:{holes_mapped:0,holes_total:18,withheld:[]},
  geometry_metadata_conflicts:geo?.geometry_metadata_conflicts||[],
  attribution:geo?ATTR:null,
  setup:setup?setupPublic:null,scoring:scoring?{edition:scoring.edition,year:scoring.year,cohort:scoring.cohort,basis:scoring.basis,players:scoring.players}:null,
  routing_status:{...routingReason(row),decision:row?.decision||null},
  setups:options,intelligence_version:HOLE_INTEL_VERSION,
  intelligence_methods:geo?{mapped_route_yards:'length of the current mapped routing (OSM) — not the championship distance',shape:'route vertex farthest from the tee-green chord; dogleg when turn >= 20 deg and offset >= 20 m; mostly straight when turn < 12 deg; par 3s unclassified',
   hazards:'bunker centroid within 45 m of the route and 15 m nearer than any other route (else omitted); green-side within 40 m of the mapped green centre; water within 45 m of the route or crossing it',
   distance_reference:'target = associated mapped green centre (nearest route end within 35 m, exclusive by 15 m) else the verified route end; markers measured back along the verified route from its end',
   scoring:'observed hole cards of the selected edition only; distribution buckets sum to the sample; difficulty rank among holes with >= 10 cards by average to par, ties share a rank'}:null,
  holes}};
}
export const METHOD=`# PropBetEdge Golf course routing — extraction method (ODbL 1.0 derivative database)

Source: OpenStreetMap (© OpenStreetMap contributors, https://www.openstreetmap.org/copyright), licensed ODbL 1.0.

1. Extract. For each canonical course with coordinates, one Overpass API query (overpass-api.de), radius 2000 m:
   nwr[leisure=golf_course]; way[golf]; way[natural=water]; out geom tags. One query at a time, after a free slot is
   advertised by /api/status. Retrieval time and osm_base timestamp are recorded per course.
2. Identify the course. The canonical point must fall inside exactly one leisure=golf_course boundary, or lie within
   300 m of exactly one boundary whose name matches. Multiple containing boundaries, resorts, country conflicts and two
   canonical courses resolving to the same OSM course are held for review. Never matched by name alone; a documented,
   reviewed identity record may clear one named element.
3. Prove hole numbers. A golf=hole way inside the matched boundary is accepted when its ref is an integer 1-18 that is
   unique within the course. A duplicated ref is accepted only when exactly one candidate has the setup par and a
   length within 20% of the setup yardage. Anything else is withheld, never guessed.
4. Prepare for the web. Local equirectangular projection (metres, north up) centred on the course, Douglas-Peucker
   simplification (2 m) with a self-intersection check on rings. Bearing = tee to green of the observed route.
5. Separate layers. OSM par tags are recorded only as geometry metadata conflicts; championship par, yardage and scoring
   come from tournament sources and are not part of this database.

Download: /v1/open-data/course-routing (index) and /v1/open-data/course-routing/{course}.geojson (lon/lat, OSM ids).
`;
export async function openData(env,rest){
 if(!rest.length){const ix=await get(env,'osm-routing/v1/index.json');if(!ix)return {status:503,body:{error:'unavailable'}};
  return {status:200,cache:OPEN_CACHE,body:{licence:'ODbL-1.0',licence_url:ATTR.licence_url,attribution:ATTR.text,attribution_url:ATTR.url,method:'/v1/open-data/course-routing/method',generated_at:ix.generated_at,counts:ix.counts,
   courses:ix.courses.filter(c=>c.holes_mapped>0).map(c=>({slug:c.slug,name:c.name,status:c.status,holes_mapped:c.holes_mapped,osm_course:c.osm_course,retrieved_at:c.retrieved_at,download:`/v1/open-data/course-routing/${c.slug}.geojson`}))}};}
 if(rest[0]==='method')return {status:200,cache:OPEN_CACHE,text:METHOD};
 const m=rest[0].match(/^([a-z0-9-]+)\.geojson$/);if(!m)return {status:404,body:{error:'not_found'}};
 const o=await env.PUBLIC?.get('osm-routing/v1/dataset/'+m[1]+'.geojson');if(!o)return {status:404,body:{error:'not_found'}};
 return {status:200,cache:OPEN_CACHE,stream:o.body,type:'application/geo+json'};
}
