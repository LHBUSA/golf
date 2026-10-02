// Course Maps V1 (PROTOTYPE, not wired to any page): OSM-derived current routing rendered as an original PBE SVG.
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
 // Identity still under review, or OSM par disagrees with our setup on any hole: never VERIFIED.
 return {...base,tier:mapped===18&&!review&&!parConflicts.length?'A':'B',review:review||null,par_conflicts:parConflicts,
  geometry:{basis:'openstreetmap-current',as_of:osm.as_of||null,source_course_id:osm.course?.id||null,bounds:[r1(minX),r1(minY),r1(maxX),r1(maxY)],units:'metres (local equirectangular, north up)',outline:outer.length?projRing(outer):null,
   features:{fairway:feat(f=>f.golf==='fairway'),green:feat(f=>f.golf==='green'),tee:feat(f=>f.golf==='tee'),bunker:feat(f=>f.golf==='bunker'),water:feat(f=>/water_hazard/.test(f.golf||'')||f.natural==='water')}},
  holes:out,coverage:{holes_mapped:mapped,holes_total:18,rejected},attribution:ATTRIBUTION};
}
// Ring validity after simplification (topology-safe): any two non-adjacent edges crossing = invalid.
export function selfIntersects(r){const n=r.length-1;const x=(a,b,c,d)=>{const o=(p,q,s)=>Math.sign((q[0]-p[0])*(s[1]-p[1])-(q[1]-p[1])*(s[0]-p[0]));return o(a,b,c)*o(a,b,d)<0&&o(c,d,a)*o(c,d,b)<0;};
 for(let i=0;i<n;i++)for(let j=i+2;j<n;j++){if(i===0&&j===n-1)continue;if(x(r[i],r[i+1],r[j],r[j+1]))return true;}return false;}
/** Switch the championship setup (par/yardage/scoring). Geometry is shared by reference and never changes. */
export function withSetup(m,setup,scoring=null){const sh=new Map((setup?.holes||[]).map(h=>[h.hole,h]));
 return {...m,setup:setup?{edition:setup.edition,year:setup.year,label:setup.label,par:setup.par,yardage:setup.yardage,front:sum(setup.holes,1,9),back:sum(setup.holes,10,18)}:null,scoring,holes:m.holes.map(h=>({...h,par:sh.get(h.hole)?.par??null,yards:sh.get(h.hole)?.yards??null}))};}
function sum(hs,a,b){const xs=(hs||[]).filter(h=>h.hole>=a&&h.hole<=b);return xs.length===b-a+1&&xs.every(h=>Number.isInteger(h.yards))?xs.reduce((s,h)=>s+h.yards,0):null;}

// ---- Descriptive wind relative to the observed hole direction. Null whenever the bearing was not observed.
export function relativeWind(bearingDeg,windFromDeg){
 if(!Number.isFinite(bearingDeg)||!Number.isFinite(windFromDeg))return null;
 const to=(windFromDeg+180)%360;let a=((to-bearingDeg+540)%360)-180;
 if(Math.abs(a)<=30)return {kind:'helping',label:'DOWNWIND (HELPING)',angle:Math.round(a)};
 if(Math.abs(a)>=150)return {kind:'into',label:'INTO THE WIND',angle:Math.round(a)};
 return {kind:'cross',label:a>0?'CROSSWIND LEFT → RIGHT':'CROSSWIND RIGHT → LEFT',angle:Math.round(a)};
}

