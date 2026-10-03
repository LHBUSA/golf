// PBEcast Live V3: broadcast command center built only from observed scoring snapshots.
// Truth levels: OBSERVED = posted positions/scores/hole results/published par+yardage/snapshot times.
// DERIVED (PBE) = differences between observed snapshots, streaks, within-N counts. RECONSTRUCTED = the
// generic hole template. Nothing here produces ball locations, shot paths, clubs, lies or player locations.
import {e,a,toPar,playerName,portrait} from './ui.js';
import {badge,statusModule} from './live-ui.js';
import {holeSvg} from './cast-replay.js';
import {dnaModel} from './dna-ui.js';

export const key=x=>x?.slug||x?.name||'';
const tp=v=>v===null||v===undefined?'—':toPar(v);
const lastName=n=>{const p=String(n||'').trim().split(/\s+/);return p.length>1&&/^(jr\.?|sr\.?|ii|iii|iv)$/i.test(p.at(-1))?p.at(-2):p.at(-1)||'';};
const clock=iso=>{try{return new Date(iso).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});}catch{return '';}};
export const ago=s=>s===null||s===undefined||!Number.isFinite(s)?'':s<90?'just now':s<3600?`${Math.round(s/60)} min ago`:`${Math.round(s/3600)} hr ago`;
const OUT={cut:'CUT',withdrawn:'WD',disqualified:'DQ',dns:'DNS'};
export const posLabel=r=>r.status!=='active'?OUT[r.status]||'—':r.position?(/^T/.test(r.position)?r.position:'P'+r.position):'—';
const posNum=r=>{const n=parseInt(String(r?.position??'').replace(/^T/,''),10);return Number.isFinite(n)?n:null;};
export const thruText=r=>OUT[r.status]||(r.thru===18?'F':r.thru>0?String(r.thru):r.tee_time?clock(r.tee_time):'—');

// ---- Hole results (observed strokes vs published par).
export function holeDiff(h){return Number.isInteger(h?.strokes)&&Number.isInteger(h?.par)?h.strokes-h.par:null;}
export function resultKind(d){return d===null?'none':d<=-2?'eagle':d===-1?'birdie':d===0?'par':d===1?'bogey':'double';}
export function resultLabel(d){return d===null?'':d<=-3?'Albatross':d===-2?'Eagle':d===-1?'Birdie':d===0?'Par':d===1?'Bogey':d===2?'Double bogey':d===3?'Triple bogey':`+${d}`;}
const SHORT={eagle:'EGL',birdie:'BIR',par:'PAR',bogey:'BOG',double:'DBL+',none:'—'};
const WORD=['zero','one','two','three','four','five','six','seven','eight','nine'];
const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);

// Deterministic run statements from the posted holes (play order). Each is a counted fact, never a narrative.
export function runFacts(holes){
 const hs=(holes||[]).filter(h=>holeDiff(h)!==null);if(hs.length<2)return [];
 const out=[],d=hs.map(holeDiff);
 let streak=0;for(let i=d.length-1;i>=0&&d[i]<0;i--)streak++;
 if(streak>=2)out.push(d.slice(-streak).every(x=>x===-1)?`${cap(WORD[streak]||String(streak))} straight birdies`:`${cap(WORD[streak]||String(streak))} straight holes under par`);
 if(hs.length>=5){const l5=d.slice(-5),u=l5.filter(x=>x<0).length,o=l5.filter(x=>x>0).length;
  if(u>=3&&u!==streak)out.push(`${cap(WORD[u])} ${l5.some(x=>x<-1)?'birdies or better':'birdies'} in the last five holes`);
  else if(o>=2)out.push(`${cap(WORD[o])} holes over par in the last five`);}
 let bogeyFree=0;for(let i=d.length-1;i>=0&&d[i]<=0;i--)bogeyFree++;
 if(bogeyFree>=9&&bogeyFree===d.length)out.push(`Bogey-free through ${bogeyFree}`);
 return out;
}

// ---- Movement between observed snapshots (points come from /live/:slug/movement; each is an observation).
// Position change since the previous observation, only when the latest observation still matches the board.
export function boardMoves(points,rows){
 const pts=(points||[]).filter(p=>p.top?.length);const out=new Map();if(pts.length<2)return out;
 const b=pts.at(-1),a=pts.at(-2);const prev=new Map(a.top.map(x=>[key(x),x]));
 const latest=new Map(b.top.map(x=>[key(x),x]));
 for(const r of rows||[]){const k=key(r),x=latest.get(k),y=prev.get(k);if(!x||!y||!Number.isInteger(x.pos)||!Number.isInteger(y.pos))continue;
  if(posNum(r)!==x.pos)continue;out.set(k,y.pos-x.pos);}
 return out;
}

