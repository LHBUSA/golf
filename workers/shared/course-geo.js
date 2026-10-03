// Course Geo V1: strict identity matcher between a canonical PBE course and OpenStreetMap golf features.
// Pure (no I/O). Never attaches by name alone; resorts / multi-course properties and anything uncertain -> review.
// OSM par is a consistency signal only (recorded as a metadata conflict); championship par/yardage always come from our setups.
import {resolveHoles,routeLengthM} from '../../src/lib/course-map.js';

const STOP=new Set(['golf','club','course','courses','country','cc','gc','links','the','and','&','of','at','resort','national','g','c','golfclub']);
export const norm=s=>String(s||'').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9 ]+/g,' ').split(/\s+/).filter(t=>t&&!STOP.has(t));
export function nameScore(a,b){const A=new Set(norm(a)),B=new Set(norm(b));if(!A.size||!B.size)return 0;let i=0;for(const t of A)if(B.has(t))i++;return i/Math.min(A.size,B.size);}
const stitch=segs=>{const out=[];const pool=segs.map(s=>s.slice());while(pool.length){let r=pool.shift();let grew=true;while(grew&&!(r.length>3&&r[0][0]===r.at(-1)[0]&&r[0][1]===r.at(-1)[1])){grew=false;for(let i=0;i<pool.length;i++){const s=pool[i],e=r.at(-1),b=r[0];const eq=(a,c)=>a[0]===c[0]&&a[1]===c[1];if(eq(e,s[0]))r=r.concat(s.slice(1));else if(eq(e,s.at(-1)))r=r.concat(s.slice(0,-1).reverse());else if(eq(b,s.at(-1)))r=s.slice(0,-1).concat(r);else if(eq(b,s[0]))r=s.slice(1).reverse().concat(r);else continue;pool.splice(i,1);grew=true;break;}}out.push(r);}return out;};
// Overpass element (out geom) -> outer rings [[lon,lat]...]; multipolygon outer members are stitched.
export function outerRings(el){return el.type==='way'?[(el.geometry||[]).map(p=>[p.lon,p.lat])]:el.type==='relation'?stitch((el.members||[]).filter(m=>(m.role==='outer'||m.role==='')&&m.type==='way'&&m.geometry).map(m=>m.geometry.map(p=>[p.lon,p.lat]))):[];}
export function pointInRing(pt,poly){let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const [xi,yi]=poly[i],[xj,yj]=poly[j];if(((yi>pt[1])!==(yj>pt[1]))&&(pt[0]<(xj-xi)*(pt[1]-yi)/(yj-yi)+xi))c=!c;}return c;}
export const inside=(pt,el)=>outerRings(el).some(r=>r.length>3&&pointInRing(pt,r));
const metres=(a,b)=>{const k=Math.cos(a[1]*Math.PI/180);return Math.hypot((a[0]-b[0])*111320*k,(a[1]-b[1])*110540);};
const segDist=(p,a,b)=>{const k=Math.cos(p[1]*Math.PI/180),X=q=>[(q[0]-p[0])*111320*k,(q[1]-p[1])*110540];const A=X(a),B=X(b),dx=B[0]-A[0],dy=B[1]-A[1],l=dx*dx+dy*dy;let t=l?-(A[0]*dx+A[1]*dy)/l:0;t=Math.max(0,Math.min(1,t));return Math.hypot(A[0]+t*dx,A[1]+t*dy);};
// Distance (m) from a point to a course boundary (0 if inside), measured to edges, not vertices.
export const distanceTo=(pt,el)=>{if(inside(pt,el))return 0;let m=Infinity;for(const r of outerRings(el))for(let i=1;i<r.length;i++)m=Math.min(m,segDist(pt,r[i-1],r[i]));return m;};
const mid=h=>{const g=h.geometry||[];const m=g[Math.floor(g.length/2)];return m?[m.lon,m.lat]:null;};

/**
 * @param canon {slug,name,locality,country_code,latitude,longitude}
 * @param elements Overpass elements (golf courses with geometry, golf=hole ways with geometry)
 * @param setupHoles Map(hole -> {par,yards}) from our latest 18-hole setup (consistency evidence only)
 * @param namedId optional OSM id located by exact name when no canonical coordinates exist (always REVIEW)
 */
