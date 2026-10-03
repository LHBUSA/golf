// Hole Intelligence (Course View V2). Pure, deterministic derivations shared by golf-api and the browser.
// Inputs are only: verified routing + mapped features (OSM, current), championship setup (tournament source),
// observed hole scores, and a weather observation. Nothing here knows or outputs a ball, shot or player position.
// Coordinates are the prepared web projection: metres, x east, y SOUTH (screen-style, north up).
export const HOLE_INTEL_VERSION='hole-intel/1.0.0';
const YD=0.9144;
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1]],len=v=>Math.hypot(v[0],v[1]),dist=(a,b)=>len(sub(a,b));
const cross=(a,b)=>a[0]*b[1]-a[1]*b[0],dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
export function polyLength(pts){let s=0;for(let i=1;i<(pts||[]).length;i++)s+=dist(pts[i-1],pts[i]);return s;}
export function centroid(ring){let a=0,x=0,y=0;for(let i=0;i<ring.length-1;i++){const f=cross(ring[i],ring[i+1]);a+=f;x+=(ring[i][0]+ring[i+1][0])*f;y+=(ring[i][1]+ring[i+1][1])*f;}
 if(Math.abs(a)<1e-9){const n=ring.length;return [ring.reduce((s,p)=>s+p[0],0)/n,ring.reduce((s,p)=>s+p[1],0)/n];}return [x/(3*a),y/(3*a)];}
// Closest point on a polyline: distance, segment index, side (+1 right / -1 left of travel, y-down coords), along-distance.
export function nearestOnRoute(p,route){let best={d:Infinity,i:0,side:0,along:0};let acc=0;
 for(let i=1;i<route.length;i++){const a=route[i-1],b=route[i],ab=sub(b,a),L=len(ab)||1e-9;let t=dot(sub(p,a),ab)/(L*L);t=Math.max(0,Math.min(1,t));const q=[a[0]+ab[0]*t,a[1]+ab[1]*t],d=dist(p,q);
  if(d<best.d)best={d,i:i-1,side:Math.sign(cross(ab,sub(p,a)))||0,along:acc+L*t};acc+=L;}return best;}
const segX=(p1,p2,p3,p4)=>{const o=(a,b,c)=>Math.sign(cross(sub(b,a),sub(c,a)));return o(p1,p2,p3)*o(p1,p2,p4)<0&&o(p3,p4,p1)*o(p3,p4,p2)<0;};
const crossesRing=(route,ring)=>{for(let i=1;i<route.length;i++)for(let j=1;j<ring.length;j++)if(segX(route[i-1],route[i],ring[j-1],ring[j]))return true;return false;};
const inRing=(p,r)=>{let c=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const [xi,yi]=r[i],[xj,yj]=r[j];if(((yi>p[1])!==(yj>p[1]))&&(p[0]<(xj-xi)*(p[1]-yi)/(yj-yi)+xi))c=!c;}return c;};

/**
 * Shape v1: the route vertex farthest from the tee→green chord is the bend. Turn angle between tee→bend and bend→green.
 * dogleg_left/right when |turn| >= 20° AND the bend sits >= 20 m off the chord; mostly_straight when |turn| < 12°;
 * anything in between is not published (null). Par 3s and two-point routes are never classified.
 */
export function holeShape(route,par=null){
 if(!route||route.length<3||par===3)return null;
 const t=route[0],g=route.at(-1),ch=sub(g,t),L=len(ch);if(L<50)return null;
 let k=1,off=-1;for(let i=1;i<route.length-1;i++){const d=Math.abs(cross(ch,sub(route[i],t)))/L;if(d>off){off=d;k=i;}}const a=sub(route[k],t),b=sub(g,route[k]);
 const turn=Math.atan2(cross(a,b),dot(a,b))*180/Math.PI; // y-down: positive = clockwise = right
 const along=polyLength(route.slice(0,k+1));
 const shape=Math.abs(turn)>=20&&off>=20?(turn>0?'dogleg_right':'dogleg_left'):Math.abs(turn)<12?'mostly_straight':null;
 if(!shape)return null;
 return {shape,bend_angle_deg:Math.round(Math.abs(turn)),bend_offset_m:Math.round(off),bend_distance_yards:shape==='mostly_straight'?null:Math.round(along/YD),algorithm:HOLE_INTEL_VERSION+' shape: max chord offset vertex; dogleg >=20deg & >=20m; straight <12deg'};
}
/** Each green may belong to one hole: the nearest route end within 35 m, and it must be at least 15 m closer to that end
 * than to any other hole's route end. Returns Map(hole -> {centre, ring}). */
