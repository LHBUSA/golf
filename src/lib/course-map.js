// Course Geo V1: OSM-derived current routing (ODbL) rendered as an original PBE SVG on course pages and PBEcast.
// Truth model: SPATIAL ROUTING (OSM, current, dated) is separate from CHAMPIONSHIP SETUP (par/yardage per edition)
// and from OBSERVED SCORING (contender cards). Geometry is never re-labelled as a historical setup, never moved to
// follow a setup's yardage, and never drawn when it was not sourced (Level C = yardage-book grid, not a map).
// No ball, player location, landing zone, line, pin or strategy is ever drawn.
import {e} from './ui.js';
import {windComponents} from './hole-intel.js';

export const ATTRIBUTION={text:'Course routing © OpenStreetMap contributors',url:'https://www.openstreetmap.org/copyright',licence:'ODbL 1.0',licence_url:'https://opendatacommons.org/licenses/odbl/1-0/'};

// ---- Preparation (offline / ingest side): OSM elements -> projected, simplified payload.
const R=6371008.8,rad=d=>d*Math.PI/180;
export function projector(lat0,lon0){const k=Math.cos(rad(lat0));return ([lon,lat])=>[rad(lon-lon0)*R*k,-rad(lat-lat0)*R];}
export function simplify(pts,tol=2){ // Douglas–Peucker in metres
 if(pts.length<3)return pts.slice();const d2=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy;let t=l?((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l:0;t=Math.max(0,Math.min(1,t));const x=a[0]+t*dx-p[0],y=a[1]+t*dy-p[1];return x*x+y*y;};
 let idx=0,max=0;for(let i=1;i<pts.length-1;i++){const v=d2(pts[i],pts[0],pts.at(-1));if(v>max){max=v;idx=i;}}
 if(max<=tol*tol)return [pts[0],pts.at(-1)];return [...simplify(pts.slice(0,idx+1),tol).slice(0,-1),...simplify(pts.slice(idx),tol)];
}
// Bearing (degrees from north) tee -> green along the observed route. OSM golf=hole ways are drawn tee to green.
export function bearing(lonlat){if(!lonlat||lonlat.length<2)return null;const [a,b]=[lonlat[0],lonlat.at(-1)];const y=Math.sin(rad(b[0]-a[0]))*Math.cos(rad(b[1])),x=Math.cos(rad(a[1]))*Math.sin(rad(b[1]))-Math.sin(rad(a[1]))*Math.cos(rad(b[1]))*Math.cos(rad(b[0]-a[0]));return (Math.atan2(y,x)*180/Math.PI+360)%360;}
const r1=v=>Math.round(v*10)/10;
/**
 * @param osm {course:{id,outer:[[lon,lat]...]}, holes:[{id,ref,par,coords:[[lon,lat]...]}], features:[{id,golf|natural,coords,closed}], as_of}
 * @param ours {slug,name,setup:{edition,year,label,par,yardage,holes:[{hole,par,yards}]}|null, scoring|null}
 * Hole numbers come only from an integer OSM ref in 1..18 that is unique within the matched course. Anything else
 * is left out (never guessed). OSM par is matching evidence only; displayed par/yardage always come from our setup.
 */
export function routeLengthM(lonlat){let s=0;for(let i=1;i<(lonlat||[]).length;i++){const [a,b]=[lonlat[i-1],lonlat[i]];const dl=rad(b[1]-a[1]),dn=rad(b[0]-a[0]),q=Math.sin(dl/2)**2+Math.cos(rad(a[1]))*Math.cos(rad(b[1]))*Math.sin(dn/2)**2;s+=2*R*Math.asin(Math.sqrt(q));}return s;}
/**
 * Prove each hole number. Accept an OSM golf=hole only when its integer ref (1..18) is unique inside the matched course,
 * OR — when a ref is duplicated (e.g. a par-3 course inside the same club polygon) — exactly one candidate has OSM par equal
 * to our setup par AND a mapped length within 20% of our setup yardage. Otherwise the hole is left unmapped (never guessed).
 */
export function resolveHoles(osmHoles,setupHoles=new Map()){
 const valid=(osmHoles||[]).filter(h=>{const n=Number(h.ref);return String(n)===String(h.ref).trim()&&Number.isInteger(n)&&n>=1&&n<=18&&h.coords?.length>=2;});
 const by=new Map();for(const h of valid){const n=Number(h.ref);by.set(n,[...(by.get(n)||[]),h]);}
 const accepted=[],rejected=[];
 for(const [n,c] of [...by].sort((a,b)=>a[0]-b[0])){
  if(c.length===1){accepted.push({...c[0],hole:n,proof:'unique_ref'});continue;}
  const s=setupHoles.get(n);const yd=s?.yards,par=s?.par;
  const ok=c.filter(h=>Number.isInteger(par)&&Number(h.par)===par&&Number.isInteger(yd)&&Math.abs(routeLengthM(h.coords)/0.9144-yd)/yd<=0.2);
  if(ok.length===1)accepted.push({...ok[0],hole:n,proof:'duplicate_ref_resolved_by_par_and_length'});else rejected.push({ref:n,candidates:c.length,reason:ok.length?'duplicate_ref_ambiguous':'duplicate_ref_no_par_length_match'});
 }
 for(const h of osmHoles||[])if(!valid.includes(h))rejected.push({ref:h.ref??null,candidates:1,reason:'ref_missing_or_not_1_18'});
 return {accepted,rejected};
}
export function prepareCourseMap(osm,ours,{tol=2,review=null,parConflicts=[]}={}){
 const outer=osm?.course?.outer||[];
 const setupHoles=new Map((ours?.setup?.holes||[]).map(h=>[h.hole,h]));
 const {accepted:holes,rejected}=resolveHoles(osm?.holes,setupHoles);
 const all=[...outer,...holes.flatMap(h=>h.coords)];
 const base={course:{slug:ours?.slug,name:ours?.name},setup:ours?.setup?{edition:ours.setup.edition,year:ours.setup.year,label:ours.setup.label,par:ours.setup.par,yardage:ours.setup.yardage,front:sum(ours.setup.holes,1,9),back:sum(ours.setup.holes,10,18)}:null,scoring:ours?.scoring||null,attribution:null,geometry:null};
 if(!all.length||!holes.length)return {...base,tier:'C',holes:Array.from({length:18},(_,i)=>({hole:i+1,par:setupHoles.get(i+1)?.par??null,yards:setupHoles.get(i+1)?.yards??null,route:null,bearing_deg:null,routing_observed:false}))};
 const lat0=all.reduce((s,p)=>s+p[1],0)/all.length,lon0=all.reduce((s,p)=>s+p[0],0)/all.length,P=projector(lat0,lon0);
 const proj=c=>simplify(c.map(P),tol).map(([x,y])=>[r1(x),r1(y)]);
 const projRing=c=>{const raw=c.map(P);for(let t=tol;t>=0.25;t/=2){const r=simplify(raw,t).map(([x,y])=>[r1(x),r1(y)]);if(r.length>=4&&!selfIntersects(r))return r;}return raw.map(([x,y])=>[r1(x),r1(y)]);};
 const pts=all.map(P),minX=Math.min(...pts.map(p=>p[0])),maxX=Math.max(...pts.map(p=>p[0])),minY=Math.min(...pts.map(p=>p[1])),maxY=Math.max(...pts.map(p=>p[1]));
 const byRef=new Map(holes.map(h=>[h.hole,h]));
 const out=Array.from({length:18},(_,i)=>{const n=i+1,h=byRef.get(n),s=setupHoles.get(n);return {hole:n,par:s?.par??null,yards:s?.yards??null,route:h?proj(h.coords):null,bearing_deg:h?Math.round(bearing(h.coords)):null,routing_observed:!!h,source_feature_id:h?h.id:null,proof:h?.proof||null};});
 const feat=k=>(osm.features||[]).filter(f=>k(f)&&f.closed&&f.coords?.length>=4).map(f=>projRing(f.coords));
 const mapped=out.filter(h=>h.route).length;
 // Identity still under review: never VERIFIED. An OSM par conflict is metadata only (geometry_metadata_conflicts).
 return {...base,tier:mapped===18&&!review?'A':'B',review:review||null,par_conflicts:parConflicts,
  geometry:{basis:'openstreetmap-current',as_of:osm.as_of||null,source_course_id:osm.course?.id||null,bounds:[r1(minX),r1(minY),r1(maxX),r1(maxY)],units:'metres (local equirectangular, north up)',outline:outer.length?projRing(outer):null,
   features:{fairway:feat(f=>f.golf==='fairway'),green:feat(f=>f.golf==='green'),tee:feat(f=>f.golf==='tee'),bunker:feat(f=>f.golf==='bunker'),water:feat(f=>/water_hazard/.test(f.golf||'')||f.natural==='water')}},
  holes:out,coverage:{holes_mapped:mapped,holes_total:18,rejected},attribution:ATTRIBUTION};
}
function sum(hs,a,b){const xs=(hs||[]).filter(h=>h.hole>=a&&h.hole<=b);return xs.length===b-a+1&&xs.every(h=>Number.isInteger(h.yards))?xs.reduce((s,h)=>s+h.yards,0):null;}
// Ring validity after simplification (topology-safe): any two non-adjacent edges crossing = invalid.
export function selfIntersects(r){const n=r.length-1;const x=(a,b,c,d)=>{const o=(p,q,s)=>Math.sign((q[0]-p[0])*(s[1]-p[1])-(q[1]-p[1])*(s[0]-p[0]));return o(a,b,c)*o(a,b,d)<0&&o(c,d,a)*o(c,d,b)<0;};
 for(let i=0;i<n;i++)for(let j=i+2;j<n;j++){if(i===0&&j===n-1)continue;if(x(r[i],r[i+1],r[j],r[j+1]))return true;}return false;}
// ---- Descriptive wind relative to the observed hole direction (tee -> green). Null whenever the bearing was not
// observed. Geometry + weather description only: never a scoring, club or shot effect.
export function relativeWind(bearingDeg,windFromDeg){
 if(!Number.isFinite(bearingDeg)||!Number.isFinite(windFromDeg))return null;
 const to=(windFromDeg+180)%360,a=((to-bearingDeg+540)%360)-180,x=Math.abs(a);
 const kind=x<=22.5?'tailwind':x<67.5?'quartering_tailwind':x<=112.5?'crosswind':x<157.5?'quartering_headwind':'headwind';
 const label={tailwind:'TAILWIND',quartering_tailwind:'QUARTERING TAILWIND',crosswind:a>0?'CROSSWIND · LEFT → RIGHT':'CROSSWIND · RIGHT → LEFT',quartering_headwind:'QUARTERING HEADWIND',headwind:'HEADWIND'}[kind];
 return {kind,label,angle:Math.round(a)};
}

// ---- Rendering from the public API model (GET /v1/courses/:slug/map). One edition supplies setup AND scoring.
const path=c=>c.map((p,i)=>`${i?'L':'M'}${p[0]},${p[1]}`).join('');
const poly=c=>path(c)+'Z';
const tp=v=>v==null?'—':v===0?'E':v>0?'+'+v:'−'+Math.abs(v);
export const tierOf=M=>M?.geometry_status==='VERIFIED ROUTING'?'A':M?.geometry_status==='PARTIAL ROUTING'?'B':'C';
export const spatialState=M=>({A:'VERIFIED ROUTING',B:'PARTIAL ROUTING',C:'SCORECARD LAYOUT'})[tierOf(M)];
const mappedCount=M=>(M?.holes||[]).filter(h=>h.route).length;
export function difficultyScale(M){
 const hs=(M?.holes||[]).filter(h=>h.scoring&&Number.isFinite(h.scoring.avg_to_par)&&h.scoring.sample>0);if(hs.length<9)return null;
 const v=hs.map(h=>h.scoring.avg_to_par),lo=Math.min(...v),hi=Math.max(...v);
 return {lo,hi,of:new Map(hs.map(h=>[h.hole,{t:hi===lo?0.5:(h.scoring.avg_to_par-lo)/(hi-lo),avg:h.scoring.avg_to_par,n:h.scoring.sample}]))};
}
function holeBox(h,pad=60){const xs=h.route.map(p=>p[0]),ys=h.route.map(p=>p[1]);return [Math.min(...xs)-pad,Math.min(...ys)-pad,Math.max(...xs)-Math.min(...xs)+2*pad,Math.max(...ys)-Math.min(...ys)+2*pad];}
const fitAr=([x,y,w,hh],ar)=>{if(w/hh<ar){const nw=hh*ar;x-=(nw-w)/2;w=nw;}else{const nh=w/ar;y-=(nh-hh)/2;hh=nh;}return [x,y,w,hh].map(r1);};
export function viewBoxFor(M,focus=null,ar=1.25){
 const h=focus!=null?M.holes.find(x=>x.hole===focus&&x.route):null;
 if(h)return fitAr(holeBox(h),ar);
 const [a,b,c,d]=M.bounds,p=Math.max(c-a,d-b)*0.04;return fitAr([a-p,b-p,c-a+2*p,d-b+2*p],ar);
}
/** Full-course or hole-focused SVG. `current` = the selected golfer's current hole: the whole route is highlighted;
 * no golfer, ball or position marker exists anywhere in this renderer. */
export function courseMapSvg(M,{focus=null,overlay=null,current=null,ar=1.25,px=600,view='overview',measure=null}={}){
 if(!M||tierOf(M)==='C'||!M.geometry)return '';
 const full=viewBoxFor(M,null,ar),vb=(focus!=null&&view==='approach'&&approachBox(M,focus,ar))||viewBoxFor(M,focus,ar),G=M.geometry.features,sc=overlay==='difficulty'?difficultyScale(M):null;
 const u=vb[2]/Math.max(280,px); // markers keep a constant on-screen size (px = rendered width) at any zoom
 const layer=(cls,arr)=>arr?.length?`<g class="cm-${cls}">${arr.map(c=>`<path d="${poly(c)}"/>`).join('')}</g>`:'';
 const routes=M.holes.filter(h=>h.route).map(h=>{const d=sc?.of.get(h.hole),cls=['cm-route',h.hole===focus?'is-focus':'',h.hole===current?'is-current':''].filter(Boolean).join(' ');
  const st=h.route[0];return `<g class="${cls}" data-hole="${h.hole}"><path class="cm-line${d?' cm-d'+Math.min(4,Math.floor(d.t*5)):''}" d="${path(h.route)}"/><path class="cm-hit" d="${path(h.route)}"/><g class="cm-num" transform="translate(${st[0]} ${st[1]}) scale(${r1(u*100)/100})"><circle r="11"/><text text-anchor="middle" dy="4">${h.hole}</text></g></g>`;}).join('');
 return `<svg class="cm-svg" viewBox="${vb.join(' ')}" data-full="${full.join(' ')}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${e(M.course.name)}: current mapped routing, ${mappedCount(M)} of 18 hole routes${focus?`, hole ${focus} focused`:''}${current?`, current hole ${current} highlighted`:''}. North is up."><rect class="cm-bg" x="-100000" y="-100000" width="200000" height="200000"/>${M.geometry.outline?`<path class="cm-outline" d="${poly(M.geometry.outline)}"/>`:''}${layer('fairway',G.fairway)}${layer('water',G.water)}${layer('tee',G.tee)}${layer('green',G.green)}${layer('bunker',G.bunker)}${routes}${focus!=null?focusOverlay(M,focus,{u,measure}):''}</svg>`;
}
const cohortNote=M=>M.scoring?`${M.scoring.cohort} · ${M.scoring.year} edition · ${M.scoring.basis}.${M.scoring.cohort==='Contender sample'?' Not the full field.':''}`:'';
const ord=n=>{const s=['th','st','nd','rd'],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0]);};
const SHAPE={dogleg_left:'Dogleg left',dogleg_right:'Dogleg right',mostly_straight:'Mostly straight'};
const BUCKET=[['eagle_or_better','Eagle or better'],['birdie','Birdie'],['par','Par'],['bogey','Bogey'],['double_or_worse','Double or worse']];
const plural=(n,w)=>`${n} ${w}${n===1?'':'s'}`;
function statsBlock(title,st,cohort,note){
 if(!st)return '';const rank=st.difficulty_rank?`${st.difficulty_tied?'T':''}${ord(st.difficulty_rank)} hardest of ${st.difficulty_of}`:null;
 return `<section class="cm-sec"><p class="cm-k2">${e(title)}</p><dl class="cm-dl cm-dl4">${st.scoring_average!=null?`<div><dt>Scoring average</dt><dd>${e(st.scoring_average.toFixed(2))}</dd></div>`:''}<div><dt>To par</dt><dd>${e(tp(st.avg_to_par))}</dd></div><div><dt>Observed cards</dt><dd>${e(st.sample)}</dd></div>${rank?`<div><dt>Difficulty</dt><dd>${e(rank)}</dd></div>`:''}</dl><p class="cm-note">${e(cohort)}${note?' · '+e(note):''}${cohort==='Contender sample'?' · not the full field':''}</p></section>`;
}
function distBlock(st){
 if(!st?.distribution)return '';const tot=BUCKET.reduce((s,[k])=>s+(st.distribution[k]?.count||0),0);if(tot!==st.sample)return '';
 return `<section class="cm-sec"><p class="cm-k2">SCORING</p><table class="cm-dist"><caption class="sr-only">Score distribution on this hole, ${e(st.sample)} observed cards</caption><tbody>${BUCKET.map(([k,l])=>{const x=st.distribution[k];return `<tr><th scope="row">${e(l)}</th><td class="cm-bar"><span data-w="${Math.round(x.pct)}"></span></td><td class="num">${e(x.count)}</td><td class="num">${e(x.pct.toFixed(1))}%</td></tr>`;}).join('')}</tbody></table></section>`;
}
function hazardText(hz){
 if(!hz)return [];const out=[],fl=hz.fairway_bunkers.left,fr=hz.fairway_bunkers.right;
 if(fl||fr)out.push(`${plural(fl+fr,'fairway-side bunker')}${fl&&fr?` (${fl} left, ${fr} right)`:fl?' (left)':' (right)'}`);
 if(hz.greenside_bunkers)out.push(plural(hz.greenside_bunkers,'green-side bunker'));
 for(const w of hz.water)out.push(w==='crossing'?'Water crossing the route':`Water ${w}`);
 return out;
}
const targetLabel=t=>t==='mapped_green_centre'?'mapped green (centre)':'mapped route end';
/**
 * Hole Intelligence rail. Sections: identity, scoring (today live round when given, else the selected edition), distance
 * (championship / mapped route / map measure), course (shape + hazards), distribution, wind (+ components), live, Hole DNA.
 * Every value is sourced or deterministically derived; a missing value is omitted, never zero.
 */