export function matchCourse(canon,elements,setupHoles=new Map(),{namedId=null,resortRadius=1500}={}){
 const courses=(elements||[]).filter(e=>e.tags?.leisure==='golf_course');
 const ev={canonical_coords:canon.latitude!=null,contains:null,distance_m:null,name_score:null,locality_ok:null,country_ok:null,resort_neighbours:[],holes_in_boundary:0,proven:0,rejected:[],par:{compared:0,agree:0,disagree:[]}};
 let target=null,decision=null;
 if(namedId){target=courses.find(e=>e.type+'/'+e.id===namedId)||null;decision=target?'review_no_canonical_coords':'not_found';}
 else if(canon.latitude!=null){const pt=[+canon.longitude,+canon.latitude];const cont=courses.filter(e=>inside(pt,e));
  if(cont.length===1){target=cont[0];ev.contains=true;ev.distance_m=0;}
  else if(cont.length>1){decision='review_multiple_containing';ev.contains=true;}
  else{ev.contains=false;const near=courses.map(e=>({e,d:distanceTo(pt,e),s:nameScore(canon.name,e.tags?.name)})).sort((a,b)=>a.d-b.d);
   const good=near.filter(x=>x.d<=300&&x.s>=0.5);if(good.length===1){target=good[0].e;ev.distance_m=Math.round(good[0].d);decision='review_point_outside_boundary';}else decision=near.length?'no_match_point_outside_boundary':'no_osm_course';
   ev.nearest=near.slice(0,3).map(x=>({id:x.e.type+'/'+x.e.id,name:x.e.tags?.name||null,dist_m:Math.round(x.d),name_score:+x.s.toFixed(2)}));}}
 else decision='no_canonical_coords';
 if(target){
  ev.osm_course={id:target.type+'/'+target.id,name:target.tags?.name||null};
  ev.name_score=+Math.max(nameScore(canon.name,target.tags?.name),nameScore(canon.name,target.tags?.operator)).toFixed(2);
  const city=target.tags?.['addr:city'],cc=target.tags?.['addr:country'];
  // Locality granularity differs (region vs town), so a mismatch is 'unconfirmed' (null), never a conflict on its own.
  if(city&&canon.locality)ev.locality_ok=nameScore(city,canon.locality)>0||norm(canon.locality).some(t=>norm(city).includes(t))?true:null;
  if(cc&&canon.country_code)ev.country_ok=cc.toUpperCase()===canon.country_code.toUpperCase();
  const tv=outerRings(target).flat().filter((_,i,arr)=>i%Math.max(1,Math.floor(arr.length/60))===0);
  ev.resort_neighbours=courses.filter(e=>e!==target&&e.tags?.name&&tv.some(v=>distanceTo(v,e)<=resortRadius)).map(e=>e.tags.name).slice(0,6);
  const holes=(elements||[]).filter(e=>e.tags?.golf==='hole').filter(h=>{const m=mid(h);return m&&inside(m,target);});
  ev.holes_in_boundary=holes.length;
  const res=resolveHoles(holes.map(h=>({id:'way/'+h.id,ref:h.tags.ref,par:h.tags.par,coords:h.geometry.map(p=>[p.lon,p.lat])})),setupHoles);
  ev.proven=res.accepted.length;ev.proofs=res.accepted.reduce((o,h)=>(o[h.proof]=(o[h.proof]||0)+1,o),{});ev.rejected=res.rejected.filter(r=>r.ref!=null).slice(0,20);
  for(const h of res.accepted){const s=setupHoles.get(h.hole);if(s&&h.par!=null&&Number.isInteger(Number(h.par))){ev.par.compared++;if(Number(h.par)===s.par)ev.par.agree++;else ev.par.disagree.push(h.hole);}}
  // Hole numbering vs the championship setup. A member routing can number holes differently from the tournament
  // routing (Hoylake). Evidence of renumbering = 2+ holes where BOTH par and length (>25%) disagree; then every
  // length-mismatched hole is withheld (its number is unproven). Without that evidence, a length difference alone
  // (e.g. a route drawn from a forward tee) is recorded as metadata and the hole is kept.
  const chk=res.accepted.map(h=>{const s=setupHoles.get(h.hole),y=routeLengthM(h.coords)/0.9144;return {h,y,len:Number.isInteger(s?.yards)&&Math.abs(y-s.yards)/s.yards>0.25,par:Number.isInteger(s?.par)&&h.par!=null&&Number.isInteger(Number(h.par))&&Number(h.par)!==s.par,s};});
  const renumbered=chk.filter(c=>c.len&&c.par).length>=2,bad=[];
  ev.length_conflicts=chk.filter(c=>c.len&&!renumbered).map(c=>({hole:c.h.hole,mapped_yards:Math.round(c.y),setup_yards:c.s.yards}));
  res.accepted=chk.filter(c=>{if(c.len&&renumbered){bad.push({ref:c.h.hole,candidates:1,reason:'routing_numbering_differs_from_setup',mapped_yards:Math.round(c.y),setup_yards:c.s.yards});return false;}return true;}).map(c=>c.h);
  ev.length_mismatch=bad;ev.rejected=[...ev.rejected,...bad];ev.proven=res.accepted.length;
  ev.accepted=res.accepted;
  // Shared-name resort: another course in the extract matches our canonical name at least as well as the target
  // (Carnoustie Championship / Burnside / Buddon). The point alone cannot pick the right one: hold for review.
  const tScore=nameScore(canon.name,target.tags?.name);
  ev.shared_name_neighbours=courses.filter(e=>e!==target&&e.tags?.name&&nameScore(canon.name,e.tags.name)>=0.5&&nameScore(canon.name,e.tags.name)>=tScore).map(e=>e.type+'/'+e.id+' '+e.tags.name);
  if(!decision){
   // Routing answers WHERE a hole is; tournament setups answer HOW it plays. An OSM par tag that differs from our setup is
   // recorded as geometry_metadata_conflict and never blocks or demotes geometry (owner rule 2026-10-02).
   const nameOk=ev.name_score>=0.5,holesOk=ev.proven===18;
   if(ev.country_ok===false)decision='review_country_conflict';
   else if(ev.length_mismatch.length>3)decision='review_routing_differs_from_setup';
   // A shared-name neighbour (same club / next door) needs strong hole evidence: 15+ proven holes that agree with the
   // setup lengths. Otherwise the point alone cannot prove which course it is.
   else if(ev.shared_name_neighbours.length&&(ev.proven<15||ev.length_mismatch.length>2))decision='review_resort_shared_name';
   else if(!nameOk&&!holesOk)decision='review_weak_identity';
   else decision='exact';
  }
 }
 const state=decision!=='exact'?'REVIEW_OR_NONE':ev.proven===18?'VERIFIED ROUTING':ev.proven>0?'PARTIAL ROUTING':'NO ROUTING';
 return {decision,state,target,evidence:ev};
}