// Scoring pulse: events provable from consecutive comparable observations. A hole result is named only when
// the holes played between the two observations are posted and their total equals the observed change.
const whoOf=x=>({slug:x.slug||null,name:x.name,label:lastName(x.name).toUpperCase()});
const posTxt=o=>Number.isInteger(o?.pos)?`${o.tied?'T':''}${o.pos}`:null;
export function pulseEvents(points,{holes=new Map(),round=null,focus=new Set(),top=10,limit=60}={}){
 const pts=(points||[]).filter(p=>p.top?.length),ev=[];
 for(let i=1;i<pts.length;i++){
  const a=pts[i-1],b=pts[i],sameRound=a.round===b.round,prev=new Map(a.top.map(x=>[key(x),x]));
  const La=a.top.filter(x=>x.pos===1),Lb=b.top.filter(x=>x.pos===1);
  const ka=La.map(key).sort().join('|'),kb=Lb.map(key).sort().join('|');
  if(sameRound&&Lb.length&&ka!==kb){
   if(Lb.length===1)ev.push({t:b.t,type:'lead',keys:[key(Lb[0])],who:[whoOf(Lb[0])],rest:`→ SOLO LEAD · ${tp(Lb[0].to_par)}`,text:`${lastName(Lb[0].name).toUpperCase()} → SOLO LEAD · ${tp(Lb[0].to_par)}`});
   else ev.push({t:b.t,type:'lead',keys:Lb.map(key),who:Lb.map(whoOf),prefix:`TIE FOR LEAD · ${tp(Lb[0].to_par)} ·`,text:`TIE FOR LEAD · ${tp(Lb[0].to_par)} · ${Lb.map(x=>lastName(x.name)).join(', ').toUpperCase()}`});
  }
  if(!sameRound)continue;
  for(const x of b.top){
   const k=key(x),y=prev.get(k);if(!y)continue;
   const watched=focus.has(k)||(Number.isInteger(x.pos)&&x.pos<=top);if(!watched)continue;
   const who=lastName(x.name).toUpperCase(),W=[whoOf(x)],mv=Number.isInteger(x.pos)&&Number.isInteger(y.pos)&&x.pos!==y.pos?{from:posTxt(y),to:posTxt(x),delta:y.pos-x.pos}:null;
   if(Number.isInteger(x.thru)&&Number.isInteger(y.thru)&&x.thru>y.thru&&x.to_par!=null&&y.to_par!=null){
    const d=x.to_par-y.to_par,hs=b.round===round?holes.get(k):null;
    const seg=hs&&hs.length>=x.thru?hs.slice(y.thru,x.thru):null;
    const proven=seg&&seg.length===x.thru-y.thru&&seg.every(h=>holeDiff(h)!==null)&&seg.reduce((s,h)=>s+holeDiff(h),0)===d;
    if(proven){const notable=seg.filter(h=>holeDiff(h)!==0);
     if(notable.length){const rest=`${notable.map(h=>`${resultLabel(holeDiff(h)).toUpperCase()} ON ${h.hole}`).join(', ')} · ${tp(x.to_par)}`;ev.push({t:b.t,type:'hole',keys:[k],who:W,rest,move:mv,hole:notable.at(-1).hole,strokes:notable.at(-1).strokes,basis:'holes',kind:resultKind(holeDiff(notable.at(-1))),text:`${who} ${rest}`});}}
    else if(d!==0)ev.push({t:b.t,type:'score',keys:[k],who:W,move:mv,rest:`${d<0?'MOVES':'DROPS'} TO ${tp(x.to_par)} · THRU ${x.thru}`,basis:'board',text:`${who} ${d<0?'MOVES':'DROPS'} TO ${tp(x.to_par)} · THRU ${x.thru}`});
    if(y.thru<18&&x.thru===18)ev.push({t:b.t,type:'finish',keys:[k],who:W,rest:`FINISHES ROUND ${b.round} · ${tp(x.to_par)}`,text:`${who} FINISHES ROUND ${b.round} · ${tp(x.to_par)}`});
   }
   if(Number.isInteger(x.pos)&&Number.isInteger(y.pos)&&x.pos!==1){
    const into=[5,10].find(n=>x.pos<=n&&y.pos>n);
    if(into)ev.push({t:b.t,type:'position',keys:[k],who:W,move:mv,rest:`INTO ${x.tied?'T':''}${x.pos} · TOP ${into}`,text:`${who} INTO ${x.tied?'T':''}${x.pos} · TOP ${into}`});
   }
  }
 }
 return ev.reverse().slice(0,limit);
}

// ---- Field snapshot from the current observed board. Every count is labelled as PBE-derived on screen.
export function fieldSnapshot(ev,points){
 const act=(ev.leaderboard||[]).filter(r=>r.status==='active'&&r.total_to_par!=null);if(!act.length)return null;
 const lead=Math.min(...act.map(r=>r.total_to_par)),leaders=act.filter(r=>r.total_to_par===lead);
 const within=n=>act.filter(r=>r.total_to_par!==lead&&r.total_to_par-lead<=n).length;
 const fin=act.filter(r=>r.thru===18).length,on=act.filter(r=>r.thru>0&&r.thru<18).length,yet=act.length-fin-on;
 const done=act.filter(r=>r.thru===18&&Number.isInteger(r.today_strokes));
 const low=done.length?Math.min(...done.map(r=>r.today_strokes)):null,lowBy=done.filter(r=>r.today_strokes===low);
 let mover=null;const pts=(points||[]).filter(p=>p.top?.length&&p.round===ev.round);
 if(pts.length>=2){const f=new Map(pts[0].top.map(x=>[key(x),x]));for(const x of pts.at(-1).top){const y=f.get(key(x));if(!y||!Number.isInteger(x.pos)||!Number.isInteger(y.pos))continue;const g=y.pos-x.pos;if(g>0&&(!mover||g>mover.gain))mover={name:x.name,slug:x.slug,gain:g,from:y.pos,to:x.pos,tied:x.tied,since:pts[0].t};}}
 return {lead,leaders,within1:within(1),within2:within(2),within3:within(3),finished:fin,on_course:on,not_started:yet,low,lowBy,lowToPar:lowBy[0]?.today_to_par??null,mover};
}

