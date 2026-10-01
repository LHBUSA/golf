// Wikidata Query Service (documented SPARQL endpoint, CC0) catalog lane.
import {sparql,qid} from './capture.js';
export const WDQS_PARSER='wikidata-wdqs-golf/1.0.0';
// Championship series in scope. major_from encodes the year a series became a recognised major;
// earlier editions stay in the archive but are not counted as majors.
export const SERIES=[
 {qid:'Q280275',key:'masters',division:'men',major_from:1934,tour:'pga-tour'},
 {qid:'Q828160',key:'pga-championship',division:'men',major_from:1916,tour:'pga-tour'},
 {qid:'Q259776',key:'us-open',division:'men',major_from:1895,tour:'pga-tour'},
 {qid:'Q848797',key:'the-open',division:'men',major_from:1860,tour:'pga-tour'},
 {qid:'Q1971029',key:'players',division:'men',major_from:null,tour:'pga-tour'},
 {qid:'Q1785973',key:'chevron',division:'women',major_from:1983,tour:'lpga'},
 {qid:'Q2300124',key:'us-womens-open',division:'women',major_from:1946,tour:'lpga'},
 {qid:'Q281917',key:'womens-pga',division:'women',major_from:1955,tour:'lpga'},
 {qid:'Q2487426',key:'evian',division:'women',major_from:2013,tour:'lpga'},
 {qid:'Q429896',key:'womens-open',division:'women',major_from:2001,tour:'lpga'}
];
export const GOLF='Q5377';
const precise=(v,p)=>v&&Number(p)===11?v.slice(0,10):null;
const list=v=>v?v.split('|').filter(Boolean):[];
export const editionsQuery=series=>`SELECT ?ed ?edLabel ?series ?start ?startP ?end ?endP ?pit ?pitP ?article ?mod (GROUP_CONCAT(DISTINCT ?venue;separator="|") AS ?venues) (GROUP_CONCAT(DISTINCT ?winner;separator="|") AS ?winners) WHERE {
 VALUES ?series { ${series.map(s=>'wd:'+s.qid).join(' ')} }
 ?ed wdt:P31 ?series ; schema:dateModified ?mod .
 OPTIONAL { ?ed p:P580/psv:P580 [ wikibase:timeValue ?start ; wikibase:timePrecision ?startP ] }
 OPTIONAL { ?ed p:P582/psv:P582 [ wikibase:timeValue ?end ; wikibase:timePrecision ?endP ] }
 OPTIONAL { ?ed p:P585/psv:P585 [ wikibase:timeValue ?pit ; wikibase:timePrecision ?pitP ] }
 OPTIONAL { ?ed wdt:P276 ?venue } OPTIONAL { ?ed wdt:P1346 ?winner }
 OPTIONAL { ?article schema:about ?ed ; schema:isPartOf <https://en.wikipedia.org/> }
 OPTIONAL { ?ed rdfs:label ?edLabel FILTER(LANG(?edLabel)="en") }
} GROUP BY ?ed ?edLabel ?series ?start ?startP ?end ?endP ?pit ?pitP ?article ?mod`;
export function parseEditions(rows){
 const by=new Map();
 for(const r of rows){const q=qid(r.ed);if(!q)continue;const e=by.get(q)||{qid:q,label:r.edLabel||null,series:qid(r.series),venues:new Set(),winners:new Set(),starts:new Set(),ends:new Set(),points:new Set(),article:null,modified:r.mod};
  list(r.venues).forEach(v=>e.venues.add(qid(v)));list(r.winners).forEach(v=>e.winners.add(qid(v)));
  if(precise(r.start,r.startP))e.starts.add(precise(r.start,r.startP));if(precise(r.end,r.endP))e.ends.add(precise(r.end,r.endP));
  if(r.pit)e.points.add(JSON.stringify({time:r.pit,precision:Number(r.pitP)}));if(r.article)e.article=decodeURIComponent(r.article.split('/wiki/')[1]||'').replace(/_/g,' ')||null;by.set(q,e);}
 return [...by.values()].map(e=>{
  const year=Number((e.label||'').match(/^(\d{4})\b/)?.[1])||Number([...e.starts][0]?.slice(0,4))||null;
  return {qid:e.qid,label:e.label,series:e.series,year,starts_on:e.starts.size===1?[...e.starts][0]:null,ends_on:e.ends.size===1?[...e.ends][0]:null,points:[...e.points].map(x=>JSON.parse(x)),venues:[...e.venues].filter(Boolean),winners:[...e.winners].filter(Boolean),article:e.article,modified:e.modified};
 }).filter(e=>e.label&&e.year);
}
export const playersQuery=qids=>`SELECT ?p ?pLabel ?mod ?article (SAMPLE(?dob) AS ?dob_) (SAMPLE(?dobP) AS ?dobP_) (SAMPLE(?sex) AS ?sex_) (GROUP_CONCAT(DISTINCT ?inst;separator="|") AS ?inst_) (GROUP_CONCAT(DISTINCT ?sport;separator="|") AS ?sports) (GROUP_CONCAT(DISTINCT ?occ;separator="|") AS ?occs) (GROUP_CONCAT(DISTINCT ?cit;separator="|") AS ?citizenships) (GROUP_CONCAT(DISTINCT ?cfs;separator="|") AS ?sportCountries) (SAMPLE(?image) AS ?image_) (SAMPLE(?pga) AS ?pga_) (SAMPLE(?lpga) AS ?lpga_) (SAMPLE(?euro) AS ?euro_) (SAMPLE(?owgr) AS ?owgr_) (SAMPLE(?hof) AS ?hof_) WHERE {
 VALUES ?p { ${qids.map(q=>'wd:'+q).join(' ')} }
 ?p schema:dateModified ?mod .
 OPTIONAL { ?p rdfs:label ?pLabel FILTER(LANG(?pLabel)="en") }
 OPTIONAL { ?p wdt:P31 ?inst } OPTIONAL { ?p wdt:P641 ?sport } OPTIONAL { ?p wdt:P106 ?occ } OPTIONAL { ?p wdt:P21 ?sex }
 OPTIONAL { ?p p:P569/psv:P569 [ wikibase:timeValue ?dob ; wikibase:timePrecision ?dobP ] }
 OPTIONAL { ?p wdt:P27 ?cit } OPTIONAL { ?p wdt:P1532 ?cfs }
 OPTIONAL { ?p wdt:P18 ?image } OPTIONAL { ?p wdt:P2811 ?pga } OPTIONAL { ?p wdt:P2810 ?lpga } OPTIONAL { ?p wdt:P3521 ?euro } OPTIONAL { ?p wdt:P3568 ?owgr } OPTIONAL { ?p wdt:P4461 ?hof }
 OPTIONAL { ?article schema:about ?p ; schema:isPartOf <https://en.wikipedia.org/> }
} GROUP BY ?p ?pLabel ?mod ?article`;
export const countriesQuery=qids=>`SELECT ?c ?cLabel (SAMPLE(?iso) AS ?iso_) WHERE { VALUES ?c { ${qids.map(q=>'wd:'+q).join(' ')} } OPTIONAL { ?c wdt:P297 ?iso } OPTIONAL { ?c rdfs:label ?cLabel FILTER(LANG(?cLabel)="en") } } GROUP BY ?c ?cLabel`;
export function parsePlayers(rows,countryMap=new Map()){
 const countries=v=>list(v).map(x=>{const q=qid(x),c=countryMap.get(q);return {qid:q,iso:c?.iso||null,label:c?.label||null};}).filter(x=>x.qid);
 return rows.map(r=>{
  const inst=list(r.inst).map(qid),sports=list(r.sports).map(qid),occs=list(r.occs).map(qid);
  const golfer=sports.includes(GOLF)||occs.includes('Q13156709')||occs.includes('Q11303721');
  const sex=qid(r.sex),cit=countries(r.citizenships),cfs=countries(r.sportCountries);
  // Country for sport is the representation a golfer competes under; citizenship is the fallback.
  const rep=cfs.length===1?cfs[0]:cit.length===1?cit[0]:null;
  return {qid:qid(r.p),name:r.pLabel||null,human:inst.includes('Q5'),golfer,birth_date:precise(r.dob,r.dobP),birth_year:r.dob&&Number(r.dobP)>=9?Number(r.dob.slice(0,4)):null,sex:sex==='Q6581097'?'male':sex==='Q6581072'?'female':null,country:rep,citizenships:cit,sport_countries:cfs,image:r.image?decodeURIComponent(r.image.split('/Special:FilePath/')[1]||'').replace(/_/g,' ')||null:null,external_ids:Object.fromEntries([['pga_tour',r.pga],['lpga',r.lpga],['dp_world_tour',r.euro],['owgr',r.owgr],['world_golf_hall_of_fame',r.hof]].filter(x=>x[1])),article:r.article?decodeURIComponent(r.article.split('/wiki/')[1]||'').replace(/_/g,' '):null,modified:r.mod};
 }).filter(p=>p.qid);
}
export const venuesQuery=qids=>`SELECT ?v ?vLabel ?vDesc ?mod ?article (SAMPLE(?coord) AS ?coord_) (SAMPLE(?iso) AS ?iso_) (SAMPLE(?countryLabel) AS ?countryLabel_) (SAMPLE(?localityLabel) AS ?localityLabel_) (SAMPLE(?image) AS ?image_) (SAMPLE(?opened) AS ?opened_) (SAMPLE(?openedP) AS ?openedP_) (GROUP_CONCAT(DISTINCT ?inst;separator="|") AS ?inst_) (GROUP_CONCAT(DISTINCT ?sport;separator="|") AS ?sports) (GROUP_CONCAT(DISTINCT ?architectLabel;separator="|") AS ?architects) WHERE {
 VALUES ?v { ${qids.map(q=>'wd:'+q).join(' ')} }
 ?v schema:dateModified ?mod .
 OPTIONAL { ?v rdfs:label ?vLabel FILTER(LANG(?vLabel)="en") } OPTIONAL { ?v schema:description ?vDesc FILTER(LANG(?vDesc)="en") }
 OPTIONAL { ?v wdt:P31 ?inst } OPTIONAL { ?v wdt:P641 ?sport } OPTIONAL { ?v wdt:P625 ?coord }
 OPTIONAL { ?v wdt:P17 ?country . OPTIONAL { ?country wdt:P297 ?iso } OPTIONAL { ?country rdfs:label ?countryLabel FILTER(LANG(?countryLabel)="en") } }
 OPTIONAL { ?v wdt:P131 ?loc . ?loc rdfs:label ?localityLabel FILTER(LANG(?localityLabel)="en") }
 OPTIONAL { ?v wdt:P18 ?image } OPTIONAL { ?v p:P571/psv:P571 [ wikibase:timeValue ?opened ; wikibase:timePrecision ?openedP ] }
 OPTIONAL { ?v wdt:P84 ?architect . ?architect rdfs:label ?architectLabel FILTER(LANG(?architectLabel)="en") }
 OPTIONAL { ?article schema:about ?v ; schema:isPartOf <https://en.wikipedia.org/> }
} GROUP BY ?v ?vLabel ?vDesc ?mod ?article`;
const GOLF_VENUE=new Set(['Q1048525','Q2022036','Q1054671','Q1137210','Q20972836']);
export function parseVenues(rows){
 return rows.map(r=>{
  const inst=list(r.inst).map(qid),sports=list(r.sports).map(qid);
  const coord=r.coord?.match(/^Point\(([-\d.]+) ([-\d.]+)\)$/);
  return {qid:qid(r.v),name:r.vLabel||null,description:r.vDesc||null,golf_venue:sports.includes(GOLF)||inst.some(i=>GOLF_VENUE.has(i))||/golf (course|club|links|resort)|country club|golf/i.test(r.vDesc||''),country_code:r.iso||null,country_name:r.countryLabel||null,locality:r.localityLabel||null,latitude:coord?Number(coord[2]):null,longitude:coord?Number(coord[1]):null,image:r.image?decodeURIComponent(r.image.split('/Special:FilePath/')[1]||'').replace(/_/g,' ')||null:null,opened_year:r.opened&&Number(r.openedP)>=9?Number(r.opened.slice(0,5).replace('+','')):null,architects:list(r.architects),article:r.article?decodeURIComponent(r.article.split('/wiki/')[1]||'').replace(/_/g,' '):null,modified:r.mod};
 }).filter(v=>v.qid);
}
export async function fetchEditions(env,db){const {capture,rows}=await sparql(env,db,editionsQuery(SERIES),WDQS_PARSER);return {capture,editions:parseEditions(rows)};}
export async function fetchPlayers(env,db,qids){
 const raw=[];for(let i=0;i<qids.length;i+=100){const {capture,rows}=await sparql(env,db,playersQuery(qids.slice(i,i+100)),WDQS_PARSER);raw.push(...rows.map(r=>({...r,capture_id:capture.id})));}
 const cq=[...new Set(raw.flatMap(r=>[...list(r.citizenships),...list(r.sportCountries)]).map(qid).filter(Boolean))],countryMap=new Map();
 for(let i=0;i<cq.length;i+=200){const {rows}=await sparql(env,db,countriesQuery(cq.slice(i,i+200)),WDQS_PARSER);for(const r of rows)countryMap.set(qid(r.c),{iso:r.iso||null,label:r.cLabel||null});}
 return {players:raw.map(r=>({...parsePlayers([r],countryMap)[0],capture_id:r.capture_id})).filter(p=>p.qid)};
}
export async function fetchVenues(env,db,qids){const out=[];for(let i=0;i<qids.length;i+=120){const {capture,rows}=await sparql(env,db,venuesQuery(qids.slice(i,i+120)),WDQS_PARSER);out.push(...parseVenues(rows).map(v=>({...v,capture_id:capture.id})));}return out;}
export const seriesQuery=series=>`SELECT ?s ?sLabel ?mod (SAMPLE(?orgLabel) AS ?organizer) WHERE { VALUES ?s { ${series.map(s=>'wd:'+s.qid).join(' ')} } ?s schema:dateModified ?mod . OPTIONAL { ?s rdfs:label ?sLabel FILTER(LANG(?sLabel)="en") } OPTIONAL { ?s wdt:P664 ?org . ?org rdfs:label ?orgLabel FILTER(LANG(?orgLabel)="en") } } GROUP BY ?s ?sLabel ?mod`;
export async function fetchSeries(env,db){const {capture,rows}=await sparql(env,db,seriesQuery(SERIES),WDQS_PARSER);return rows.map(r=>({qid:qid(r.s),name:r.sLabel||null,organizer:r.organizer||null,modified:r.mod,capture_id:capture.id}));}