export function holePanel(M,hole,{wind=null,today=null,live=null,measure=null,nav=true}={}){
 const h=M.holes.find(x=>x.hole===hole);if(!h)return '';const yr=M.setup?.year;
 const gi=h.geometry_intelligence,hz=h.hazards,dr=h.distance_reference;
 const rw=wind&&h.geometry_status==='verified'?relativeWind(h.bearing_deg,wind.from_deg):null;
 const wc=rw?windComponents(h.bearing_deg,wind.from_deg,wind.mph):null;
 const ts=today?.stats?.get?.(hole)||null,es=h.scoring;
 const sc=ts?statsBlock(today.label,ts,'Observed field cards',today.note):es?statsBlock(`${yr} EDITION`,es,es.cohort,M.scoring?.basis):M.setup?`<section class="cm-sec"><p class="cm-k2">SCORING</p><p class="cm-note">No scoring sample available for the selected ${e(yr)} setup.</p></section>`:'';
 const dist=`<section class="cm-sec"><p class="cm-k2">DISTANCE</p><dl class="cm-dl cm-dlrows">${h.setup?.yards!=null?`<div><dt>Championship distance</dt><dd>${e(h.setup.yards)} yds <small>${e(yr)} setup</small></dd></div>`:''}${gi?.mapped_route_yards!=null?`<div><dt>Mapped route</dt><dd>~${e(gi.mapped_route_yards)} yds <small>current mapped routing</small></dd></div>`:''}${measure&&dr?`<div class="cm-measured"><dt>Map measure</dt><dd>~${e(measure.yards)} yds <small>to ${e(targetLabel(dr.target_type))}, from the point you selected</small> <button type="button" class="cm-linkbtn" data-cm-clear>Clear measure</button></dd></div>`:''}</dl>${dr&&!measure?`<p class="cm-note">Select Measure, then tap the map to measure to the ${e(targetLabel(dr.target_type))}.</p>`:''}</section>`;
 const course=[gi?.shape?`${SHAPE[gi.shape]}${gi.bend_distance_yards?` · bend ~${gi.bend_distance_yards} yds from the tee`:''}`:null,...hazardText(hz)].filter(Boolean);
 const courseSec=course.length?`<section class="cm-sec"><p class="cm-k2">COURSE</p><ul class="cm-list">${course.map(x=>`<li>${e(x)}</li>`).join('')}</ul><p class="cm-note">From the current mapped routing and features. Descriptive only.</p></section>`:'';
 const comp=c=>Math.abs(c)<1?'<1':Math.round(Math.abs(c));
 const w=rw?`<section class="cm-sec cm-wind"><p class="cm-k2">WIND</p><p class="cm-wv"><b>${e(wind.dir||'')} · ${e(wind.mph??'—')} MPH</b></p><p class="cm-wkind">${e(rw.label)}</p>${wc?`<p class="cm-wcomp">${e(comp(wc.along))} mph ${wc.along>=0?'tailwind':'headwind'} component · ${e(comp(wc.cross))} mph ${wc.cross>=0?'left → right':'right → left'} component</p>`:''}<p class="cm-note">PBE-derived from sourced routing + weather observation${wind.precision==='locality'?' (town-level estimate)':''}. Descriptive only.</p></section>`:'';
 const lv=live&&(live.next!=null||live.cards!=null)?`<section class="cm-sec"><p class="cm-k2">LIVE · HOLE ${e(hole)}</p><dl class="cm-dl cm-dl4">${live.next!=null?`<div><dt>Players with this as their next hole</dt><dd>${e(live.next)}</dd></div>`:''}${live.cards!=null?`<div><dt>Cards posted here today</dt><dd>${e(live.cards)}</dd></div>`:''}</dl><p class="cm-note">From posted holes on the live leaderboard (next hole = start hole + holes completed). Positions on the hole are not tracked.</p></section>`:'';
 const dstat=ts||es,dna=[];
 if(dstat?.difficulty_rank)dna.push(['Scoring difficulty',`${dstat.difficulty_tied?'T':''}${ord(dstat.difficulty_rank)} of ${dstat.difficulty_of} · ${tp(dstat.avg_to_par)}`,`${ts?today.label.toLowerCase():yr+' edition'} · ${dstat.sample} cards`]);
 if(dstat?.distribution){const b=dstat.distribution;dna.push(['Birdie-or-better rate',`${(b.eagle_or_better.pct+b.birdie.pct).toFixed(1)}%`,`${dstat.sample} observed cards`]);dna.push(['Bogey-or-worse rate',`${(b.bogey.pct+b.double_or_worse.pct).toFixed(1)}%`,`${dstat.sample} observed cards`]);}
 if(gi?.shape)dna.push(['Shape',SHAPE[gi.shape],`route geometry · ${gi.bend_angle_deg}° turn`]);
 if(hz){const n=hz.fairway_bunkers.left+hz.fairway_bunkers.right+hz.greenside_bunkers+hz.water.length;dna.push(['Hazards near the route',String(n),'mapped bunkers + water within 45 m of the verified route']);}
 if(wc)dna.push(['Wind exposure now',`${comp(wc.cross)} mph across · ${comp(wc.along)} mph along`,'current weather observation × verified bearing']);
 const dnaSec=dna.length?`<details class="cm-sec cm-dna"><summary>HOLE DNA <small>individual dimensions · no composite score</small></summary><dl class="cm-dl cm-dlrows">${dna.map(([k,v,b])=>`<div><dt>${e(k)}</dt><dd>${e(v)} <small>${e(b)}</small></dd></div>`).join('')}</dl></details>`:'';
 const route=h.geometry_status==='verified'?'':h.geometry_status==='withheld'?`<p class="cm-note">Hole ${h.hole} routing withheld pending identity verification.</p>`:tierOf(M)==='C'?'':`<p class="cm-note">Hole ${h.hole} routing is not mapped.</p>`;
 const prev=hole>1?hole-1:18,next=hole<18?hole+1:1;
 const id=[h.setup?.par!=null?`PAR ${e(h.setup.par)}`:null,h.setup?.yards!=null?`${e(h.setup.yards)} YDS`:null].filter(Boolean).join(' · ');
 return `<div class="cm-panel" data-cm-panel><p class="cm-k">HOLE ${h.hole}</p>${id?`<p class="cm-big">${id}</p>`:`<p class="cm-note">Hole par and yardage are not published for this setup.</p>`}${M.setup?`<p class="cm-sub">${e(yr)} CHAMPIONSHIP SETUP</p>`:''}${route}${sc}${dist}${courseSec}${distBlock(ts||es)}${w}${lv}${dnaSec}${nav?`<div class="cm-nav"><button type="button" data-cm-hole="${prev}" aria-label="Previous hole, ${prev}">◀ ${prev}</button><button type="button" data-cm-hole="${next}" aria-label="Next hole, ${next}">${next} ▶</button></div>`:''}</div>`;
}
/** Focused-hole overlays: route markers (yards to the target along the route), the target label, and a user measure.
 * None of these is a player or ball position. */
