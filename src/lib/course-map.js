// Course Geo V1: OSM-derived current routing (ODbL) rendered as an original PBE SVG on course pages and PBEcast.
// Truth model: SPATIAL ROUTING (OSM, current, dated) is separate from CHAMPIONSHIP SETUP (par/yardage per edition)
// and from OBSERVED SCORING (contender cards). Geometry is never re-labelled as a historical setup, never moved to
// follow a setup's yardage, and never drawn when it was not sourced (Level C = yardage-book grid, not a map).
// No ball, player location, landing zone, line, pin or strategy is ever drawn.
import {e} from './ui.js';

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
export function courseMapSvg(M,{focus=null,overlay=null,current=null,ar=1.25,px=600}={}){
 if(!M||tierOf(M)==='C'||!M.geometry)return '';
 const full=viewBoxFor(M,null,ar),vb=viewBoxFor(M,focus,ar),G=M.geometry.features,sc=overlay==='difficulty'?difficultyScale(M):null;
 const u=vb[2]/Math.max(280,px); // markers keep a constant on-screen size (px = rendered width) at any zoom
 const layer=(cls,arr)=>arr?.length?`<g class="cm-${cls}">${arr.map(c=>`<path d="${poly(c)}"/>`).join('')}</g>`:'';
 const routes=M.holes.filter(h=>h.route).map(h=>{const d=sc?.of.get(h.hole),cls=['cm-route',h.hole===focus?'is-focus':'',h.hole===current?'is-current':''].filter(Boolean).join(' ');
  const st=h.route[0];return `<g class="${cls}" data-hole="${h.hole}"><path class="cm-line${d?' cm-d'+Math.min(4,Math.floor(d.t*5)):''}" d="${path(h.route)}"/><path class="cm-hit" d="${path(h.route)}"/><g class="cm-num" transform="translate(${st[0]} ${st[1]}) scale(${r1(u*100)/100})"><circle r="11"/><text text-anchor="middle" dy="4">${h.hole}</text></g></g>`;}).join('');
 return `<svg class="cm-svg" viewBox="${vb.join(' ')}" data-full="${full.join(' ')}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${e(M.course.name)}: current mapped routing, ${mappedCount(M)} of 18 hole routes${focus?`, hole ${focus} focused`:''}${current?`, current hole ${current} highlighted`:''}. North is up."><rect class="cm-bg" x="-100000" y="-100000" width="200000" height="200000"/>${M.geometry.outline?`<path class="cm-outline" d="${poly(M.geometry.outline)}"/>`:''}${layer('fairway',G.fairway)}${layer('water',G.water)}${layer('tee',G.tee)}${layer('green',G.green)}${layer('bunker',G.bunker)}${routes}</svg>`;
}
const cohortNote=M=>M.scoring?`${M.scoring.cohort} · ${M.scoring.year} edition · ${M.scoring.basis}.${M.scoring.cohort==='Contender sample'?' Not the full field.':''}`:'';
export function holePanel(M,hole,{wind=null,nav=true}={}){
 const h=M.holes.find(x=>x.hole===hole);if(!h)return '';const yr=M.setup?.year;
 const rw=wind&&h.geometry_status==='verified'?relativeWind(h.bearing_deg,wind.from_deg):null;
 const score=h.scoring?`<dl class="cm-dl"><div><dt>${h.scoring.cohort==='Contender sample'?'Contenders’ average':'Average to par'}</dt><dd>${e(tp(h.scoring.avg_to_par))}</dd></div><div><dt>Observed cards</dt><dd>${e(h.scoring.sample)}</dd></div></dl><p class="cm-note">${e(cohortNote(M))}</p>`:M.setup?`<p class="cm-k2">SCORING</p><p class="cm-note">No scoring sample available for the selected ${e(yr)} setup.</p>`:'';
 const route=h.geometry_status==='verified'?'':h.geometry_status==='withheld'?`<p class="cm-note">Hole ${h.hole} routing withheld pending identity verification.</p>`:tierOf(M)==='C'?'':`<p class="cm-note">Hole ${h.hole} routing is not mapped.</p>`;
 const w=rw?`<div class="cm-wind"><p class="cm-k2">WIND</p><p class="cm-wv"><b>${e(wind.dir||'')} · ${e(wind.mph??'—')} MPH</b></p><p class="cm-wkind">${e(rw.label)}</p><p class="cm-note">PBE-derived from sourced routing + weather observation${wind.precision==='locality'?' (town-level estimate)':''}. Descriptive only.</p></div>`:'';
 const prev=hole>1?hole-1:18,next=hole<18?hole+1:1;
 return `<div class="cm-panel" data-cm-panel><p class="cm-k">HOLE ${h.hole}</p><p class="cm-big">PAR ${e(h.setup?.par??'—')} · ${e(h.setup?.yards??'—')} YDS</p>${M.setup?`<p class="cm-sub">${e(yr)} CHAMPIONSHIP SETUP</p>`:''}${score}${route}${w}${nav?`<div class="cm-nav"><button type="button" data-cm-hole="${prev}" aria-label="Previous hole, ${prev}">◀ ${prev}</button><button type="button" data-cm-hole="${next}" aria-label="Next hole, ${next}">${next} ▶</button></div>`:''}</div>`;
}
export function basisLabel(M){
 if(tierOf(M)==='C')return 'SCORECARD LAYOUT · NO MAPPED ROUTING';
 const n=mappedCount(M);return `${spatialState(M)} · ${n} OF 18 HOLE ROUTES VERIFIED · CURRENT MAPPED ROUTING${M.geometry_as_of?` · OPENSTREETMAP AS OF ${M.geometry_as_of.slice(0,10)}`:''}`;
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
export function courseMapModule(M,{focus=null,overlay=null,current=null,wind=null,mode='page',ar=1.25,px=600}={}){
 const tier=tierOf(M);
 const sel=mode==='page'&&(M.setups||[]).length>1?`<label class="cm-setupsel">Championship setup <select data-cm-setup>${M.setups.map(x=>`<option value="${e(x.edition)}"${x.edition===M.setup?.edition?' selected':''}>${e(x.year)} · ${e(String(x.name||'').replace(/^\d{4}\s+/,''))}</option>`).join('')}</select></label>`:'';
 const setup=M.setup?`<p class="cm-setup">${tier==='C'?'':'Current mapped routing · '}${e(M.setup.year)} championship setup · PAR ${e(M.setup.par??'—')} · ${e(M.setup.yardage?.toLocaleString('en-US')??'—')} YDS${M.setup.front&&M.setup.back?` · FRONT ${e(M.setup.front.toLocaleString('en-US'))} · BACK ${e(M.setup.back.toLocaleString('en-US'))}`:''}</p>`:'';
 const canDiff=mode==='page'&&tier!=='C'&&difficultyScale(M);
 const modes=canDiff?`<div class="cm-modes" role="group" aria-label="Map layer"><button type="button" data-cm-overlay="routing" aria-pressed="${overlay!=='difficulty'}">Routing</button><button type="button" data-cm-overlay="difficulty" aria-pressed="${overlay==='difficulty'}">Scoring difficulty</button></div>`:'';
 const ch=current!=null?M.holes.find(h=>h.hole===current):null;
 const cur=ch&&tier!=='C'?`<p class="cm-current"><span>CURRENT HOLE</span> <b>${e(ch.hole)}</b> · PAR ${e(ch.setup?.par??'—')} · ${e(ch.setup?.yards??'—')} YDS${ch.geometry_status!=='verified'?' · ROUTE NOT MAPPED':''}</p>`:'';
 const legend=overlay==='difficulty'&&canDiff?`<p class="cm-legend"><span class="cm-ramp" aria-hidden="true"></span> Scoring difficulty · easier → harder by average to par · ${e(cohortNote(M))}</p>`:'';
 const keys=tier==='C'?'':`<div class="cm-keys" role="group" aria-label="Select a hole">${M.holes.map(h=>`<button type="button" data-cm-hole="${h.hole}" aria-pressed="${h.hole===focus}" class="${h.geometry_status==='verified'?'':'is-unmapped'}${h.hole===current?' is-current':''}" aria-label="Hole ${h.hole}${h.geometry_status==='verified'?'':h.geometry_status==='withheld'?', routing withheld':', routing not mapped'}${h.hole===current?', current hole':''}">${h.hole}</button>`).join('')}</div>`;
 const body=tier==='C'?yardageBook(M):courseMapSvg(M,{focus,overlay,current,ar,px});
 const noMap=tier==='C'?`<p class="cm-note">No mapped routing for this course yet. Par and yardage come from the ${e(M.setup?.year??'')} championship setup.</p>`:'';
 return `<section class="cm cm-${mode}" data-course-map data-tier="${tier}"><header class="cm-head"><p class="cm-k">${mode==='cast'?'COURSE VIEW':'COURSE MAP'}</p><p class="cm-basis">${e(basisLabel(M))}</p>${setup}<div class="cm-controls">${sel}${modes}</div></header>${cur}<div class="cm-stage" data-cm-stage>${body}</div>${keys}${noMap}${withheldNote(M)}${legend}<div data-cm-panelhost>${focus!=null?holePanel(M,focus,{wind}):''}</div>${attributionLine(M)}</section>`;
}
