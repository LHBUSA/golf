// Deterministic golf computations over projection documents. No source fetches, no model input.
export const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
export const r1=v=>v===null||v===undefined?null:Math.round(v*10)/10;
const active=r=>!['withdrawn','disqualified'].includes(r.status);
const roundOf=(r,k)=>r.rounds?.find(q=>q.round===k&&Number.isInteger(q.strokes)&&q.to_par!==null&&q.to_par!==undefined);
// Largest round n that at least 90% of the eligible field has completed (cut players drop out after round two).
export function roundsComplete(board){
 const act=(board||[]).filter(r=>(r.player?.slug||r.player?.name)&&active(r));if(act.length<20)return 0;
 let n=0;for(let k=1;k<=5;k++){const elig=act.filter(r=>k<=2||r.status!=='cut');const have=elig.filter(r=>roundOf(r,k)).length;if(elig.length&&have/elig.length>=0.9)n=k;else break;}
 return n;
}
// Standings through round n from posted round scores, stroke-play ties.
export function standingsAfter(board,n){
 const rows=[];for(const r of board||[]){if(!(r.player?.slug||r.player?.name)||!active(r))continue;const rs=[];for(let k=1;k<=n;k++){const x=roundOf(r,k);if(!x){rs.length=0;break;}rs.push(x);}if(rs.length!==n)continue;
  rows.push({row:r,player:r.player,to_par:rs.reduce((s,x)=>s+x.to_par,0),strokes:rs.reduce((s,x)=>s+x.strokes,0),rounds:rs});}
 rows.sort((a,b)=>a.to_par-b.to_par||a.player.name.localeCompare(b.player.name));
 for(const r of rows){r.position=rows.filter(x=>x.to_par<r.to_par).length+1;r.tied=rows.filter(x=>x.to_par===r.to_par).length>1;}
 return rows;
}
export function roundStats(board,k){
 const xs=(board||[]).map(r=>({r,x:roundOf(r,k)})).filter(o=>o.x);if(!xs.length)return null;
 const strokes=xs.map(o=>o.x.strokes),low=Math.min(...strokes);
 return {n:xs.length,average:r1(mean(strokes)),low,low_players:xs.filter(o=>o.x.strokes===low).map(o=>o.r.player),under_par:xs.filter(o=>o.x.to_par<0).length};
}
// Per-hole field scoring for an edition from published hole-by-hole cards (only when the sample is real).
export function holeDifficulty(board,layout,{minCards=30}={}){
 const holes=layout?.holes||[];if(holes.length!==18)return null;
 const acc=new Map(holes.map(h=>[h.hole,{hole:h.hole,par:h.par,yards:h.yards??null,sum:0,n:0}]));let cards=0;
 for(const r of board||[])for(const rd of r.holes||[]){if(rd.scores?.length!==18)continue;cards++;for(const s of rd.scores){const a=acc.get(s.hole);if(a&&Number.isInteger(s.strokes)&&a.par){a.sum+=s.strokes-a.par;a.n++;}}}
 if(cards<minCards)return null;
 const out=[...acc.values()].filter(a=>a.n).map(a=>({hole:a.hole,par:a.par,yards:a.yards,avg_to_par:Math.round(a.sum/a.n*100)/100,n:a.n}));
 return {cards,holes:out};
}
export const weatherDays=(w,{from,to}={})=>{
 if(!w?.hours?.length)return [];const days=new Map();
 for(const h of w.hours){const d=h.t.slice(0,10),hr=Number(h.t.slice(11,13));if(from&&d<from||to&&d>to||hr<7||hr>19)continue;(days.get(d)||days.set(d,[]).get(d)).push(h);}
 return [...days].map(([day,hs])=>{const v=k=>hs.map(h=>h[k]).filter(x=>x!==null&&x!==undefined);const w_=v('wind_mph'),g=v('gust_mph'),t=v('temp_f'),p=v('pop'),pm=v('precip_mm');
  const part=(a,b)=>{const xs=hs.filter(h=>{const hr=Number(h.t.slice(11,13));return hr>=a&&hr<b;});const vv=k=>xs.map(h=>h[k]).filter(x=>x!==null&&x!==undefined);const ww=vv('wind_mph'),gg=vv('gust_mph'),tt=vv('temp_f'),pp=vv('pop'),mm=vv('precip_mm');const dirs=xs.map(h=>h.wind_dir).filter(Boolean);
   return xs.length?{wind_max:ww.length?Math.max(...ww):null,gust_max:gg.length?Math.max(...gg):null,temp:tt.length?Math.round(mean(tt)):null,pop_max:pp.length?Math.max(...pp):null,precip_mm:mm.length?Math.round(mm.reduce((x,y)=>x+y,0)*10)/10:null,dir:dirs.length?[...dirs.reduce((m,d)=>m.set(d,(m.get(d)||0)+1),new Map())].sort((a,b)=>b[1]-a[1])[0][0]:null}:null;};
  return {day,wind_max:w_.length?Math.max(...w_):null,gust_max:g.length?Math.max(...g):null,temp_min:t.length?Math.min(...t):null,temp_max:t.length?Math.max(...t):null,pop_max:p.length?Math.max(...p):null,precip_mm:pm.length?Math.round(pm.reduce((x,y)=>x+y,0)*10)/10:null,parts:{morning:part(7,11),midday:part(11,15),afternoon:part(15,20)}};});
};
// A live ESPN snapshot as a leaderboard (completed rounds only, so standings never use partial rounds).
export function boardFromSnapshot(snap){
 if(!snap?.players)return [];
 return snap.players.map(p=>({player:{slug:p.slug||null,name:p.name},status:p.status==='active'?'unknown':p.status,rounds:(p.rounds||[]).filter(r=>r.complete&&Number.isInteger(r.strokes)&&r.to_par!==null).map(r=>({round:r.round,strokes:r.strokes,to_par:r.to_par,vs_field:null})),holes:[]}));
}