export function focusOverlay(M,focus,{u=1,measure=null}={}){
 const h=M.holes.find(x=>x.hole===focus&&x.route);const dr=h?.distance_reference;if(!dr)return '';
 const fs=r1(10.5*u),mk=(dr.route_markers||[]).map(m=>`<g class="cm-mk" transform="translate(${m.point[0]} ${m.point[1]})"><circle r="${r1(3.2*u)}"/><text x="${r1(6*u)}" y="${r1(3.5*u)}" font-size="${fs}">${m.yards}</text></g>`).join('');
 const t=dr.target,lab=dr.target_type==='mapped_green_centre'?'MAPPED GREEN':'ROUTE END';
 const tg=`<g class="cm-tg" transform="translate(${t[0]} ${t[1]})"><circle r="${r1(4.5*u)}"/><circle r="${r1(1.6*u)}" class="cm-tgc"/><text x="${r1(8*u)}" y="${r1(-6*u)}" font-size="${r1(9.5*u)}">${lab}</text></g>`;
 const ms=measure?`<g class="cm-ms"><path d="M${measure.point[0]},${measure.point[1]}L${t[0]},${t[1]}"/><circle cx="${measure.point[0]}" cy="${measure.point[1]}" r="${r1(4*u)}"/><text x="${r1(measure.point[0]+7*u)}" y="${r1(measure.point[1]-7*u)}" font-size="${r1(12*u)}">~${measure.yards} YDS</text></g>`:'';
 return `<g class="cm-overlay" aria-hidden="true">${mk}${tg}${ms}</g>`;
}
/** Approach view: the last ~230 yards of the verified route plus the target, padded. */
export function approachBox(M,focus,ar=1.25){
 const h=M.holes.find(x=>x.hole===focus&&x.route);const dr=h?.distance_reference;if(!dr)return null;
 const pts=[dr.target,...(dr.route_markers||[]).map(m=>m.point)];if(pts.length<2)pts.push(...h.route.slice(-2));
 const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]),pad=45;return fitAr([Math.min(...xs)-pad,Math.min(...ys)-pad,Math.max(...xs)-Math.min(...xs)+2*pad,Math.max(...ys)-Math.min(...ys)+2*pad],ar);
}