// ---- Leaders-over-time timeline. Responsive: rendered at the measured pixel width (viewBox = pixels), so text
// never scales and labels live in a reserved right gutter. Markers = observations; curves only link them.
export function timelineSeries(points,{filter='top5',selected=null}={}){
 const pts=(points||[]).filter(p=>p.top?.length);if(pts.length<2)return null;
 const last=pts.at(-1).top,n=filter==='top20'?20:filter==='top10'?10:filter==='top5'?5:0;
 const leadKeys=last.filter(x=>x.pos===1).map(key);
 // Contenders: leaders, everyone within 3 shots of the lead at the latest observation, the two biggest position gains
 // in the latest round (>= 3 places) and the selected golfer; at most 8, ordered by position.
 let contenders=[];if(filter==='contenders'){const lead=Math.min(...last.map(x=>x.to_par).filter(Number.isFinite));
  const near=last.filter(x=>Number.isFinite(x.to_par)&&x.to_par-lead<=3).sort((a,b)=>a.pos-b.pos).map(key);
  const lr=pts.filter(p=>p.round===pts.at(-1).round),first=new Map((lr[0]?.top||[]).map(x=>[key(x),x.pos]));
  const movers=last.map(x=>({k:key(x),g:first.has(key(x))&&Number.isInteger(x.pos)?first.get(key(x))-x.pos:0})).filter(x=>x.g>=3).sort((a,b)=>b.g-a.g).slice(0,2).map(x=>x.k);
  contenders=[...new Set([...leadKeys,...near.slice(0,8),...movers])].slice(0,8);}
 const pick=[...new Set([...(n?last.filter(x=>Number.isInteger(x.pos)&&x.pos<=n).map(key):[]),...contenders,...leadKeys,...(selected?[selected]:[])])];
 const meta=new Map();for(const p of pts)for(const x of p.top)meta.set(key(x),{name:x.name,slug:x.slug});
 const series=pick.filter(k=>meta.has(k)).map(k=>({key:k,...meta.get(k),obs:pts.map(p=>{const x=p.top.find(y=>key(y)===k);return x&&Number.isInteger(x.pos)?{pos:x.pos,tied:!!x.tied,to_par:x.to_par??null,thru:x.thru??null}:null;})}));
 let mover=null;for(const s of series){const o=s.obs.filter(Boolean);if(o.length<2)continue;const g=o[0].pos-o.at(-1).pos;if(g>=3&&(!mover||g>mover.g))mover={k:s.key,g};}
 return {times:pts.map(p=>p.t),rounds:pts.map(p=>p.round),series,leaders:new Set(leadKeys),mover:mover?.k||null,selectedMissing:!!selected&&!meta.has(selected)};
}
// Monotone cubic (Fritsch–Carlson) through observed points; never overshoots between two observations.
export function monotonePath(p){
 if(p.length<2)return p.length?`M${p[0][0].toFixed(1)},${p[0][1].toFixed(1)}`:'';
 const n=p.length,dx=[],m=[],t=new Array(n);
 for(let i=0;i<n-1;i++){dx[i]=p[i+1][0]-p[i][0];m[i]=dx[i]?(p[i+1][1]-p[i][1])/dx[i]:0;}
 t[0]=m[0];t[n-1]=m[n-2];for(let i=1;i<n-1;i++)t[i]=m[i-1]*m[i]<=0?0:(m[i-1]+m[i])/2;
 for(let i=0;i<n-1;i++){if(m[i]===0){t[i]=0;t[i+1]=0;continue;}const a=t[i]/m[i],b=t[i+1]/m[i],s=a*a+b*b;if(s>9){const k=3/Math.sqrt(s);t[i]=k*a*m[i];t[i+1]=k*b*m[i];}}
 let d=`M${p[0][0].toFixed(1)},${p[0][1].toFixed(1)}`;
 for(let i=0;i<n-1;i++){const h=dx[i]/3;d+=`C${(p[i][0]+h).toFixed(1)},${(p[i][1]+t[i]*h).toFixed(1)} ${(p[i+1][0]-h).toFixed(1)},${(p[i+1][1]-t[i+1]*h).toFixed(1)} ${p[i+1][0].toFixed(1)},${p[i+1][1].toFixed(1)}`;}
 return d;
}
const fit=(s,px,cw=6.4)=>{const n=Math.max(3,Math.floor(px/cw));return s.length<=n?s:s.slice(0,n-1)+'…';};
export function timelineLayout(m,{width=720,height=260}={}){
 const narrow=width<520,L=narrow?30:36,R=narrow?92:128,T=14,B=26,G=narrow?10:16;
 const rounds=[...new Set(m.rounds)];const span=r=>{const ts=m.times.filter((_,i)=>m.rounds[i]===r).map(Date.parse);return {r,t0:Math.min(...ts),t1:Math.max(...ts)};};
 const segs=rounds.map(span),total=segs.reduce((s,x)=>s+Math.max(x.t1-x.t0,3600e3),0),avail=Math.max(60,width-L-R-G*(segs.length-1));
 let cur=L;for(const s of segs){s.x0=cur;s.w=avail*Math.max(s.t1-s.t0,3600e3)/total;cur+=s.w+G;}
 const x=i=>{const s=segs.find(z=>z.r===m.rounds[i]);return s.x0+(s.t1===s.t0?0:(Date.parse(m.times[i])-s.t0)/(s.t1-s.t0)*s.w);};
 const worst=Math.max(5,...m.series.flatMap(s=>s.obs.filter(Boolean).map(o=>o.pos)));
 const y=p=>T+(p-1)/(worst-1||1)*(height-T-B);
 return {L,R,T,B,G,segs,x,y,worst,width,height,narrow};
}
export function timelineSvg(m,{width=720,height=260,selected=null,focus=null,cursor=null,palette=false}={}){
 if(!m)return '';const g=timelineLayout(m,{width,height}),{L,R,T,B,x,y,worst}=g;
 const ticks=[1,5,10,15,20,25,30,35,40].filter(v=>v<=worst&&(v===1||worst-v>=4||v===worst));if(!ticks.includes(worst))ticks.push(worst);
 const grid=ticks.map(v=>`<line class="tl-grid" x1="${L}" x2="${width-R+6}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text class="tl-tick" x="${L-6}" y="${y(v).toFixed(1)}" text-anchor="end" dominant-baseline="middle">${v===1?'P1':v}</text>`).join('');
 const xaxis=g.segs.map(s=>{const lab=`<text class="tl-round" x="${s.x0.toFixed(1)}" y="${height-6}">R${s.r}</text>`;const hrs=[];const step=3600e3*(s.w/((s.t1-s.t0)/3600e3||1)<46?2:1);
  for(let t=Math.ceil(s.t0/3600e3)*3600e3;t<=s.t1;t+=step){const px=s.x0+(s.t1===s.t0?0:(t-s.t0)/(s.t1-s.t0)*s.w);if(px-s.x0<26||s.x0+s.w-px<14)continue;hrs.push(`<line class="tl-hr" x1="${px.toFixed(1)}" x2="${px.toFixed(1)}" y1="${height-B}" y2="${height-B+4}"/><text class="tl-time" x="${px.toFixed(1)}" y="${height-6}" text-anchor="middle">${e(new Date(t).toLocaleTimeString('en-US',{hour:'numeric'}).replace(' ',''))}</text>`);}
  return `<line class="tl-axis" x1="${s.x0.toFixed(1)}" x2="${(s.x0+s.w).toFixed(1)}" y1="${height-B}" y2="${height-B}"/>${lab}${hrs.join('')}`;}).join('');
 const breaks=g.segs.slice(1).map(s=>`<line class="tl-break" x1="${(s.x0-g.G/2).toFixed(1)}" x2="${(s.x0-g.G/2).toFixed(1)}" y1="${T}" y2="${height-B}"/>`).join('');
 const pal=new Map(palette?m.series.map((x,i)=>[x.key,'c'+(i%8)]):[]);
 const role=s=>s.key===focus?'is-focus':s.key===selected?'is-selected':palette?'is-pal '+pal.get(s.key):m.leaders.has(s.key)?'is-leader':s.key===m.mover?'is-mover':'is-muted';
 const order=[...m.series].sort((a,b)=>{const w=r=>r.startsWith('is-pal')?1:{'is-muted':0,'is-mover':1,'is-leader':2,'is-selected':3,'is-focus':4}[r];return w(role(a))-w(role(b));});
 const lines=order.map(s=>{const cls=role(s);const segs=[];let cur=[];
  s.obs.forEach((o,i)=>{if(!o||(cur.length&&m.rounds[i]!==m.rounds[cur.at(-1).i])){if(cur.length)segs.push(cur);cur=o?[{i,p:[x(i),y(o.pos)]}]:[];return;}cur.push({i,p:[x(i),y(o.pos)]});});if(cur.length)segs.push(cur);
  const dots=segs.flat().map(q=>`<circle class="tl-pt" cx="${q.p[0].toFixed(1)}" cy="${q.p[1].toFixed(1)}" r="${cls==='is-selected'||cls==='is-focus'?2.6:cls==='is-muted'?1.3:2}"/>`).join('');
  return `<g class="tl-s ${cls}" data-k="${e(s.key)}">${segs.map(sg=>`<path class="tl-line" d="${monotonePath(sg.map(q=>q.p))}"/>`).join('')}${dots}</g>`;}).join('');
 // Direct labels: selected, focus, leader(s) and the biggest mover only, spaced in the reserved gutter.
 const lab=m.series.filter(s=>role(s)!=='is-muted').map(s=>{let i=s.obs.length-1;while(i>=0&&!s.obs[i])i--;return i<0?null:{s,i,o:s.obs[i],yy:y(s.obs[i].pos)};}).filter(Boolean).sort((a,b)=>a.yy-b.yy);
 let prev=-1e9;const lh=13;for(const l of lab){l.ly=Math.max(l.yy,prev+lh);prev=l.ly;}
 const over=lab.length?lab.at(-1).ly-(height-B):0;if(over>0){for(const l of lab)l.ly-=over;for(let k=lab.length-2;k>=0;k--)lab[k].ly=Math.min(lab[k].ly,lab[k+1].ly-lh);}
 const gx=width-R+10;const labels=lab.map(l=>`<g class="tl-lab ${role(l.s)}"><line class="tl-lead" x1="${(x(l.i)+3).toFixed(1)}" y1="${l.yy.toFixed(1)}" x2="${(gx-3).toFixed(1)}" y2="${l.ly.toFixed(1)}"/><text x="${gx}" y="${l.ly.toFixed(1)}" dominant-baseline="middle">${e(fit(`${l.o.tied?'T':''}${l.o.pos} ${lastName(l.s.name)}`,R-12))}</text></g>`).join('');
 let tip='';if(cursor!==null&&cursor>=0&&cursor<m.times.length){const cx=x(cursor),s=m.series.find(z=>z.key===focus)||m.series.find(z=>z.key===selected)||m.series.find(z=>m.leaders.has(z.key));const o=s?.obs[cursor];
  const l1=clock(m.times[cursor]),l2=s?fit(s.name,150,6.6):'',l3=o?`${o.tied?'T':'P'}${o.pos} · ${tp(o.to_par)}${o.thru!=null?` · thru ${o.thru}`:''}`:'Not in observed top 40';
  const bw=170,bh=56,bx=cx+10+bw>width-4?cx-10-bw:cx+10,by=T+2;
  tip=`<line class="tl-cursor" x1="${cx.toFixed(1)}" x2="${cx.toFixed(1)}" y1="${T}" y2="${height-B}"/>${o?`<circle class="tl-hit" cx="${cx.toFixed(1)}" cy="${y(o.pos).toFixed(1)}" r="5"/>`:''}<g class="tl-tip" transform="translate(${bx.toFixed(1)} ${by})"><rect width="${bw}" height="${bh}" rx="3"/><text x="10" y="17" class="tl-tip-t">${e(l1)} · R${e(m.rounds[cursor])}</text><text x="10" y="33" class="tl-tip-n">${e(l2)}</text><text x="10" y="48">${e(l3)}</text></g>`;}
 const t0=clock(m.times[0]),t1=clock(m.times.at(-1));
 return `<svg class="tl-svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="Leaderboard positions over ${m.times.length} observed snapshots, ${e(t0)} to ${e(t1)}. Data table follows.">${grid}${breaks}${xaxis}${lines}${labels}${tip}</svg>`;
}
export function timelineTable(m){
 if(!m)return '';return `<details class="tl-table"><summary>Data table (${m.times.length} observations)</summary><div class="table-wrap" tabindex="0" role="region" aria-label="Observed positions by snapshot"><table class="index-table"><thead><tr><th scope="col">Observed</th>${m.series.map(s=>`<th scope="col" class="num">${e(lastName(s.name))}</th>`).join('')}</tr></thead><tbody>${m.times.map((t,i)=>`<tr><th scope="row">${e(clock(t))} · R${e(m.rounds[i])}</th>${m.series.map(s=>{const o=s.obs[i];return `<td class="num">${o?`${o.tied?'T':''}${o.pos} (${e(tp(o.to_par))})`:'—'}</td>`;}).join('')}</tr>`).join('')}</tbody></table></div></details>`;
}