export function associateGreens(holes,greens){
 const ends=holes.filter(h=>h.route).map(h=>({hole:h.hole,end:h.route.at(-1)})),out=new Map();
 for(const ring of greens||[]){const c=centroid(ring);
  const ds=ends.map(e=>({hole:e.hole,end:e.end,d:inRing(e.end,ring)?0:dist(c,e.end)})).sort((a,b)=>a.d-b.d||a.hole-b.hole);
  if(!ds.length||ds[0].d>35||(ds[1]&&ds[1].d-ds[0].d<15))continue;
  const prev=out.get(ds[0].hole);if(prev&&prev.d<=ds[0].d)continue;
  out.set(ds[0].hole,{centre:c.map(v=>Math.round(v*10)/10),d:ds[0].d});}
 return out;
}
/**
 * Hazards v1. A bunker belongs to a hole when its centroid is within 45 m of that hole's route AND at least 15 m nearer
 * than to any other route (else ambiguous → omitted). Green-side = within 40 m of the associated green centre.
 * Side from the route's travel direction at the nearest point. Water: any polygon whose boundary comes within 45 m of the
 * route; 'crossing' when the route intersects it, else the side of the nearest approach. Water may belong to several holes.
 */
export function hazardsFor(holes,features,greens=new Map()){
 const routed=holes.filter(h=>h.route&&h.route.length>=2),out=new Map(routed.map(h=>[h.hole,{fairway_bunkers:{left:0,right:0},greenside_bunkers:0,water:[]}]));
 for(const ring of features?.bunker||[]){const c=centroid(ring),ds=routed.map(h=>({h,n:nearestOnRoute(c,h.route)})).sort((a,b)=>a.n.d-b.n.d);
  if(!ds.length||ds[0].n.d>45||(ds[1]&&ds[1].n.d-ds[0].n.d<15))continue;const h=ds[0].h,o=out.get(h.hole),g=greens.get(h.hole);
  if(g&&dist(c,g.centre)<=40)o.greenside_bunkers++;else if(ds[0].n.side>0)o.fairway_bunkers.right++;else if(ds[0].n.side<0)o.fairway_bunkers.left++;}
 for(const ring of features?.water||[]){for(const h of routed){const o=out.get(h.hole);
  if(crossesRing(h.route,ring)){if(!o.water.includes('crossing'))o.water.push('crossing');continue;}
  let best=null;for(const p of ring){const n=nearestOnRoute(p,h.route);if(!best||n.d<best.d)best=n;}
  if(best&&best.d<=45){const s=best.side>0?'right':best.side<0?'left':null;if(s&&!o.water.includes(s))o.water.push(s);}}}
 for(const o of out.values())o.method=HOLE_INTEL_VERSION+' hazards: 45 m corridor, 15 m exclusivity, green-side 40 m';
 return out;
}
/** Reference target for distances: the associated mapped green centre, otherwise the verified route end. */
export function targetFor(h,greens){const g=greens.get(h.hole);return g?{type:'mapped_green_centre',point:g.centre}:h.route?{type:'route_end',point:h.route.at(-1).slice()}:null;}
/** Route markers N yards from the route end, measured back ALONG the verified route (tee→green direction). */
export function routeMarkers(route,marks=[200,150,100,50]){
 if(!route||route.length<2)return [];const total=polyLength(route);const out=[];
 for(const yds of marks){const m=yds*YD;if(total<m+20)continue;let need=total-m,acc=0;
  for(let i=1;i<route.length;i++){const L=dist(route[i-1],route[i]);if(acc+L>=need){const t=(need-acc)/(L||1);out.push({yards:yds,point:[Math.round((route[i-1][0]+(route[i][0]-route[i-1][0])*t)*10)/10,Math.round((route[i-1][1]+(route[i][1]-route[i-1][1])*t)*10)/10]});break;}acc+=L;}}
 return out;
}
/** Straight-line map measurement in yards between a user-selected map point and a target (projected metres). */
export const measureYards=(p,q)=>Math.round(dist(p,q)/YD);
/** Wind components relative to the observed tee→green bearing. along>0 = tailwind component, <0 = headwind component;
 * cross>0 = blowing left→right across the hole, <0 = right→left. mph in, mph out (rounded). */