export function basisLabel(M){
 if(tierOf(M)==='C')return 'SCORECARD LAYOUT · NO MAPPED ROUTING';
 const n=mappedCount(M);return `${spatialState(M)} · ${n} OF 18 HOLE ROUTES VERIFIED · CURRENT MAPPED ROUTING${M.geometry_as_of?` · OPENSTREETMAP AS OF ${M.geometry_as_of.slice(0,10)}`:''}`;
}
/** Level C: a real scorecard (front / back; hole, par, yards) only when the setup publishes all 18 holes. */
export function scorecardTable(M){
 const hs=M.holes||[];if(hs.length!==18||hs.some(h=>h.setup?.par==null||h.setup?.yards==null))return '';
 const half=(a,b,lab)=>{const xs=hs.slice(a,b),sp=xs.reduce((t,h)=>t+h.setup.par,0),sy=xs.reduce((t,h)=>t+h.setup.yards,0);
  return `<tr><th scope="row">Hole</th>${xs.map(h=>`<th scope="col">${h.hole}</th>`).join('')}<th scope="col">${lab}</th></tr><tr><th scope="row">Par</th>${xs.map(h=>`<td>${e(h.setup.par)}</td>`).join('')}<td><b>${sp}</b></td></tr><tr><th scope="row">Yards</th>${xs.map(h=>`<td>${e(h.setup.yards)}</td>`).join('')}<td><b>${sy.toLocaleString('en-US')}</b></td></tr>`;};
 return `<div class="cm-sc-wrap" tabindex="0" role="region" aria-label="Scorecard"><table class="cm-sc"><caption>${e(M.setup?.year??'')} championship setup scorecard</caption><tbody>${half(0,9,'Out')}</tbody><tbody>${half(9,18,'In')}</tbody></table></div>`;
}
/** Level C: real par/yardage/order as a yardage-book grid. Never a map, never a shape. */
export function yardageBook(M){
 return `<div class="cm-book" role="group" aria-label="Hole par and yardage">${M.holes.map(h=>`<button type="button" class="cm-card" data-cm-hole="${h.hole}" aria-label="Hole ${h.hole}, par ${h.setup?.par??'unknown'}, ${h.setup?.yards??'unknown'} yards"><b>${h.hole}</b><span>PAR ${e(h.setup?.par??'—')}</span><small>${e(h.setup?.yards??'—')} YDS</small></button>`).join('')}</div>`;
}
const withheldNote=M=>(M.coverage?.withheld||[]).length?`<p class="cm-note cm-withheld">${M.coverage.withheld.map(w=>`Hole ${e(w.hole)} routing withheld pending identity verification.`).join(' ')}</p>`:'';
const conflictNote=M=>{const c=M.geometry_metadata_conflicts||[],p=c.filter(x=>x.field==='par').map(x=>x.hole),l=c.filter(x=>x.field==='length').map(x=>x.hole);return (p.length?` OpenStreetMap tags list a different par on hole${p.length>1?'s':''} ${p.join(', ')}.`:'')+(l.length?` The mapped route on hole${l.length>1?'s':''} ${l.join(', ')} differs in length from the setup yardage.`:'')+(c.length?' Par and yardage shown come from the tournament setup.':'');};
export function attributionLine(M){return tierOf(M)==='C'?'':`<p class="cm-attrib"><a href="${ATTRIBUTION.url}">© OpenStreetMap contributors</a> · course routing available under the <a href="${ATTRIBUTION.licence_url}">Open Database License</a> (<a href="/api/v1/open-data/course-routing">download</a>). Map geometry shows current mapping, not a historical setup.${e(conflictNote(M))}</p>`;}
/**
 * mode 'page': setup selector + routing/difficulty toggle + hole keys + focused-hole panel.
 * mode 'cast': PBEcast Course View (current hole + synced focus; the setup is the live edition).
 */
