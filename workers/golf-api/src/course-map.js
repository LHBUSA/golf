// GET /v1/courses/:slug/map[?edition=]   — prepared web geometry (ODbL, OSM-derived) + one championship setup + that
//                                          same edition's scoring. Geometry never moves with the setup.
// GET /v1/open-data/course-routing[/:slug.geojson|/method] — the ODbL derivative database and its extraction method.
import {defaultEdition,setupOptions,buildSetup} from '../../shared/course-setup.js';

const ATTR={text:'© OpenStreetMap contributors',url:'https://www.openstreetmap.org/copyright',licence:'ODbL 1.0',licence_url:'https://opendatacommons.org/licenses/odbl/1-0/'};
const MAP_CACHE='public, max-age=300, s-maxage=1800';
const OPEN_CACHE='public, max-age=3600, s-maxage=86400';
const get=async(env,k)=>{const o=await env.PUBLIC?.get(k);return o?JSON.parse(await o.text()):null;};

export async function courseMap(env,ix,slug,editionParam,now=new Date()){
 const course=(ix.courses||[]).find(c=>c.slug===slug);if(!course)return {status:404,body:{error:'not_found'}};
 const eds=(ix.editions||[]).filter(e=>(e.course?.slug||e.course)===slug);
 const options=setupOptions(eds,now);
 const chosen=editionParam?eds.find(e=>e.slug===editionParam&&options.some(o=>o.edition===e.slug)):defaultEdition(eds,now);
 if(editionParam&&!chosen)return {status:404,body:{error:'edition_not_selectable'}};
 const [geo,ed]=await Promise.all([get(env,'osm-routing/v1/courses/'+slug+'.json'),chosen?get(env,'projection/v2/editions/'+chosen.slug+'.json'):null]);
 const {setup,scoring}=buildSetup(ed);
 const sh=new Map((setup?.holes||[]).map(h=>[h.hole,h])),sc=new Map((scoring?.holes||[]).map(h=>[h.hole,h]));
 const gh=new Map((geo?.holes||[]).map(h=>[h.hole,h]));const withheld=new Map((geo?.coverage?.withheld||[]).map(w=>[w.hole,w.reason]));
 const holes=Array.from({length:18},(_,i)=>{const n=i+1,g=gh.get(n),s=sh.get(n),c=sc.get(n);
  return {hole:n,geometry_status:g?.route?'verified':withheld.has(n)?'withheld':geo?'unmapped':'none',withheld_reason:withheld.get(n)||null,route:g?.route||null,bearing_deg:g?.route?g.bearing_deg:null,source_feature_id:g?.source_feature_id||null,
   setup:setup?{edition:setup.edition,par:s?.par??null,yards:s?.yards??null}:null,
   scoring:scoring&&c?{edition:scoring.edition,avg_to_par:c.avg_to_par,sample:c.sample,cohort:scoring.cohort}:null};});
 const {holes:_h,...setupPublic}=setup||{};
 return {status:200,body:{
  course:{slug:course.slug,name:course.name},
  geometry_status:geo?geo.geometry_status:'NO MAPPED ROUTING',
  geometry_basis:geo?'Current mapped routing (OpenStreetMap). Not a historical setup.':null,
  geometry_as_of:geo?.source?.retrieved_at||null,source_version:geo?.version||null,source:geo?.source||null,
  bounds:geo?.geometry?.bounds||null,geometry:geo?{units:geo.geometry.units,outline:geo.geometry.outline,features:geo.geometry.features}:null,
  coverage:geo?geo.coverage:{holes_mapped:0,holes_total:18,withheld:[]},
  geometry_metadata_conflicts:geo?.geometry_metadata_conflicts||[],
  attribution:geo?ATTR:null,
  setup:setup?setupPublic:null,scoring:scoring?{edition:scoring.edition,year:scoring.year,cohort:scoring.cohort,basis:scoring.basis,players:scoring.players}:null,
  setups:options,holes}};
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