/** Two canonical courses resolving to the same OSM course = duplicate identity on our side: hold every one for review. */
export function holdSharedTargets(rows){const by=new Map();for(const r of rows){const id=r.osm_course?.id;if(id&&r.decision&&!/^no_/.test(r.decision))by.set(id,[...(by.get(id)||[]),r]);}
 for(const [id,rs] of by)if(rs.length>1)for(const r of rs){r.decision='review_duplicate_canonical_course';r.state='REVIEW_OR_NONE';r.shared_with=rs.filter(x=>x!==r).map(x=>x.slug);}return rows;}

/**
 * Identity decision with a reviewed evidence record (workers/shared/course-identity.js). Without canonical
 * coordinates a course is held (name alone never attaches). A reviewed record may clear ONLY its named OSM element,
 * only from a decision listed in `clears`; a record naming a different element, or no record, leaves the hold.
 */
export function matchWithEvidence(canon,elements,setupHoles=new Map(),evidence=null){
 const noCoords=canon.latitude==null||canon.longitude==null;
 if(noCoords&&!evidence?.osm_course)return matchCourse({...canon,latitude:null,longitude:null},elements,setupHoles);
 let m=noCoords?matchCourse({...canon,latitude:null,longitude:null},elements,setupHoles,{namedId:evidence.osm_course}):matchCourse(canon,elements,setupHoles);
 const id=m.target?m.target.type+'/'+m.target.id:null;
 if(evidence&&id&&id===evidence.osm_course&&evidence.clears.includes(m.decision)){
  m={...m,decision:'exact',cleared_by:evidence.evidence_id};m.state=m.evidence.proven===18?'VERIFIED ROUTING':m.evidence.proven>0?'PARTIAL ROUTING':'NO ROUTING';}
 return m;
}

/**
 * Automatic identity proof for a name-located candidate (no canonical coordinates, no reviewed record). All must hold:
 * the candidate was cleared to 'exact' through matchWithEvidence; >= 15 holes proven inside its boundary; >= 15 proven
 * holes within 25% of the championship setup yardage (needs a published hole table); name score >= 0.5; no
 * shared-name neighbour. Anything less is held for manual review.
 */
export function autoIdentityOk(m,setupHoles,canonName){
 const ev=m?.evidence||{};const proven=ev.proven||0;
 const lenAgree=(ev.accepted||[]).filter(h=>{const s=setupHoles.get(h.hole);if(!Number.isInteger(s?.yards))return false;const y=routeLengthM(h.coords)/0.9144;return Math.abs(y-s.yards)/s.yards<=0.25;}).length;
 const nameOk=nameScore(canonName,m?.target?.tags?.name)>=0.5||nameScore(canonName,m?.target?.tags?.['name:en'])>=0.5||nameScore(canonName,m?.target?.tags?.int_name)>=0.5;
 const checks={exact:m?.decision==='exact',proven,length_agree:lenAgree,setup_table:setupHoles.size>=18,name:nameOk,shared_name:(ev.shared_name_neighbours||[]).length};
 return {pass:checks.exact&&proven>=15&&lenAgree>=15&&nameOk&&!checks.shared_name,checks,rule:'auto-identity-v1: exact + >=15 proven + >=15 setup-length agreements + name + no shared-name neighbour'};
}