export function courseMapModule(M,{focus=null,overlay=null,current=null,wind=null,mode='page',ar=1.25,px=600,view='overview',measure=null,measuring=false,today=null,live=null}={}){
 const tier=tierOf(M);
 const sel=mode==='page'&&(M.setups||[]).length>1?`<label class="cm-setupsel">Championship setup <select data-cm-setup>${M.setups.map(x=>`<option value="${e(x.edition)}"${x.edition===M.setup?.edition?' selected':''}>${e(x.year)} · ${e(String(x.name||'').replace(/^\d{4}\s+/,''))}</option>`).join('')}</select></label>`:'';
 const setup=M.setup?`<p class="cm-setup">${tier==='C'?'':'Current mapped routing · '}${e(M.setup.year)} championship setup · PAR ${e(M.setup.par??'—')} · ${e(M.setup.yardage?.toLocaleString('en-US')??'—')} YDS${M.setup.front&&M.setup.back?` · FRONT ${e(M.setup.front.toLocaleString('en-US'))} · BACK ${e(M.setup.back.toLocaleString('en-US'))}`:''}</p>`:'';
 const canDiff=mode==='page'&&tier!=='C'&&difficultyScale(M);
 const modes=canDiff?`<div class="cm-modes" role="group" aria-label="Map layer"><button type="button" data-cm-overlay="routing" aria-pressed="${overlay!=='difficulty'}">Routing</button><button type="button" data-cm-overlay="difficulty" aria-pressed="${overlay==='difficulty'}">Scoring difficulty</button></div>`:'';
 const ch=current!=null?M.holes.find(h=>h.hole===current):null;
 const cur=ch&&tier!=='C'?`<p class="cm-current"><span>CURRENT HOLE</span> <b>${e(ch.hole)}</b>${ch.setup?.par!=null?` · PAR ${e(ch.setup.par)}`:''}${ch.setup?.yards!=null?` · ${e(ch.setup.yards)} YDS`:''}${ch.geometry_status!=='verified'?' · ROUTE NOT MAPPED':''}</p>`:'';
 const legend=overlay==='difficulty'&&canDiff?`<p class="cm-legend"><span class="cm-ramp" aria-hidden="true"></span> Scoring difficulty · easier → harder by average to par · ${e(cohortNote(M))}</p>`:'';
 const keys=tier==='C'?'':`<div class="cm-keys" role="group" aria-label="Select a hole">${M.holes.map(h=>`<button type="button" data-cm-hole="${h.hole}" aria-pressed="${h.hole===focus}" class="${h.geometry_status==='verified'?'':'is-unmapped'}${h.hole===current?' is-current':''}" aria-label="Hole ${h.hole}${h.geometry_status==='verified'?'':h.geometry_status==='withheld'?', routing withheld':', routing not mapped'}${h.hole===current?', current hole':''}">${h.hole}</button>`).join('')}</div>`;
 if(tier==='C')return noLayoutModule(M,{mode});
 const body=courseMapSvg(M,{focus,overlay,current,ar,px,view,measure});
 const fh=focus!=null?M.holes.find(h=>h.hole===focus&&h.route&&h.distance_reference):null;
 const tools=fh?`<div class="cm-tools" role="group" aria-label="Focused hole view"><button type="button" data-cm-view="overview" aria-pressed="${view!=='approach'}">Overview</button><button type="button" data-cm-view="approach" aria-pressed="${view==='approach'}">Approach</button><button type="button" data-cm-measure aria-pressed="${measuring}">${measuring?'Measuring: tap the map':'Measure'}</button>${measure?'<button type="button" data-cm-clear>Clear measure</button>':''}</div><p class="cm-note cm-layer">Route markers: yards to the ${fh.distance_reference.target_type==='mapped_green_centre'?'mapped green (centre)':'mapped route end'} along the verified route. Map reference marks, not player positions.</p>`:'';
 const noMap=tier==='C'?`<p class="cm-note">No mapped routing for this course yet. Par and yardage come from the ${e(M.setup?.year??'')} championship setup.</p>`:'';
 return `<section class="cm cm-${mode}" data-course-map data-tier="${tier}"><header class="cm-head"><p class="cm-k">${mode==='cast'?'COURSE VIEW':'COURSE MAP'}</p><p class="cm-basis">${e(basisLabel(M))}</p>${setup}<div class="cm-controls">${sel}${modes}</div></header>${cur}<div class="cm-stage${measuring?' is-measuring':''}" data-cm-stage>${body}</div>${tools}${keys}${noMap}${withheldNote(M)}${legend}<div data-cm-panelhost>${focus!=null?holePanel(M,focus,{wind,today,live,measure}):''}</div>${attributionLine(M)}</section>`;
}