// ---- Renderers.
const where=ev=>[ev.course?.name,[ev.course?.city,ev.course?.state||ev.course?.country].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
// Course-local clock from the forecast hour's UTC offset (weather lane); omitted when no offset is known.
export function courseOffset(w){const m=String(w?.t||'').match(/([+-])(\d\d):(\d\d)$/);return m?(m[1]==='-'?-1:1)*(Number(m[2])*60+Number(m[3])):null;}
export function courseClock(off,now=Date.now()){if(off===null)return '';const d=new Date(now+off*60e3);let h=d.getUTCHours();const mm=String(d.getUTCMinutes()).padStart(2,'0'),ap=h>=12?'PM':'AM';h=h%12||12;return `${h}:${mm} ${ap}`;}
export function commandBar(ev,w,{now=Date.now()}={}){
 const off=courseOffset(w);
 return `<span class="cv3-ename">${e(ev.edition?.name?.replace(/^\d{4}\s+/,'')||'')}</span><div class="cv3-state">${badge(ev)}<span class="cv3-age" data-cv3-age data-fetched="${e(ev.fetched_at||'')}">${e(ageText(ev,now))}</span></div><p class="cv3-where">${e(where(ev))}${off!==null?` · <span data-cv3-clock data-off="${off}">${e(courseClock(off,now))}</span> local`:''}</p>${w?`<p class="cv3-wxmini" aria-label="Weather estimate">${e(w.temp_f??'—')}° · ${e(w.wind_dir||'')} ${e(w.wind_mph??'—')}${w.gust_mph!=null?` · gust ${e(w.gust_mph)}`:''}</p>`:''}<button type="button" class="cv3-fs" data-cv3-fs aria-label="Open fullscreen PBEcast" aria-pressed="false"><span aria-hidden="true">⛶</span> <span data-cv3-fs-text>Fullscreen</span></button>`;
}
export function ageText(ev,now=Date.now()){const t=Date.parse(ev.fetched_at||'');const s=Number.isFinite(t)?Math.max(0,Math.round((now-t)/1000)):ev.age_seconds;return s==null?'':`${ev.state==='stale'?'Last update':'Updated'} ${ago(s)}`;}
export function towerRows(ev,{selected,moves=new Map(),prev=null}={}){
 const rows=(ev.leaderboard||[]).slice(0,200),lead=rows.find(r=>r.status==='active')?.total_to_par;
 return rows.map(r=>{const k=key(r),mv=moves.get(k),p=prev?.get(k),ch=f=>p&&p[f]!==r[f]?' is-changed':'';
  const mvTxt=mv>0?`▲${mv}`:mv<0?`▼${-mv}`:mv===0?'–':'';const mvLab=mv>0?`up ${mv}`:mv<0?`down ${-mv}`:mv===0?'no change':'';
  const lab=`${r.name}, ${r.status!=='active'?OUT[r.status]||'':`position ${r.position||'unknown'}`}, total ${tp(r.total_to_par)}, today ${tp(r.today_to_par)}, ${r.thru===18?'finished':r.thru>0?`thru ${r.thru}`:'not started'}${mvLab?`, ${mvLab} since previous observation`:''}`;
  const cls=[k===selected?'is-on':'',r.status==='active'&&r.total_to_par===lead?'is-leader':'',r.tied?'is-tied':'',r.status!=='active'?'is-out':'',mv?'is-moved':''].filter(Boolean).join(' ');
  // Row = a full-row select button underneath + a real link on the canonical name above it (name click navigates;
  // anywhere else selects). Unresolved players have no link.
  return `<li class="cv3-row ${cls}" data-row="${e(k)}"><button type="button" class="cv3-hit" data-cv3-pick="${e(k)}" aria-pressed="${k===selected}" aria-label="Select ${e(lab)}"></button><span class="cv3-p${ch('position')}">${e(r.status!=='active'?OUT[r.status]||'—':r.position||'—')}</span><span class="cv3-mv ${mv>0?'up':mv<0?'down':''}" aria-hidden="true">${e(mvTxt)}</span><span class="cv3-n">${playerName(r,{cls:'cv3-plink-row'})}</span><span class="cv3-t${ch('total_to_par')}">${e(tp(r.total_to_par))}</span><span class="cv3-d${ch('today_to_par')}">${e(tp(r.today_to_par))}</span><span class="cv3-h${ch('thru')}">${e(thruText(r))}</span></li>`;}).join('');
}
export function towerHead(){return `<div class="cv3-thead" aria-hidden="true"><span>POS</span><span></span><span>PLAYER</span><span>TOT</span><span>TODAY</span><span>THRU</span></div>`;}
function stripCell(h,layout,sel){
 const d=holeDiff(h),k=resultKind(d),y=layout.get(h.hole)?.yards;
 return `<li><button type="button" class="hc hc-${k}${sel===h.hole?' is-on':''}" data-cv3-hole="${e(h.hole)}" aria-pressed="${sel===h.hole}" aria-label="Hole ${e(h.hole)}, par ${e(h.par??'unknown')}${y?`, ${y} yards`:''}: ${e(h.strokes)} strokes, ${e(resultLabel(d)||'result not posted')}"><span class="hc-h">${e(h.hole)}</span><span class="hc-par">P${e(h.par??'—')}</span><span class="hc-s"><i>${e(h.strokes)}</i></span><span class="hc-r">${e(SHORT[k])}</span></button></li>`;
}
// The hole the golfer is playing now = next hole in order of play (start hole + holes completed). Only while on course.
// This is a hole, never a position on it.
export function currentHole(r){return r&&r.status==='active'&&r.thru>0&&r.thru<18&&Number.isInteger(r.start_hole)?((r.start_hole-1+r.thru)%18)+1:null;}
export function holeDetail(h,layout,{realRoute=false}={}){
 if(!h)return '';const L=layout.get(h.hole),d=holeDiff(h);
 return `<div class="cv3-hd-text"><p class="micro-label">HOLE ${e(h.hole)} · OBSERVED</p><p class="cv3-hd-res">${e(resultLabel(d)||'Result not posted')}</p><dl class="cv3-dl"><div><dt>Strokes</dt><dd>${e(h.strokes)}</dd></div><div><dt>Par</dt><dd>${e(h.par??L?.par??'—')}</dd></div>${L?.yards?`<div><dt>Yards</dt><dd>${e(L.yards)}</dd></div>`:''}</dl>${realRoute?'<p class="gnote">The Course View shows this hole’s mapped routing. Shot locations are not tracked.</p></div>':'<p class="gnote">No shot data is published for this hole. The figure is a generic template, not the hole’s real shape.</p></div><figure class="cv3-hd-fig"><figcaption><span class="truth truth-reconstructed">RECONSTRUCTED</span> Scorecard-based visualization · not shot tracking</figcaption>'+holeSvg({hole:h.hole,par:h.par??L?.par,yards:L?.yards??null,strokes:null})+'</figure>'}`;
}
const recentEv=evs=>evs.length?`<div class="cv3-recent"><p class="micro-label">LATEST SCORING · OBSERVED</p><p class="cv3-latest"><time datetime="${e(evs[0].t)}">${e(clock(evs[0].t))}</time> <b>${e(evs[0].rest??evs[0].text)}</b></p>${evs.length>1?`<p class="micro-label">RECENT</p><ul>${evs.slice(1,7).map(x=>`<li><time datetime="${e(x.t)}">${e(clock(x.t))}</time> ${e(x.rest??x.text)}</li>`).join('')}</ul>`:''}</div>`:'';
/** Compact Player DNA for PBEcast from the SAME public DNA model as the player page (one source of truth): the top
 * published dimensions only, with sample/confidence. No composite, no zeros, no simplified model. */
export function compactDna(p,{max=4}={}){
 if(!p?.slug)return '';const m=dnaModel(p.dna_public),top=(m?.ranked||[]).slice().sort((x,y)=>y.percentile-x.percentile||x.key.localeCompare(y.key)).slice(0,max);
 const cta=`<a class="cv3-dnacta" href="/player/${e(p.slug)}#dna" data-dna-open="${e(p.slug)}">View full Player DNA <span aria-hidden="true">→</span></a>`;
 if(!top.length)return `<p class="micro-label">PLAYER DNA</p><p class="gnote">Player DNA does not yet have enough comparable sample.</p>${cta}`;
 return `<p class="micro-label">PLAYER DNA · ${e(m.window)}</p><dl class="cv3-dnal">${top.map(x=>`<div><dt>${e(x.label)}</dt><dd><b>${e(x.percentile)}</b><small>percentile · n=${e(x.sample_n??'—')} ${e(x.basis||'')}${x.confidence?' · '+e(x.confidence.toLowerCase()):''}</small></dd></div>`).join('')}</dl><p class="gnote">Percentiles within the ${e(p.division==='women'?'women’s':'men’s')} division cohort. Descriptive, not a prediction.</p>${cta}`;
}
export function focusPanel(ev,r,{holes=null,layout=[],selHole=null,realRoute=()=>false,player=null,mv=null,events=[],dnaBlock=''}={}){
 if(!r)return '<p class="gnote">Select a golfer from the leaderboard.</p>';
 const lay=new Map((layout||[]).map(h=>[h.hole,h])),hs=holes||[],lastH=hs.at(-1),lh=lastH?lay.get(lastH.hole):null;
 const status=OUT[r.status]?`${OUT[r.status]}`:r.thru===18?`Finished round ${ev.round}`:r.thru>0?`Thru ${r.thru} · round ${ev.round}`:r.tee_time?`Tees off ${clock(r.tee_time)}`:'Not started';
 const facts=runFacts(hs);
 let next='';const cn=currentHole(r);if(cn){const N=lay.get(cn);next=`<div><dt>Current hole</dt><dd>Hole ${e(cn)}${N?` · Par ${e(N.par??'—')}${N.yards?` · ${e(N.yards)} yd`:''}`:''}</dd></div>`;}
 else if(r.status==='active'&&!(r.thru>0)&&Number.isInteger(r.start_hole))next=`<div><dt>First hole</dt><dd>Hole ${e(r.start_hole)}${r.tee_time?` · tees off ${e(clock(r.tee_time))}`:''}</dd></div>`;
 const moment=`<div class="cv3-moment"><p class="cv3-kick"><span class="truth truth-observed">CURRENT MOMENT</span></p><ul class="cv3-mlist"><li><b>${e(status)}</b>${r.today_to_par!=null&&r.thru>0?` · ${e(tp(r.today_to_par))} today`:''}</li>${lastH&&holeDiff(lastH)!==null?`<li><b>${e(resultLabel(holeDiff(lastH)))} on ${e(lastH.hole)}</b> · ${e(lastH.strokes)} on par ${e(lastH.par)}${lh?.yards?` · ${e(lh.yards)} yards`:''}</li>`:''}${facts.map(f=>`<li class="is-derived">${e(f)} <span class="cv3-chip">PBE-DERIVED</span></li>`).join('')}</ul></div>`;
 const card=hs.length?`<div class="cv3-card"><p class="micro-label">ROUND ${e(ev.round)} SCORECARD · ${e(hs.length)} HOLE${hs.length===1?'':'S'} POSTED</p><ol class="cv3-strip" aria-label="Round ${e(ev.round)} hole results in order played">${hs.map(h=>stripCell(h,lay,selHole)).join('')}</ol><p class="cv3-legend" aria-hidden="true"><span class="hc-key hc-eagle">EGL</span>Eagle or better <span class="hc-key hc-birdie">BIR</span>Birdie <span class="hc-key hc-par">PAR</span>Par <span class="hc-key hc-bogey">BOG</span>Bogey <span class="hc-key hc-double">DBL+</span>Double or worse</p></div>`:`<p class="gnote cv3-noholes">${ev.holes_available?(r.thru>0?'Hole results for this round are not posted yet.':'No holes played this round yet.'):'Hole-by-hole scores aren’t published for this tour; round totals are shown.'}</p>`;
 const course=lh||next?`<div class="cv3-course"><p class="micro-label">COURSE NOW</p><dl class="cv3-cdl">${lh?`<div><dt>Last completed</dt><dd>Hole ${e(lastH.hole)} · Par ${e(lh.par??'—')}${lh.yards?` · ${e(lh.yards)} yd`:''}</dd></div>`:''}${next}</dl></div>`:'';
 const det=selHole!=null?hs.find(h=>h.hole===selHole):null;
 return `<div class="cv3-hero${player?' has-photo':''}">${player?`<div class="cv3-photo">${portrait(player,{size:96,cls:'cv3-portrait'})}</div>`:''}<div class="cv3-hero-txt"><p class="micro-label">SELECTED GOLFER</p><h2 class="cv3-pname">${playerName(r,{cls:'cv3-plink'})}</h2><p class="cv3-big"><span class="cv3-bigpos">${e(posLabel(r))}</span><span class="cv3-bigtot">${e(tp(r.total_to_par))}</span></p><p class="cv3-sub">TODAY ${e(tp(r.today_to_par))} · THRU ${e(thruText(r))} · ROUND ${e(ev.round??'—')}${mv?` · ${mv>0?'▲':'▼'}${Math.abs(mv)} since previous snapshot`:''}</p>${r.tee_time||Number.isInteger(r.start_hole)?`<p class="cv3-sub cv3-tee">${r.tee_time?`TEE TIME ${e(clock(r.tee_time))}`:''}${r.tee_time&&Number.isInteger(r.start_hole)?' · ':''}${Number.isInteger(r.start_hole)?`START HOLE ${e(r.start_hole)}`:''}</p>`:''}</div></div>${recentEv(events)}${moment}<div class="cv3-dna" data-cv3-dna>${dnaBlock}</div>${card}${course}<div class="cv3-hd" data-cv3-hd${det?'':' hidden'} aria-live="polite">${det?holeDetail(det,lay,{realRoute:realRoute(det.hole)}):''}</div>`;
}
export function pulseList(events,{seen=null,empty='No provable scoring changes between the observed snapshots yet.'}={}){
 if(!events.length)return `<li class="cv3-pl-empty">${e(empty)}</li>`;
 // Name = link to the canonical player profile (plain text when unresolved). Body = button that focuses the golfer
 // (and the proven hole) inside PBEcast. Observed scoring only: no commentary.
 return events.map(x=>{const id=x.t+'|'+x.text;const who=x.who||[];
  const names=who.map(w=>playerName({slug:w.slug,name:w.name},{cls:'pl-name',label:w.label})).join(', ');
  const mv=x.move?`<span class="pl-mv ${x.move.delta>0?'up':'down'}" aria-label="${x.move.delta>0?'up':'down'} ${Math.abs(x.move.delta)}, ${e(x.move.from)} to ${e(x.move.to)}">${x.move.delta>0?'▲':'▼'}${Math.abs(x.move.delta)} <small>${e(x.move.from)}→${e(x.move.to)}</small></span>`:'';
  const bodyTxt=x.prefix?'':e(x.rest??x.text);
  const body=x.prefix?`<button type="button" class="pl-go" data-pulse-key="${e(x.keys[0])}" aria-label="${e(x.text)}. Focus in PBEcast">${e(x.prefix)}</button> ${names}`:`${names?names+' ':''}<button type="button" class="pl-go" data-pulse-key="${e(x.keys[0])}"${Number.isInteger(x.hole)?` data-pulse-hole="${e(x.hole)}"`:''} aria-label="${e(x.text)}. ${Number.isInteger(x.hole)?`Show hole ${e(x.hole)} in the Course View`:'Focus in PBEcast'}">${bodyTxt}</button>`;
  return `<li class="pl-${x.type}${x.kind?' pl-'+x.kind:''}${seen&&!seen.has(id)?' is-new':''}"><time datetime="${e(x.t)}">${e(clock(x.t))}</time><span class="pl-body">${body}${mv}</span></li>`;}).join('');
}
export function fieldPanel(f){
 if(!f)return '';const s=(k,v,sub='')=>`<div><dt>${e(k)}</dt><dd>${e(v)}${sub?`<small>${e(sub)}</small>`:''}</dd></div>`;
 return `<p class="cv3-kick"><span class="micro-label">FIELD SNAPSHOT</span><span class="cv3-chip">PBE-DERIVED FROM THE OBSERVED BOARD</span></p><dl class="cv3-field">${s('Leader',tp(f.lead),f.leaders.length>1?`${f.leaders.length} tied`:lastName(f.leaders[0].name))}${s('Within 1',f.within1)}${s('Within 2',f.within2)}${s('Within 3',f.within3)}${s('Finished',f.finished,`${f.on_course} on course${f.not_started?` · ${f.not_started} yet to start`:''}`)}${f.low!=null?s('Low round today',`${f.low} (${tp(f.lowToPar)})`,f.lowBy.length>1?`${f.lowBy.length} players`:lastName(f.lowBy[0].name)):''}${f.mover?s('Biggest mover',`▲${f.mover.gain}`,`${lastName(f.mover.name)} · ${f.mover.from} → ${f.mover.tied?'T':''}${f.mover.to} since ${clock(f.mover.since)}`):''}</dl>`;
}
export function weatherTile(w){
 if(!w)return '';return `<p class="micro-label">WEATHER</p><div class="cv3-wx"><b class="cv3-wx-t">${e(w.temp_f??'—')}°</b><span class="cv3-wx-w"><b>${e(w.wind_dir||'')} ${e(w.wind_mph??'—')}</b><small>MPH WIND</small></span>${w.gust_mph!=null?`<span class="cv3-wx-w"><b>${e(w.gust_mph)}</b><small>GUST</small></span>`:''}</div><p class="cv3-wx-note">${e(w.short||'')}${w.short?' · ':''}${w.precision==='locality'?`Town-level estimate${w.locality?` for ${e(w.locality)}`:''}`:'Forecast at the course point'} · updated ${e(ago(w.age_seconds))}</p>`;
}
// Static shell: regions are filled and diff-updated by the controller (src/lib/cast-v3-live.js).
export function castShell(){
 return `<section class="cast-live cv3" aria-label="PBEcast live" data-cv3><header class="cv3-bar" data-cv3-bar></header>
<div class="cv3-status" data-cv3-status></div>
<section class="cv3-tower" aria-labelledby="cv3-tower-h"><h2 class="cv3-sh" id="cv3-tower-h">Live leaderboard</h2>${towerHead()}<ol class="cv3-list" data-cv3-tower></ol></section>
<section class="cv3-focus" data-cv3-focus aria-label="Selected golfer"></section>
<section class="cv3-cmap" data-cv3-cmap aria-label="Course view" hidden></section>
<section class="cv3-pulse" aria-labelledby="cv3-pulse-h"><h2 class="cv3-sh" id="cv3-pulse-h">Live scoring</h2><div class="cv3-thead2" data-cv3-tapehead aria-live="polite"></div><p class="cv3-cap">Hole-by-hole live: each line is a posted hole result or board change observed between consecutive scoring observations (about every minute while play is on), across the whole field. Hole results are named only from posted hole cards. Shots are not tracked.</p><ol class="cv3-pl" data-cv3-pulse tabindex="0" aria-label="Live scoring events, newest first"></ol></section>
<section class="cv3-tl" aria-labelledby="cv3-tl-h" data-cv3-tl><div class="cv3-tl-head"><h2 class="cv3-sh" id="cv3-tl-h">Leaders over time</h2><div class="cv3-seg" role="group" aria-label="Players shown"><button type="button" data-cv3-filter="contenders" aria-pressed="false">Contenders</button><button type="button" data-cv3-filter="top5" aria-pressed="false">Top 5</button><button type="button" data-cv3-filter="top10" aria-pressed="false">Top 10</button><button type="button" data-cv3-filter="selected" aria-pressed="false">Selected</button></div></div><div class="cv3-plot" data-cv3-plot tabindex="0" aria-describedby="cv3-tl-cap"></div><div class="cv3-key" data-cv3-key></div><p class="cv3-cap" id="cv3-tl-cap" data-cv3-tlcap></p><div data-cv3-table></div></section>
<section class="cv3-ctx" aria-label="Tournament context"><div class="cv3-fieldbox" data-cv3-field></div><div class="cv3-wxbox" data-cv3-wx></div></section>
<p class="gnote cv3-truth">Positions, scores, hole results and course par/yardage are observed as posted. Movement, streaks, the live scoring tape and field counts are PBE-derived from those observations. Ball and player positions are not tracked: the Course View highlights the hole being played, never a location on it. Course routing © OpenStreetMap contributors (ODbL) where mapped; otherwise the hole figure is a labelled reconstruction. Times are in your time zone.</p></section>`;
}

// ---- Live scoring tape (server-derived, full field: workers/shared/tape.js via /api/v1/live/:edition/tape).
// Display rule: every non-par event; pars only for the top ten and the selected golfer (pars across a 70-player
// field would bury the scoring). Newest first. Each line is an observation, never a narrated sequence.
export function tapeView(tape,ev,{selected=null,limit=60}={}){
 const top=new Set((ev?.leaderboard||[]).filter(r=>r.status==='active'&&posNum(r)!==null&&posNum(r)<=10).map(key));
 const out=[];
 for(const x of [...(tape?.events||[])].reverse()){
  if(x.round!=null&&ev?.round!=null&&x.round!==ev.round)continue;
  if(x.type==='hole'&&x.kind==='par'&&!x.keys?.some(k=>k===selected||top.has(k)))continue;
  out.push(x);if(out.length>=limit)break;
 }
 return out;
}
export const golferTape=(tape,k,round)=>[...(tape?.events||[])].reverse().filter(x=>x.keys?.includes(k)&&(round==null||x.round==null||x.round===round));
// The live-scoring head: what the tape is and how fresh its last observation is. Never a blank module.
export function tapeHead(ev,tape,{now=Date.now(),newSinceMount=true}={}){
 const lo=Date.parse(tape?.last_observation_at||ev?.fetched_at||''),age=Number.isFinite(lo)?Math.max(0,Math.round((now-lo)/1000)):null;
 const obs=age===null?'':`Last scoring observation ${ago(age)}`;
 const st=ev?.state;
 const lead=st==='live'?'LIVE SCORING · HOLE-BY-HOLE':st==='suspended'?'PLAY SUSPENDED':st==='stale'?'SCORING UPDATE DELAYED':st==='round_complete'?`ROUND ${ev.round} COMPLETE`:st==='final'?'FINAL':'LIVE SCORING';
 const wait=st==='live'&&!newSinceMount?' · Waiting for the next posted hole result':'';
 return `<p class="cv3-th"><b class="cv3-th-l cv3-th-${e(st||'na')}">${e(lead)}</b><span class="cv3-th-o" data-cv3-obs data-at="${e(tape?.last_observation_at||ev?.fetched_at||'')}">${e(obs)}</span><span class="cv3-th-w">${e(wait)}</span></p>`;
}
// Empty tape: say exactly why there is nothing yet.
export function tapeEmpty(ev){
 const st=ev?.state;
 if(st==='live')return 'LIVE SCORING · Waiting for the next posted hole result.';
 if(st==='suspended')return 'Play is suspended. The tape resumes with the first hole posted after play restarts.';
 if(st==='stale')return 'Scoring updates are delayed. Scores below are from the last observation and may have changed.';
 if(st==='pre')return `The scoring tape starts with the first posted hole${ev.first_tee?` (first tee ${clock(ev.first_tee)})`:''}.`;
 return 'No scoring changes were observed in this round.';
}