// ---- Rendering.
const path=c=>c.map((p,i)=>`${i?'L':'M'}${p[0]},${p[1]}`).join('');
const poly=c=>path(c)+'Z';
// Cohort wording comes from the sample: up to 20 cards per hole = the edition's contender cards (Wikipedia leaders);
// larger samples are ESPN field cards that are still not guaranteed to be the whole field.
export function cohortLabel(scoring){const n=Math.max(0,...(scoring?.holes||[]).map(h=>h.sample||0));return n<=20?'Contender sample':'Observed field cards';}
export function difficultyScale(scoring){
 const hs=(scoring?.holes||[]).filter(h=>Number.isFinite(h.avg_to_par)&&h.sample>0);if(hs.length<9)return null;
 const v=hs.map(h=>h.avg_to_par),lo=Math.min(...v),hi=Math.max(...v);
 return {lo,hi,of:new Map(hs.map(h=>[h.hole,{t:hi===lo?0.5:(h.avg_to_par-lo)/(hi-lo),avg:h.avg_to_par,n:h.sample}]))};
}
function holeBox(h,pad=60){const xs=h.route.map(p=>p[0]),ys=h.route.map(p=>p[1]);return [Math.min(...xs)-pad,Math.min(...ys)-pad,Math.max(...xs)-Math.min(...xs)+2*pad,Math.max(...ys)-Math.min(...ys)+2*pad];}
export function viewBoxFor(m,focus=null){
 const h=focus!=null?m.holes.find(x=>x.hole===focus&&x.route):null;
 if(h){let [x,y,w,hh]=holeBox(h);const ar=1.25;if(w/hh<ar){const nw=hh*ar;x-=(nw-w)/2;w=nw;}else{const nh=w/ar;y-=(nh-hh)/2;hh=nh;}return [x,y,w,hh].map(r1);}
 const [a,b,c,d]=m.geometry.bounds,p=Math.max(c-a,d-b)*0.04;return [a-p,b-p,c-a+2*p,d-b+2*p].map(r1);
}
/** Full-course or hole-focused SVG. `current` = the selected golfer's current hole (whole route highlighted, no position). */
export function courseMapSvg(m,{focus=null,overlay=null,current=null,title=''}={}){
 if(!m||m.tier==='C'||!m.geometry)return '';
 const vb=viewBoxFor(m,focus),u=vb[2]/600,G=m.geometry.features,sc=overlay==='difficulty'?difficultyScale(m.scoring):null;
 const layer=(cls,arr,fn=poly)=>arr.length?`<g class="cm-${cls}">${arr.map(c=>`<path d="${fn(c)}"/>`).join('')}</g>`:'';
 const routes=m.holes.filter(h=>h.route).map(h=>{const d=sc?.of.get(h.hole),cls=['cm-route',h.hole===focus?'is-focus':'',h.hole===current?'is-current':''].filter(Boolean).join(' ');
  const st=h.route[0];return `<g class="${cls}" data-hole="${h.hole}"><path class="cm-line${d?' cm-d'+Math.min(4,Math.floor(d.t*5)):''}" d="${path(h.route)}"/><path class="cm-hit" d="${path(h.route)}"/><g class="cm-num" transform="translate(${st[0]} ${st[1]}) scale(${r1(u*100)/100})"><circle r="11"/><text text-anchor="middle" dy="4">${h.hole}</text></g></g>`;}).join('');
 const nx=vb[0]+vb[2]-40*u,ny=vb[1]+46*u;
 const north=`<g class="cm-north" transform="translate(${r1(nx)} ${r1(ny)}) scale(${r1(u*100)/100})"><path d="M0,-22 L7,6 L0,1 L-7,6Z"/><text y="22" text-anchor="middle">N</text></g>`;
 const bar=(()=>{const m100=vb[2]>2400?500:vb[2]>900?200:100,x=vb[0]+18*u,y=vb[1]+vb[3]-34*u;return `<g class="cm-scale"><path d="M${r1(x)},${r1(y)}h${m100}"/><text x="${r1(x)}" y="${r1(y-6*u)}" font-size="${r1(11*u)}">${m100} m</text></g>`;})();
 const attr=`<text class="cm-attr" x="${r1(vb[0]+vb[2]-8*u)}" y="${r1(vb[1]+vb[3]-8*u)}" text-anchor="end" font-size="${r1(10*u)}">${e(ATTRIBUTION.text)}</text>`;
 return `<svg class="cm-svg" viewBox="${vb.join(' ')}" role="img" aria-label="${e(title||`${m.course.name}: current mapped routing, ${m.coverage.holes_mapped} of 18 holes`)}${focus?`, hole ${focus} focused`:''}"><rect class="cm-bg" x="${vb[0]}" y="${vb[1]}" width="${vb[2]}" height="${vb[3]}"/>${m.geometry.outline?`<path class="cm-outline" d="${poly(m.geometry.outline)}"/>`:''}${layer('fairway',G.fairway)}${layer('water',G.water)}${layer('tee',G.tee)}${layer('green',G.green)}${layer('bunker',G.bunker)}${routes}${north}${bar}${attr}</svg>`;
}
const tp=v=>v==null?'—':v===0?'E':v>0?'+'+v:'−'+Math.abs(v);
export function holePanel(m,hole,{wind=null}={}){
 const h=m.holes.find(x=>x.hole===hole);if(!h)return '';const s=m.scoring?.holes?.find(x=>x.hole===hole);
 const rw=wind&&h.routing_observed?relativeWind(h.bearing_deg,wind.from_deg):null;
 return `<div class="cm-panel"><p class="cm-k">HOLE ${h.hole}</p><p class="cm-big">PAR ${e(h.par??'—')} · ${e(h.yards??'—')} YDS</p>${m.setup?`<p class="cm-sub">${e(m.setup.year)} SETUP · ${e(m.setup.label)}</p>`:''}${s&&s.sample?`<dl class="cm-dl"><div><dt>${cohortLabel(m.scoring)==='Contender sample'?'Contenders’ average':'Average to par'}</dt><dd>${e(tp(s.avg_to_par))}</dd></div><div><dt>Observed cards</dt><dd>${e(s.sample)}</dd></div></dl><p class="cm-note">${e(cohortLabel(m.scoring))} · ${e(m.scoring.year)} edition · ${e(m.scoring.basis)}.${cohortLabel(m.scoring)==='Contender sample'?' Not the full field.':''}</p>`:''}${rw?`<p class="cm-wind"><b>${e(rw.label)}</b> · Wind ${e(wind.dir||'')} ${e(wind.mph??'—')} mph${wind.precision==='locality'?' (town-level estimate)':''}</p><p class="cm-note">PBE-derived from sourced routing + weather observation. Descriptive only: no scoring, club or shot effect is implied.</p>`:''}${h.routing_observed?'':`<p class="cm-note">This hole’s routing is not mapped.</p>`}<div class="cm-nav"><button type="button" data-cm-hole="${hole>1?hole-1:18}" aria-label="Previous hole">◀ ${hole>1?hole-1:18}</button><button type="button" data-cm-hole="${hole<18?hole+1:1}" aria-label="Next hole">${hole<18?hole+1:1} ▶</button></div></div>`;
}
export const spatialState=m=>m.tier==='A'?'VERIFIED ROUTING':m.tier==='B'?'PARTIAL ROUTING':'RECONSTRUCTED';
export function basisLabel(m){
 if(m.tier==='C')return 'SCORECARD LAYOUT · NO MAPPED ROUTING';
 return `${spatialState(m)}${m.tier==='B'&&m.coverage.holes_mapped<18?` · ${m.coverage.holes_mapped} OF 18 HOLES MAPPED`:''}${m.review?' · IDENTITY PENDING REVIEW':''}${m.par_conflicts?.length?` · OSM PAR DIFFERS ON ${m.par_conflicts.join(', ')}`:''} · CURRENT MAPPED ROUTING${m.geometry.as_of?` · OPENSTREETMAP AS OF ${m.geometry.as_of.slice(0,10)}`:''}`;
}
/** Level C: real par/yardage/order as a yardage-book grid. Never a map, never a shape. */
export function yardageBook(m){
 const hs=m.holes;return `<div class="cm-book" role="list" aria-label="Hole par and yardage">${hs.map(h=>`<div class="cm-card" role="listitem"><b>${h.hole}</b><span>PAR ${e(h.par??'—')}</span><small>${e(h.yards??'—')} YDS</small></div>`).join('')}</div>`;
}
export function courseMapModule(m,{focus=null,overlay=null,current=null,wind=null,setups=[]}={}){
 const sel=setups.length>1?`<div class="cm-setups" role="group" aria-label="Championship setup">${setups.map(x=>`<button type="button" data-cm-setup="${e(x.edition)}" aria-pressed="${x.edition===m.setup?.edition}">${e(x.year)}</button>`).join('')}</div>`:'';
 const setup=m.setup?`<p class="cm-setup">${m.tier==='C'?'':'Current mapped routing · '}${e(m.setup.year)} championship yardage · ${e(m.setup.label)} · PAR ${e(m.setup.par??'—')} · ${e(m.setup.yardage?.toLocaleString('en-US')??'—')} YDS${m.setup.front&&m.setup.back?` · FRONT ${e(m.setup.front.toLocaleString('en-US'))} · BACK ${e(m.setup.back.toLocaleString('en-US'))}`:''}</p>`:'';
 const legend=overlay==='difficulty'&&difficultyScale(m.scoring)?`<p class="cm-legend"><span class="cm-ramp" aria-hidden="true"></span> Scoring difficulty · easier → harder by average to par · ${e(cohortLabel(m.scoring))} · ${e(m.scoring.year)} edition · up to ${e(Math.max(...m.scoring.holes.map(h=>h.sample)))} cards per hole</p>`:'';
 const body=m.tier==='C'?yardageBook(m):courseMapSvg(m,{focus,overlay,current});
 const cur=current&&m.tier!=='C'?`<p class="cm-current">CURRENT HOLE · ${e(current)}</p>`:'';
 return `<section class="cm" data-course-map><header class="cm-head"><p class="cm-k">COURSE MAP</p><p class="cm-basis">${e(basisLabel(m))}</p>${setup}${sel}</header>${cur}<div class="cm-stage">${body}</div>${legend}${focus!=null?holePanel(m,focus,{wind}):''}${m.tier==='C'?'':`<p class="cm-attrib"><a href="${ATTRIBUTION.url}">Course routing © OpenStreetMap contributors</a> · available under the <a href="${ATTRIBUTION.licence_url}">Open Database License</a>. Map geometry shows current mapping, not a historical setup.</p>`}</section>`;
}