/** No mapped routing: an intentional state (what we know, what is missing, why), plus a real scorecard if one exists. */
export function noLayoutModule(M,{mode='page'}={}){
 const S=M.setup,why=M.routing_status?.text||'No mapped routing yet',sc=scorecardTable(M);
 const known=S?`${e(S.year)} championship setup · Par ${e(S.par??'—')}${S.yardage?` · ${e(S.yardage.toLocaleString('en-US'))} yards`:''}${S.front&&S.back?` · Front ${e(S.front.toLocaleString('en-US'))} · Back ${e(S.back.toLocaleString('en-US'))}`:''}`:'No championship setup is published for this course yet.';
 return `<section class="cm cm-${mode} cm-nolayout" data-course-map data-tier="C"><header class="cm-head"><p class="cm-k">COURSE LAYOUT</p><h3 class="cm-empty-h">Course layout not yet mapped</h3><p class="cm-chip">${e(why)}</p></header>
<dl class="cm-known"><div><dt>What we know</dt><dd>${known}</dd></div><div><dt>What is missing</dt><dd>Mapped hole routing (tee-to-green geometry). We draw a course only once its routing is verified; nothing is approximated.</dd></div></dl>
${sc?`<div class="cm-scbox"><p class="cm-k2">SCORECARD LAYOUT ONLY · NO MAPPED ROUTING YET</p>${sc}</div>`:''}</section>`;
}
