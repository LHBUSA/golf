// Live scoring tape: observed golfer scoring changes across the WHOLE live field, derived only from provable deltas
// between two consecutive live snapshots of the same round. Nothing is narrated or invented:
//   - a hole result is named only when that hole's posted card (strokes + par) is in the newer snapshot and was
//     not in the older one; the running total is shown only when it reconciles with both snapshots' totals;
//   - leader / top-N / movement events use ESPN positions observed in the newer snapshot (players whose status
//     was not re-observed in a fast tick carry no movement events until they are re-observed);
//   - status events (CUT / WD / DQ) only when the competitor status itself changed.
// Shot-level play (ball positions, clubs, lies, shot paths) is not in the approved source and never appears here.
export const TAPE_VERSION='golf-tape/1.0.0';
export const TAPE_MAX=3000;
const key=p=>p?.slug||p?.name||'';
const tp=v=>v===null||v===undefined?'—':v===0?'E':v>0?'+'+v:'−'+Math.abs(v);
const diffOf=h=>Number.isInteger(h?.strokes)&&Number.isInteger(h?.par)?h.strokes-h.par:null;
export const resultKind=d=>d===null?null:d<=-2?'eagle':d===-1?'birdie':d===0?'par':d===1?'bogey':'double';
export const resultName=d=>d===null?null:d<=-3?'ALBATROSS':d===-2?'EAGLE':d===-1?'BIRDIE':d===0?'PAR':d===1?'BOGEY':d===2?'DOUBLE BOGEY':d===3?'TRIPLE BOGEY':`+${d}`;
const posTxt=p=>p?.position_display||(Number.isInteger(p?.position_num)?String(p.position_num):null);
const STATUS_TXT={cut:'MISSED CUT',withdrawn:'WITHDRAWN',disqualified:'DISQUALIFIED',dns:'DID NOT START'};
const who=p=>({slug:p.slug||null,name:p.name||null});
const lastName=n=>String(n||'').trim().split(/\s+/).slice(-1)[0]||'';
function ev(snap,prev,p,type,fields){
 const pos=posTxt(p);
 const base={t:snap.fetched_at,prev_t:prev.fetched_at,round:snap.event_status?.period??null,type,keys:[key(p)],who:[who(p)],pos,to_par:p.total_to_par??null,thru:p.thru??null,...fields};
 base.text=`${lastName(p.name).toUpperCase()} · ${base.rest}`;
 return base;
}
const active=s=>(s?.players||[]).filter(p=>p.status==='active');
// Leaders = ESPN's observed position 1 (never a minimum over partial totals). The fast lane always re-reads the top ten.
function leadersOf(s){const L=active(s).filter(p=>p.position_num===1);return {top:L.find(p=>Number.isInteger(p.total_to_par))?.total_to_par??null,keys:L.map(key).sort()};}
/**
 * Events observed between prev and snap (both full live snapshots). Returns [] across a round boundary or when
 * either snapshot is missing: the first snapshot of a round has nothing to compare against.
 */