export function windComponents(bearingDeg,windFromDeg,mph){
 if(!Number.isFinite(bearingDeg)||!Number.isFinite(windFromDeg)||!Number.isFinite(mph))return null;
 const to=(windFromDeg+180)%360,a=(to-bearingDeg)*Math.PI/180;return {along:Math.round(mph*Math.cos(a)*100)/100,cross:Math.round(mph*Math.sin(a)*100)/100};
}
/**
 * Scoring stats per hole from observed hole cards [{hole, diff (strokes-par), strokes|null}].
 * distribution buckets always sum to sample (asserted). Difficulty rank among holes with sample >= minSample, by
 * average to par (hardest = 1), standard competition ranking for ties at 3 decimals (e.g. 1, 2, T3, T3, 5).
 */
export function holeStats(cards,{minSample=10}={}){
 const by=new Map();for(const c of cards||[]){if(!Number.isInteger(c?.hole)||!Number.isFinite(c?.diff))continue;const a=by.get(c.hole)||{n:0,sum:0,st:0,stn:0,d:{eagle_or_better:0,birdie:0,par:0,bogey:0,double_or_worse:0}};
  a.n++;a.sum+=c.diff;if(Number.isFinite(c.strokes)){a.st+=c.strokes;a.stn++;}a.d[c.diff<=-2?'eagle_or_better':c.diff===-1?'birdie':c.diff===0?'par':c.diff===1?'bogey':'double_or_worse']++;by.set(c.hole,a);}
 const rows=[...by].map(([hole,a])=>{const tot=Object.values(a.d).reduce((s,v)=>s+v,0);if(tot!==a.n)throw new Error('distribution != sample');
  return {hole,sample:a.n,avg_to_par:Math.round(a.sum/a.n*100)/100,scoring_average:a.stn===a.n?Math.round(a.st/a.n*100)/100:null,distribution:Object.fromEntries(Object.entries(a.d).map(([k,v])=>[k,{count:v,pct:Math.round(v/a.n*1000)/10}]))};});
 const ranked=rows.filter(r=>r.sample>=minSample).sort((a,b)=>b.avg_to_par-a.avg_to_par||a.hole-b.hole);
 const key=r=>(r.avg_to_par).toFixed(3);let rank=0;ranked.forEach((r,i)=>{if(i===0||key(r)!==key(ranked[i-1]))rank=i+1;r.difficulty_rank=rank;});
 for(const r of ranked)r.difficulty_tied=ranked.filter(x=>x.difficulty_rank===r.difficulty_rank).length>1;
 for(const r of rows){r.difficulty_of=ranked.length;if(r.difficulty_rank==null){r.difficulty_rank=null;r.difficulty_tied=false;}}
 return new Map(rows.map(r=>[r.hole,r]));
}
/** Cards from live hole scores ({holes:[{hole,strokes,par}]}) or edition leaderboards ({holes:[{scores:[{hole,strokes,to_par}]}]}). */
export const cardsFromLive=rows=>(rows||[]).flatMap(r=>(r.holes||[]).filter(h=>Number.isInteger(h.strokes)&&Number.isInteger(h.par)).map(h=>({hole:h.hole,diff:h.strokes-h.par,strokes:h.strokes})));
export const cardsFromEdition=ed=>(ed?.leaderboard||[]).flatMap(r=>(r.holes||[]).flatMap(rd=>(rd.scores||[]).filter(s=>Number.isFinite(s.to_par)).map(s=>({hole:s.hole,diff:s.to_par,strokes:Number.isFinite(s.strokes)?s.strokes:null}))));
