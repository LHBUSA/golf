// Public vs All Access projections. Used by golf-api AND the static prerender, so premium values
// never reach static HTML or unauthenticated responses.
export const norm=s=>String(s||'').normalize('NFKD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
export const canonicalPair=(a,b)=>[a,b].sort();
const fingerprint=dna=>{const w=dna?.l24m&&Object.values(dna.l24m.metrics).some(m=>m.percentile!==null)?dna.l24m:dna?.all;if(!w)return null;return {window:w.window.label,division:w.division,cohort:w.cohort,editions:w.editions,dimensions:Object.entries(w.metrics).map(([code,m])=>({code,percentile:m.percentile,confidence:m.confidence,sample:m.sample,basis:m.basis,cohort_size:m.cohort_size??null}))};};
// Public fingerprint from a raw doc (dna) or an already-public doc (dna_public). Idempotent.
const pubFp=d=>d?.dna?fingerprint(d.dna):(d?.dna_public??null);
export function publicPlayer(d){const {dna,dna_public,...rest}=d;return {...rest,recent:d.results.slice(0,10),course_history:d.course_history.map(h=>({...h})),dna_public:pubFp(d),premium:{available:Boolean(dna)||Boolean(d.premium?.available),modules:['raw DNA values and cohort sizes','24-month and all-observed windows','Course Fit components','matchup DNA detail']}};}
export function premiumPlayer(d){return {slug:d.slug,name:d.name,dna:d.dna};}
export function publicCourse(d){return {...d,player_history:d.player_history.map(({fit,...h})=>h)};}
export function premiumCourse(d){return {slug:d.slug,name:d.name,dna:d.dna,fit:d.player_history.map(h=>({slug:h.slug,name:h.name,fit:h.fit}))};}
export function publicEdition(d){const f=d.field;return {...d,field:f?{method:f.method,time_safe:f.time_safe,players:f.players,major_champions:f.major_champions.map(({form,form_rounds,course_vs_field,course_rounds,...r})=>r),first_observed_appearances:f.first_observed_appearances,premium_sections:['recent_form_leaders','course_history_leaders']}:null};}
export function premiumEdition(d){return {slug:d.slug,name:d.name,field:d.field};}
export function searchIndex(ix,q,limit=12){
 const n=norm(q);if(n.length<2)return {query:q,players:[],tournaments:[],courses:[]};
 const terms=n.split(' ');
 const score=name=>{const t=norm(name),words=t.split(' ');if(t===n)return 100;if(t.startsWith(n))return 80;if(terms.every(x=>words.some(w=>w.startsWith(x))))return 60;if(t.includes(n))return 40;return 0;};
 const rank=(rows,key,boost)=>rows.map(r=>({r,s:score(r[key])+(boost?boost(r):0)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s).slice(0,limit).map(x=>x.r);
 // Aliases are presentation only (accent-free, punctuation-free); identity is never merged by name.
 const series=new Map();for(const e of ix.editions)if(e.tournament&&!series.has(e.tournament.slug))series.set(e.tournament.slug,{slug:e.series_key?'/majors/'+e.series_key:'/tournament/'+e.slug,name:e.tournament.name,latest:e.slug,year:e.year});
 return {query:q,players:rank(ix.players,'name',r=>Math.min(10,r.events_observed/5)).map(p=>({slug:p.slug,name:p.name,country:p.country,division:p.division,photo:p.photo})),tournaments:[...rank([...series.values()],'name'),...rank(ix.editions,'name').map(e=>({slug:'/tournament/'+e.slug,name:e.name,year:e.year}))].slice(0,limit),courses:rank(ix.courses,'name').map(c=>({slug:c.slug,name:c.name,locality:c.locality,country:c.country}))};
}
function shared(a,b){
 const ma=new Map(a.results.map(r=>[r.edition.slug,r])),out=[];
 for(const r of b.results){const x=ma.get(r.edition.slug);if(x)out.push({edition:r.edition,a:{position:x.position,tied:x.tied,status:x.status,to_par:x.to_par,rounds:x.rounds},b:{position:r.position,tied:r.tied,status:r.status,to_par:r.to_par,rounds:r.rounds}});}
 const rank=s=>s.status==='finished'&&s.position?s.position:s.status==='finished'?500:s.status==='cut'?900:1000;
 let aHigher=0,bHigher=0,same=0;
 for(const s of out){const ra=rank(s.a),rb=rank(s.b);if(ra>=900&&rb>=900){same++;continue;}if(ra<rb)aHigher++;else if(rb<ra)bHigher++;else same++;}
 return {events:out.sort((x,y)=>String(y.edition.ends_on||y.edition.year).localeCompare(String(x.edition.ends_on||x.edition.year))),a_higher_finish:aHigher,b_higher_finish:bHigher,level_or_both_missed:same,wording:'Higher finish in shared events (stroke play; not direct head-to-head competition).'};
}
const record=p=>({slug:p.slug,name:p.name,country:p.country,division:p.division,age:p.age,photo:p.photo,summary:p.summary,visuals:p.visuals?{form:p.visuals.form,round_profile:p.visuals.round_profile,finish_distribution:p.visuals.finish_distribution}:null,bag_dna:p.bag_dna||null,recent:p.results.slice(0,10).map(r=>({edition:r.edition,position:r.position,tied:r.tied,status:r.status,to_par:r.to_par}))});
export function matchupPublic(a,b){
 const courses=new Map(b.course_history.map(h=>[h.course.slug,h])),commonCourses=a.course_history.filter(h=>courses.has(h.course.slug)).map(h=>({course:h.course,a:{...h,editions:undefined},b:{...courses.get(h.course.slug),editions:undefined}}));
 return {a:record(a),b:record(b),same_division:a.division===b.division,dna:{a:pubFp(a),b:pubFp(b),comparable:a.division===b.division,note:a.division===b.division?'Percentiles compare each player with their own division cohort.':'Different division cohorts: percentiles are not directly comparable.'},shared:shared(a,b),common_courses:commonCourses,prediction:null,prediction_reason:'No validated matchup model; this page is descriptive intelligence, not a pick.'};
}
export function matchupPremium(a,b){return {a:{slug:a.slug,dna:a.dna},b:{slug:b.slug,dna:b.dna}};}

// Public projection documents (GET /v1/projection/*): premium values never leave the API unauthenticated.
// Player docs keep their shape minus raw DNA (both windows, raw values, numerators), plus the public fingerprint;
// course docs drop Course Fit; edition docs drop premium field form. The static build consumes these and renders
// through the same public views, so its output is unchanged.
export function publicPlayerDoc(d){if(!d)return d;const {dna,...rest}=d;return {...rest,dna_public:pubFp(d),premium:{available:Boolean(dna)||Boolean(d.premium?.available)}};}
export function projectionPublic(key,doc){
 if(!doc||typeof doc!=='object')return doc;
 if(key.startsWith('players/'))return publicDoc(publicPlayerDoc(doc));
 if(key.startsWith('courses/'))return publicDoc(doc.player_history?publicCourse(doc):doc);
 if(key.startsWith('editions/'))return publicDoc(publicEdition(doc));
 if(key==='bundle.json')return publicDoc({...doc,players:(doc.players||[]).map(publicPlayerDoc),courses:(doc.courses||[]).map(c=>c.player_history?publicCourse(c):c),editions:(doc.editions||[]).map(publicEdition)});
 return publicDoc(doc);
}

// Customer source boundary (PropBetEdge network standard "DATA · PropSports"). Public documents attribute facts to
// PropSports, not to the collection lane that supplied them. Upstream ids, endpoint URLs and lane names stay in the
// internal projection (R2), captures and the documented provenance blocks, which pass through untouched.
export const PUBLIC_SOURCE='PropSports';
export const PUBLIC_ATTRIBUTION='Results adapted in part from Wikipedia contributors (CC BY-SA 4.0; the redistributed results dataset is available under the same licence). Photographs carry per-image credit (Wikimedia Commons). Forecasts: NOAA National Weather Service and MET Norway (CC BY 4.0). Course routing © OpenStreetMap contributors (ODbL) where mapped.';
const LANE=/\s*\(ESPN\)|\bESPN(?:'s)?(?: Golf)?(?: core)?(?: API)?\b/g;
export const brandText=s=>typeof s==='string'?s.replace(LANE,m=>m.trim().startsWith('(')?'':PUBLIC_SOURCE):s;
// provenance / source_state / sources are the documented provenance contract; image URLs and credits stay as published.
const KEEP=new Set(['provenance','source_state','sources','photo','headshot','media_credits','credit']);
const TEXT=new Set(['source','basis','note','label','reason','wording','formula','qualification']);
const MODE={espn_core_snapshots:'observed_snapshots',espn_core:'observed','espn-core-observed':'observed'};
function walk(v){
 if(Array.isArray(v))return v.map(walk);
 if(!v||typeof v!=='object')return v;
 const out={};
 for(const [k,x] of Object.entries(v)){
  if(KEEP.has(k)){out[k]=x;continue;}
  if(k==='external_ids'||k==='profile_url'||/(^|_)espn_|_espn$/.test(k))continue;
  if(k==='espn'){if(x&&typeof x==='object'){const {event_id,...rest}=x;out.event_record=walk(rest);}continue;}
  if((k==='live_scoring'||k==='tee_times')&&typeof x==='string'){out[k]=MODE[x]||x;continue;}
  out[k]=typeof x==='string'?(TEXT.has(k)?brandText(x):x):walk(x);
 }
 return out;
}
export function publicDoc(doc){return walk(doc);}