export function deriveTape(prev,snap){
 if(!prev||!snap||!prev.fetched_at||!snap.fetched_at||prev.fetched_at===snap.fetched_at)return [];
 const round=snap.event_status?.period??null;if(round===null||prev.event_status?.period!==round)return [];
 const before=new Map((prev.players||[]).map(p=>[p.espn_id||key(p),p])),out=[];
 const observedNow=p=>!p.observed_at||p.observed_at===snap.fetched_at;
 for(const p of snap.players||[]){
  const q=before.get(p.espn_id||key(p));if(!q)continue;
  if(q.status==='active'&&p.status!=='active'&&STATUS_TXT[p.status]){out.push(ev(snap,prev,p,'status',{rest:STATUS_TXT[p.status],status:p.status}));continue;}
  if(p.status!=='active'||p.current_round!==round||q.current_round!==round)continue;
  // Hole results: holes posted in the newer card that the older card did not have (same round).
  const had=new Map((q.holes||[]).map(h=>[h.hole,h])),fresh=(p.holes||[]).filter(h=>!had.has(h.hole)&&diffOf(h)!==null);
  if(fresh.length){
   const sum=fresh.reduce((s,h)=>s+diffOf(h),0);
   const reconciles=Number.isInteger(q.total_to_par)&&Number.isInteger(p.total_to_par)&&q.total_to_par+sum===p.total_to_par;
   let run=reconciles?q.total_to_par:null;
   for(const h of fresh){const d=diffOf(h);if(run!==null)run+=d;const name=resultName(d),last=h===fresh.at(-1);
    out.push(ev(snap,prev,p,'hole',{hole:h.hole,par:h.par,strokes:h.strokes,result:name,kind:resultKind(d),to_par:run,pos:last?posTxt(p):null,
     rest:`${name} ${h.hole}${run!==null?` · ${tp(run)}`:''}${last&&posTxt(p)?` · ${/^T/.test(posTxt(p))?posTxt(p):'P'+posTxt(p)}`:''}`}));}
  }
  if(Number.isInteger(q.thru)&&q.thru<18&&p.thru===18){const r=(p.rounds||[]).find(x=>x.round===round);out.push(ev(snap,prev,p,'finish',{rest:`FINISHES ROUND ${round}${r?.strokes?` · ${r.strokes}`:''}${r?.to_par!=null?` (${tp(r.to_par)})`:''} · ${tp(p.total_to_par)}`}));}
  // Positions: only for golfers whose status was observed in this snapshot.
  if(observedNow(p)&&Number.isInteger(p.position_num)&&Number.isInteger(q.position_num)&&p.position_num!==1){
   const into=[5,10].find(n=>p.position_num<=n&&q.position_num>n);
   if(into)out.push(ev(snap,prev,p,'position',{rest:`INTO TOP ${into} · ${posTxt(p)}`,from:posTxt(q)}));
   else if(!fresh.length&&Math.abs(q.position_num-p.position_num)>=5&&p.position_num<=25)out.push(ev(snap,prev,p,'move',{rest:`${p.position_num<q.position_num?'UP':'DOWN'} TO ${posTxt(p)} (from ${posTxt(q)})`,from:posTxt(q)}));
  }
 }
 // Leadership changes across the field (totals observed in both snapshots).
 const La=leadersOf(prev),Lb=leadersOf(snap),byKey=new Map((snap.players||[]).map(p=>[key(p),p]));
 if(Lb.keys.length&&La.keys.join('|')!==Lb.keys.join('|')){
  const L=Lb.keys.map(k=>byKey.get(k)).filter(Boolean);
  const base={t:snap.fetched_at,prev_t:prev.fetched_at,round,type:'lead',keys:Lb.keys,who:L.map(who),to_par:Lb.top};
  if(Lb.top===null){/* leader observed without a total: no lead line */}
  else if(L.length===1)out.push({...base,rest:`TAKES THE LEAD · ${tp(Lb.top)}`,text:`${lastName(L[0].name).toUpperCase()} · TAKES THE LEAD · ${tp(Lb.top)}`});
  else out.push({...base,rest:`TIE FOR THE LEAD · ${tp(Lb.top)}`,text:`TIE FOR THE LEAD · ${tp(Lb.top)} · ${L.map(p=>lastName(p.name).toUpperCase()).join(', ')}`});
  for(const k of La.keys)if(!Lb.keys.includes(k)){const p=byKey.get(k);if(p&&p.status==='active')out.push(ev(snap,prev,p,'lost_lead',{rest:`LOSES THE LEAD · ${tp(p.total_to_par)}`}));}
 }
 return out;
}
/** Append events to a bounded tape document (newest last). Duplicate (t,type,key,hole) events are ignored. */
export function appendTape(doc,events,{edition,now}){
 const t=doc&&Array.isArray(doc.events)?doc:{version:TAPE_VERSION,edition,events:[]};
 const seen=new Set(t.events.map(x=>`${x.t}|${x.type}|${x.keys?.join(',')}|${x.hole??''}`));
 for(const x of events){const k=`${x.t}|${x.type}|${x.keys?.join(',')}|${x.hole??''}`;if(!seen.has(k)){seen.add(k);t.events.push(x);}}
 t.events=t.events.slice(-TAPE_MAX);t.version=TAPE_VERSION;t.edition=edition;t.updated_at=now;
 return t;
}
